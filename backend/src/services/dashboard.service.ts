import { Prisma, TicketPriority, TicketStatus, TicketType, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { slaWhere, withSla } from './sla.service.js';

type Actor = { userId: string; role: UserRole };

const personSelect = { select: { id: true, firstName: true, lastName: true } } as const;
const ACTIVE_STATUSES = [
  TicketStatus.NEW,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_FOR_USER,
  TicketStatus.RESOLVED,
] as const;

// Operational metrics for TECHNICIAN/ADMIN. "Active" means not CLOSED, which
// is exactly the default scope of GET /api/tickets, so every count here
// matches the filtered list the dashboard links to.
async function operations(now: Date) {
  const active: Prisma.TicketWhereInput = { status: { not: TicketStatus.CLOSED } };
  const [byStatus, byType, critical, unassigned, attention, breached, warning, dueToday] =
    await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], where: active, _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['type'], where: active, _count: { _all: true } }),
      prisma.ticket.count({ where: { ...active, priority: TicketPriority.CRITICAL } }),
      prisma.ticket.count({ where: { ...active, assigneeId: null } }),
      prisma.ticket.count({ where: slaWhere('ATTENTION', now) }),
      prisma.ticket.count({ where: slaWhere('BREACHED', now) }),
      prisma.ticket.count({ where: slaWhere('WARNING', now) }),
      prisma.ticket.count({ where: slaWhere('DUE_TODAY', now) }),
    ]);
  const statusCounts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all]));
  const typeCounts = Object.fromEntries(byType.map((row) => [row.type, row._count._all]));
  const activeByStatus = Object.fromEntries(
    ACTIVE_STATUSES.map((status) => [status, statusCounts[status] ?? 0]),
  ) as Record<(typeof ACTIVE_STATUSES)[number], number>;
  return {
    active: Object.values(activeByStatus).reduce((sum, value) => sum + value, 0),
    byStatus: activeByStatus,
    byType: {
      [TicketType.INCIDENT]: typeCounts[TicketType.INCIDENT] ?? 0,
      [TicketType.SERVICE]: typeCounts[TicketType.SERVICE] ?? 0,
    },
    critical,
    unassigned,
    attention,
    sla: { breached, warning, dueToday },
  };
}

export async function getDashboard(actor: Actor) {
  const now = new Date();
  const scope = actor.role === UserRole.USER ? { reporterId: actor.userId } : {};
  const statuses = await prisma.ticket.groupBy({
    by: ['status'],
    where: scope,
    _count: { _all: true },
  });
  const counts = Object.fromEntries(statuses.map((s) => [s.status, s._count._all]));
  // Staff see recently updated work in progress; closed tickets are history.
  const recent = await prisma.ticket.findMany({
    where:
      actor.role === UserRole.USER ? scope : { ...scope, status: { not: TicketStatus.CLOSED } },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    include: { reporter: personSelect, assignee: personSelect },
  });
  const result: Record<string, unknown> = {
    tickets: {
      total: await prisma.ticket.count({ where: scope }),
      new: counts.NEW ?? 0,
      inProgress: counts.IN_PROGRESS ?? 0,
      waitingForUser: counts.WAITING_FOR_USER ?? 0,
      resolved: counts.RESOLVED ?? 0,
    },
    recentTickets: recent.map((ticket) => withSla(ticket, now)),
  };
  if (actor.role !== UserRole.USER) {
    result.tickets = {
      ...(result.tickets as object),
      critical: await prisma.ticket.count({ where: { ...scope, priority: 'CRITICAL' } }),
    };
    result.operations = await operations(now);
    // Most urgent first: earliest SLA deadline (breached ones lead).
    result.attentionTickets = (
      await prisma.ticket.findMany({
        where: slaWhere('ATTENTION', now),
        take: 8,
        orderBy: [{ slaDueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
        include: { reporter: personSelect, assignee: personSelect },
      })
    ).map((ticket) => withSla(ticket, now));
  }
  if (actor.role === UserRole.ADMIN)
    result.users = {
      users: await prisma.user.count({ where: { role: 'USER' } }),
      technicians: await prisma.user.count({ where: { role: 'TECHNICIAN' } }),
      admins: await prisma.user.count({ where: { role: 'ADMIN' } }),
    };
  return result;
}
