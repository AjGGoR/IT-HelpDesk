import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from './helpers/prisma-mock.js';

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }));
import {
  backfillMissingSlaDueDates,
  calculateSlaDueAt,
  computeSla,
  isPriorityAllowed,
  slaTargetMinutes,
} from '../src/services/sla.service.js';

beforeEach(() => {
  resetPrismaMock();
});

// Mon 2026-09-21 08:00 Europe/Warsaw (CEST).
const MONDAY_8 = new Date('2026-09-21T06:00:00Z');
const hoursLater = (from: Date, hours: number) => new Date(from.getTime() + hours * 3_600_000);

const ticket = (overrides: Partial<Parameters<typeof computeSla>[0]> = {}) => ({
  type: 'INCIDENT' as const,
  priority: 'MEDIUM' as const,
  status: 'IN_PROGRESS' as const,
  createdAt: MONDAY_8,
  resolvedAt: null,
  closedAt: null,
  slaDueAt: null,
  ...overrides,
});

describe('SLA targets', () => {
  it('matches the agreed target table in working hours', () => {
    const hours = (
      type: 'SERVICE' | 'INCIDENT',
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    ) => slaTargetMinutes(type, priority) / 60;
    expect(hours('SERVICE', 'LOW')).toBe(80);
    expect(hours('SERVICE', 'MEDIUM')).toBe(40);
    expect(hours('SERVICE', 'HIGH')).toBe(24);
    expect(hours('INCIDENT', 'LOW')).toBe(56);
    expect(hours('INCIDENT', 'MEDIUM')).toBe(40);
    expect(hours('INCIDENT', 'HIGH')).toBe(24);
    expect(hours('INCIDENT', 'CRITICAL')).toBe(24);
  });

  it('does not allow CRITICAL for services', () => {
    expect(isPriorityAllowed('SERVICE', 'CRITICAL')).toBe(false);
    expect(isPriorityAllowed('INCIDENT', 'CRITICAL')).toBe(true);
    expect(() => slaTargetMinutes('SERVICE', 'CRITICAL')).toThrow();
  });

  it('computes a critical incident deadline as 24 working hours (3 working days)', () => {
    // Mon 08:00 + 24 working hours -> Wed 16:00
    expect(calculateSlaDueAt(MONDAY_8, 'INCIDENT', 'CRITICAL')).toEqual(
      new Date('2026-09-23T14:00:00Z'),
    );
  });
});

describe('computeSla', () => {
  it('is ON_TRACK with more than 24 working hours left', () => {
    const sla = computeSla(ticket(), hoursLater(MONDAY_8, 1));
    expect(sla).toMatchObject({ state: 'ON_TRACK', running: true, targetMinutes: 2400 });
    expect(sla!.remainingMinutes).toBe(2400 - 60);
    expect(sla!.dueAt).toBe('2026-09-25T14:00:00.000Z');
  });

  it('warns when less than 24 working hours remain', () => {
    // MEDIUM = 40h, due Fri 16:00. Tue 16:00 -> 24h left (not yet), Wed 09:00 -> 23h left.
    expect(computeSla(ticket(), new Date('2026-09-22T14:00:00Z'))!.state).toBe('ON_TRACK');
    const sla = computeSla(ticket(), new Date('2026-09-23T07:00:00Z'))!;
    expect(sla.state).toBe('WARNING');
    expect(sla.remainingMinutes).toBe(23 * 60);
  });

  it('warns a CRITICAL incident only at 4 working hours remaining', () => {
    const critical = ticket({ priority: 'CRITICAL' });
    // Due Wed 16:00. Wed 11:00 -> 5h left, Wed 12:30 -> 3.5h left.
    const early = computeSla(critical, new Date('2026-09-23T09:00:00Z'))!;
    expect(early).toMatchObject({ state: 'ON_TRACK', warningThresholdMinutes: 240 });
    expect(computeSla(critical, new Date('2026-09-23T10:30:00Z'))!.state).toBe('WARNING');
  });

  it('is BREACHED once the deadline has passed, with negative remaining time', () => {
    const sla = computeSla(ticket(), new Date('2026-09-28T07:00:00Z'))!; // Mon+1 09:00
    expect(sla.state).toBe('BREACHED');
    expect(sla.remainingMinutes).toBe(-60);
  });

  it('flags tickets due before the end of the current working day', () => {
    const critical = ticket({ priority: 'CRITICAL' });
    expect(computeSla(critical, new Date('2026-09-23T08:00:00Z'))!.dueToday).toBe(true);
    expect(computeSla(critical, new Date('2026-09-22T08:00:00Z'))!.dueToday).toBe(false);
  });

  it('stops the clock for resolved tickets and reports whether the SLA was met', () => {
    const met = computeSla(
      ticket({ status: 'RESOLVED', resolvedAt: hoursLater(MONDAY_8, 2) }),
      new Date('2026-10-30T10:00:00Z'),
    )!;
    expect(met).toMatchObject({ state: 'MET', running: false, remainingMinutes: null });
    const late = computeSla(
      ticket({ status: 'CLOSED', resolvedAt: new Date('2026-09-29T08:00:00Z') }),
      new Date('2026-10-30T10:00:00Z'),
    )!;
    expect(late.state).toBe('BREACHED');
  });

  it('prefers the stored deadline over recomputation', () => {
    const stored = new Date('2026-09-21T10:00:00Z');
    expect(computeSla(ticket({ slaDueAt: stored }), MONDAY_8)!.dueAt).toBe(stored.toISOString());
  });
});

describe('backfillMissingSlaDueDates', () => {
  it('fills deadlines from createdAt/type/priority and only touches rows still missing one', async () => {
    prismaMock.ticket.findMany
      .mockResolvedValueOnce([
        { id: 'a', createdAt: MONDAY_8, type: 'INCIDENT', priority: 'CRITICAL' },
        { id: 'b', createdAt: MONDAY_8, type: 'SERVICE', priority: 'LOW' },
      ])
      .mockResolvedValueOnce([]);
    prismaMock.ticket.updateMany.mockResolvedValue({ count: 1 });
    await expect(backfillMissingSlaDueDates()).resolves.toBe(2);
    expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 'a', slaDueAt: null },
      data: { slaDueAt: new Date('2026-09-23T14:00:00Z') },
    });
    // SERVICE LOW = 10 working days: Mon 09-21 08:00 -> Fri 10-02 16:00.
    expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 'b', slaDueAt: null },
      data: { slaDueAt: new Date('2026-10-02T14:00:00Z') },
    });
  });

  it('does nothing when every ticket already has a deadline', async () => {
    prismaMock.ticket.findMany.mockResolvedValueOnce([]);
    await expect(backfillMissingSlaDueDates()).resolves.toBe(0);
    expect(prismaMock.ticket.updateMany).not.toHaveBeenCalled();
  });
});
