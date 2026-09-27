import { Prisma, TicketPriority, TicketStatus, TicketType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import {
  WORKING_MINUTES_PER_DAY,
  addWorkingMinutes,
  endOfWorkingDay,
  workingMinutesBetween,
} from '../utils/working-time.js';

// SLA targets in working minutes (1 working day = 8 working hours).
// SERVICE tickets cannot be CRITICAL - absent keys mean "not allowed".
export const SLA_TARGET_MINUTES: Record<TicketType, Partial<Record<TicketPriority, number>>> = {
  SERVICE: {
    LOW: 10 * WORKING_MINUTES_PER_DAY,
    MEDIUM: 5 * WORKING_MINUTES_PER_DAY,
    HIGH: 3 * WORKING_MINUTES_PER_DAY,
  },
  INCIDENT: {
    LOW: 7 * WORKING_MINUTES_PER_DAY,
    MEDIUM: 5 * WORKING_MINUTES_PER_DAY,
    HIGH: 3 * WORKING_MINUTES_PER_DAY,
    CRITICAL: 24 * 60,
  },
};

// The SLA clock runs only while work is outstanding. RESOLVED/CLOSED tickets
// have a final SLA outcome (met or breached) based on their resolution time.
export const SLA_RUNNING_STATUSES: TicketStatus[] = [
  TicketStatus.NEW,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_FOR_USER,
];

const DEFAULT_WARNING_MINUTES = 24 * 60;
const CRITICAL_WARNING_MINUTES = 4 * 60;

export type SlaState = 'ON_TRACK' | 'WARNING' | 'BREACHED' | 'MET';
export const SLA_FILTERS = ['BREACHED', 'WARNING', 'DUE_TODAY', 'ATTENTION'] as const;
export type SlaFilter = (typeof SLA_FILTERS)[number];

export const isPriorityAllowed = (type: TicketType, priority: TicketPriority) =>
  SLA_TARGET_MINUTES[type][priority] !== undefined;

export function assertPriorityAllowed(type: TicketType, priority: TicketPriority) {
  if (!isPriorityAllowed(type, priority))
    throw new AppError(
      422,
      'PRIORITY_NOT_ALLOWED',
      'Priorytet krytyczny jest dostępny wyłącznie dla incydentów.',
    );
}

export function slaTargetMinutes(type: TicketType, priority: TicketPriority): number {
  const target = SLA_TARGET_MINUTES[type][priority];
  if (target === undefined) assertPriorityAllowed(type, priority);
  return target as number;
}

export const warningThresholdMinutes = (priority: TicketPriority) =>
  priority === TicketPriority.CRITICAL ? CRITICAL_WARNING_MINUTES : DEFAULT_WARNING_MINUTES;

export const calculateSlaDueAt = (createdAt: Date, type: TicketType, priority: TicketPriority) =>
  addWorkingMinutes(createdAt, slaTargetMinutes(type, priority));

type SlaTicket = {
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  slaDueAt: Date | null;
};

export type SlaInfo = {
  dueAt: string;
  targetMinutes: number;
  warningThresholdMinutes: number;
  // Signed working minutes until the deadline (negative once breached);
  // null when the clock is stopped (RESOLVED/CLOSED).
  remainingMinutes: number | null;
  running: boolean;
  dueToday: boolean;
  state: SlaState;
};

export function computeSla(ticket: SlaTicket, now: Date): SlaInfo | null {
  const targetMinutes = SLA_TARGET_MINUTES[ticket.type][ticket.priority];
  if (targetMinutes === undefined) return null;
  const dueAt = ticket.slaDueAt ?? addWorkingMinutes(ticket.createdAt, targetMinutes);
  const threshold = warningThresholdMinutes(ticket.priority);
  const running = SLA_RUNNING_STATUSES.includes(ticket.status);
  let state: SlaState;
  let remainingMinutes: number | null = null;
  let dueToday = false;
  if (running) {
    remainingMinutes = workingMinutesBetween(now, dueAt);
    const endOfToday = endOfWorkingDay(now);
    dueToday = dueAt > now && endOfToday !== null && dueAt <= endOfToday;
    if (dueAt <= now) state = 'BREACHED';
    else if (dueAt < addWorkingMinutes(now, threshold)) state = 'WARNING';
    else state = 'ON_TRACK';
  } else {
    const finishedAt = ticket.resolvedAt ?? ticket.closedAt ?? now;
    state = finishedAt <= dueAt ? 'MET' : 'BREACHED';
  }
  return {
    dueAt: dueAt.toISOString(),
    targetMinutes,
    warningThresholdMinutes: threshold,
    remainingMinutes,
    running,
    dueToday,
    state,
  };
}

export const withSla = <T extends SlaTicket>(ticket: T, now = new Date()) => ({
  ...ticket,
  sla: computeSla(ticket, now),
});

// Prisma conditions matching exactly the tickets `computeSla` classifies as
// BREACHED / WARNING / due today while their SLA clock is running. Working-
// time thresholds are converted to wall-clock instants, which is exact
// because addWorkingMinutes is monotonic.
//
// ATTENTION = breached or warning SLA, plus unassigned HIGH/CRITICAL tickets
// that nobody has picked up yet.
export function slaWhere(filter: SlaFilter, now: Date): Prisma.TicketWhereInput {
  const running = { status: { in: SLA_RUNNING_STATUSES } };
  if (filter === 'ATTENTION')
    return {
      ...running,
      OR: [
        slaWhere('BREACHED', now),
        slaWhere('WARNING', now),
        {
          assigneeId: null,
          priority: { in: [TicketPriority.HIGH, TicketPriority.CRITICAL] },
        },
      ],
    };
  if (filter === 'BREACHED') return { ...running, slaDueAt: { lte: now } };
  if (filter === 'DUE_TODAY') {
    const endOfToday = endOfWorkingDay(now);
    if (!endOfToday) return { id: { in: [] } };
    return { ...running, slaDueAt: { gt: now, lte: endOfToday } };
  }
  return {
    ...running,
    OR: [
      {
        priority: TicketPriority.CRITICAL,
        slaDueAt: { gt: now, lt: addWorkingMinutes(now, CRITICAL_WARNING_MINUTES) },
      },
      {
        priority: { not: TicketPriority.CRITICAL },
        slaDueAt: { gt: now, lt: addWorkingMinutes(now, DEFAULT_WARNING_MINUTES) },
      },
    ],
  };
}

// Fills sla_due_at for tickets that predate the SLA migration (the SQL
// migration cannot evaluate the working-time calendar). Deterministic and
// idempotent: the deadline depends only on created_at, type and priority,
// and rows that already have a deadline are never touched.
export async function backfillMissingSlaDueDates(batchSize = 200): Promise<number> {
  let updated = 0;
  for (;;) {
    const batch = await prisma.ticket.findMany({
      where: { slaDueAt: null },
      select: { id: true, createdAt: true, type: true, priority: true },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });
    if (batch.length === 0) return updated;
    await prisma.$transaction(
      batch.map((ticket) =>
        prisma.ticket.updateMany({
          where: { id: ticket.id, slaDueAt: null },
          data: { slaDueAt: calculateSlaDueAt(ticket.createdAt, ticket.type, ticket.priority) },
        }),
      ),
    );
    updated += batch.length;
  }
}
