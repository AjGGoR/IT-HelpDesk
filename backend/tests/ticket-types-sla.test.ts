import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from './helpers/prisma-mock.js';
import { adminUser, makeTicket, otherUser, ownerUser, technicianUser } from './helpers/fixtures.js';
import { authHeader } from './helpers/auth.js';

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }));
import { app } from '../src/app.js';

// Mon 2026-09-21 10:00 Europe/Warsaw.
const NOW = new Date('2026-09-21T08:00:00Z');

beforeEach(() => {
  resetPrismaMock();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const createBody = {
  title: 'Nowy laptop',
  description: 'Potrzebny laptop dla nowego pracownika.',
  category: 'HARDWARE',
};

describe('ticket type and priority rules', () => {
  it('requires a ticket type on creation', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set(...authHeader(ownerUser))
      .send({ ...createBody, priority: 'LOW' });
    expect(res.status).toBe(422);
    expect(prismaMock.ticket.create).not.toHaveBeenCalled();
  });

  it('rejects a CRITICAL service', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set(...authHeader(ownerUser))
      .send({ ...createBody, type: 'SERVICE', priority: 'CRITICAL' });
    expect(res.status).toBe(422);
    expect(prismaMock.ticket.create).not.toHaveBeenCalled();
  });

  it('creates a CRITICAL incident with a server-calculated SLA deadline', async () => {
    prismaMock.ticket.create.mockImplementation(async ({ data }: { data: object }) =>
      makeTicket({ ...data }),
    );
    prismaMock.ticketHistory.create.mockResolvedValue({});
    const res = await request(app)
      .post('/api/tickets')
      .set(...authHeader(ownerUser))
      .send({ ...createBody, type: 'INCIDENT', priority: 'CRITICAL', slaDueAt: '2030-01-01' });
    expect(res.status).toBe(201);
    // Mon 10:00 + 24 working hours -> Thu 10:00 CEST; client-supplied slaDueAt is ignored.
    const data = prismaMock.ticket.create.mock.calls[0][0].data;
    expect(data.slaDueAt).toEqual(new Date('2026-09-24T08:00:00Z'));
    expect(data.reporterId).toBe(ownerUser.id);
    expect(res.body.type).toBe('INCIDENT');
    expect(res.body.sla).toMatchObject({
      dueAt: '2026-09-24T08:00:00.000Z',
      state: 'ON_TRACK',
      remainingMinutes: 24 * 60,
      warningThresholdMinutes: 240,
    });
  });

  it('rejects raising a service to CRITICAL', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(
      makeTicket({ type: 'SERVICE', status: 'IN_PROGRESS' }),
    );
    const res = await request(app)
      .patch(`/api/tickets/${makeTicket().id}`)
      .set(...authHeader(technicianUser))
      .send({ priority: 'CRITICAL' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PRIORITY_NOT_ALLOWED');
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('recalculates the SLA deadline from creation time when priority changes', async () => {
    const ticket = makeTicket({ status: 'IN_PROGRESS', createdAt: NOW, priority: 'LOW' });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.ticket.update.mockResolvedValue(ticket);
    prismaMock.ticketHistory.createMany.mockResolvedValue({ count: 1 });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(...authHeader(technicianUser))
      .send({ priority: 'HIGH' });
    expect(res.status).toBe(200);
    expect(prismaMock.ticket.update.mock.calls[0][0].data.slaDueAt).toEqual(
      new Date('2026-09-24T08:00:00Z'),
    );
  });

  it('does not let the requester change priority (and with it the SLA) after creation', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(makeTicket({ status: 'NEW' }));
    const res = await request(app)
      .patch(`/api/tickets/${makeTicket().id}`)
      .set(...authHeader(ownerUser))
      .send({ priority: 'CRITICAL' });
    expect(res.status).toBe(403);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it.each(['RESOLVED', 'CLOSED'])(
    'locks the priority (and SLA outcome) of a %s ticket',
    async (status) => {
      prismaMock.ticket.findUnique.mockResolvedValue(makeTicket({ status, priority: 'HIGH' }));
      const res = await request(app)
        .patch(`/api/tickets/${makeTicket().id}`)
        .set(...authHeader(technicianUser))
        .send({ priority: 'LOW' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PRIORITY_LOCKED');
      expect(prismaMock.ticket.update).not.toHaveBeenCalled();
    },
  );

  it('ignores server-owned fields sent on creation', async () => {
    prismaMock.ticket.create.mockImplementation(async ({ data }: { data: object }) =>
      makeTicket({ ...data }),
    );
    prismaMock.ticketHistory.create.mockResolvedValue({});
    const res = await request(app)
      .post('/api/tickets')
      .set(...authHeader(ownerUser))
      .send({
        ...createBody,
        type: 'SERVICE',
        priority: 'LOW',
        resolutionNote: 'x',
        status: 'CLOSED',
        reporterId: otherUser.id,
        assigneeId: technicianUser.id,
      });
    expect(res.status).toBe(201);
    const data = prismaMock.ticket.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('resolutionNote');
    expect(data).not.toHaveProperty('status');
    expect(data).not.toHaveProperty('assigneeId');
    expect(data.reporterId).toBe(ownerUser.id);
  });

  it('does not allow changing the ticket type after creation', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(makeTicket({ status: 'NEW' }));
    const res = await request(app)
      .patch(`/api/tickets/${makeTicket().id}`)
      .set(...authHeader(ownerUser))
      .send({ type: 'SERVICE' });
    expect(res.status).toBe(422);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });
});

describe('resolution note', () => {
  const inProgress = () => makeTicket({ status: 'IN_PROGRESS' });

  it.each([{}, { resolutionNote: '' }, { resolutionNote: '   ' }])(
    'rejects resolving without a non-empty note (%j)',
    async (body) => {
      prismaMock.ticket.findUnique.mockResolvedValue(inProgress());
      const res = await request(app)
        .post(`/api/tickets/${inProgress().id}/resolve`)
        .set(...authHeader(technicianUser))
        .send(body);
      expect(res.status).toBe(422);
      expect(prismaMock.ticket.update).not.toHaveBeenCalled();
    },
  );

  it('rejects resolving through PATCH without a note', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(inProgress());
    const res = await request(app)
      .patch(`/api/tickets/${inProgress().id}`)
      .set(...authHeader(technicianUser))
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(422);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('stores the trimmed note when staff resolve', async () => {
    const ticket = inProgress();
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.ticket.update.mockImplementation(async ({ data }: { data: object }) => ({
      ...ticket,
      ...data,
    }));
    prismaMock.ticketHistory.create.mockResolvedValue({});
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/resolve`)
      .set(...authHeader(adminUser))
      .send({ resolutionNote: '  Zrestartowano usługę druku.  ' });
    expect(res.status).toBe(200);
    expect(prismaMock.ticket.update.mock.calls[0][0].data).toMatchObject({
      status: 'RESOLVED',
      resolutionNote: 'Zrestartowano usługę druku.',
    });
    expect(res.body.resolutionNote).toBe('Zrestartowano usługę druku.');
    expect(res.body.sla.running).toBe(false);
  });

  it('does not let the requester write a resolution note', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(makeTicket({ status: 'NEW' }));
    const withoutStatus = await request(app)
      .patch(`/api/tickets/${makeTicket().id}`)
      .set(...authHeader(ownerUser))
      .send({ resolutionNote: 'Samo się naprawiło.' });
    expect(withoutStatus.status).toBe(422);
    const withStatus = await request(app)
      .patch(`/api/tickets/${makeTicket().id}`)
      .set(...authHeader(ownerUser))
      .send({ status: 'RESOLVED', resolutionNote: 'Samo się naprawiło.' });
    expect(withStatus.status).toBe(403);
    const resolve = await request(app)
      .post(`/api/tickets/${makeTicket().id}/resolve`)
      .set(...authHeader(ownerUser))
      .send({ resolutionNote: 'Samo się naprawiło.' });
    expect(resolve.status).toBe(403);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('does not let staff overwrite a note outside of resolving', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(makeTicket({ status: 'RESOLVED' }));
    const res = await request(app)
      .patch(`/api/tickets/${makeTicket().id}`)
      .set(...authHeader(technicianUser))
      .send({ resolutionNote: 'Nowa treść.' });
    expect(res.status).toBe(422);
    expect(prismaMock.ticket.update).not.toHaveBeenCalled();
  });

  it('shows the note of a closed ticket to its requester', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(
      makeTicket({ status: 'CLOSED', resolutionNote: 'Wymieniono kabel.', closedAt: NOW }),
    );
    prismaMock.comment.findMany.mockResolvedValue([]);
    prismaMock.ticketHistory.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get(`/api/tickets/${makeTicket().id}`)
      .set(...authHeader(ownerUser));
    expect(res.status).toBe(200);
    expect(res.body.resolutionNote).toBe('Wymieniono kabel.');
  });

  it("hides another user's ticket, including its note", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(
      makeTicket({ reporterId: otherUser.id, resolutionNote: 'Poufne.' }),
    );
    const res = await request(app)
      .get(`/api/tickets/${makeTicket().id}`)
      .set(...authHeader(ownerUser));
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('Poufne');
  });

  it('clears the note on reopen and keeps the previous one in history', async () => {
    const ticket = makeTicket({ status: 'RESOLVED', resolutionNote: 'Stary opis.' });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.ticket.update.mockResolvedValue({ ...ticket, status: 'IN_PROGRESS' });
    prismaMock.ticketHistory.createMany.mockResolvedValue({ count: 1 });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(...authHeader(technicianUser))
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(prismaMock.ticket.update.mock.calls[0][0].data.resolutionNote).toBeNull();
    expect(prismaMock.ticketHistory.createMany.mock.calls[0][0].data[0].description).toContain(
      'Stary opis.',
    );
  });
});

describe('ticket list scope and filters', () => {
  const whereOf = () => prismaMock.ticket.findMany.mock.calls[0][0].where;
  beforeEach(() => {
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(0);
  });

  it('excludes CLOSED tickets by default', async () => {
    await request(app)
      .get('/api/tickets')
      .set(...authHeader(technicianUser));
    expect(whereOf().status).toEqual({ not: 'CLOSED' });
  });

  it('includes CLOSED tickets on request or when filtering by that status', async () => {
    await request(app)
      .get('/api/tickets?includeClosed=true')
      .set(...authHeader(technicianUser));
    expect(whereOf().status).toBeUndefined();
    prismaMock.ticket.findMany.mockClear();
    await request(app)
      .get('/api/tickets?status=CLOSED')
      .set(...authHeader(technicianUser));
    expect(whereOf().status).toBe('CLOSED');
  });

  it('filters by type, unassigned and breached SLA while keeping the user scope', async () => {
    await request(app)
      .get('/api/tickets?type=SERVICE&unassigned=true&sla=BREACHED')
      .set(...authHeader(ownerUser));
    expect(whereOf()).toMatchObject({
      reporterId: ownerUser.id,
      type: 'SERVICE',
      assigneeId: null,
      AND: [
        {
          status: { in: ['NEW', 'IN_PROGRESS', 'WAITING_FOR_USER'] },
          slaDueAt: { lte: NOW },
        },
      ],
    });
  });

  it('keeps the attention filter inside the requesting user scope', async () => {
    await request(app)
      .get('/api/tickets?sla=ATTENTION')
      .set(...authHeader(ownerUser));
    const where = whereOf();
    expect(where.reporterId).toBe(ownerUser.id);
    expect(where.OR).toBeUndefined();
    expect(where.AND[0].OR).toHaveLength(3);
  });

  it('sorts by SLA deadline with missing deadlines last', async () => {
    await request(app)
      .get('/api/tickets?sortBy=slaDueAt&sortOrder=asc')
      .set(...authHeader(technicianUser));
    expect(prismaMock.ticket.findMany.mock.calls[0][0].orderBy).toEqual({
      slaDueAt: { sort: 'asc', nulls: 'last' },
    });
  });

  it.each(['sla=LATE', 'includeClosed=yes', 'type=PROBLEM', 'unassigned=1'])(
    'rejects an invalid filter (%s)',
    async (query) => {
      const res = await request(app)
        .get(`/api/tickets?${query}`)
        .set(...authHeader(technicianUser));
      expect(res.status).toBe(422);
    },
  );

  it('returns SLA details with every listed ticket', async () => {
    prismaMock.ticket.findMany.mockResolvedValue([
      makeTicket({ slaDueAt: new Date('2026-09-18T08:00:00Z'), status: 'IN_PROGRESS' }),
    ]);
    prismaMock.ticket.count.mockResolvedValue(1);
    const res = await request(app)
      .get('/api/tickets')
      .set(...authHeader(technicianUser));
    expect(res.body.items[0].sla).toMatchObject({ state: 'BREACHED', running: true });
    expect(res.body.items[0].sla.remainingMinutes).toBeLessThan(0);
  });
});

describe('staff dashboard', () => {
  beforeEach(() => {
    prismaMock.ticket.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
      by[0] === 'type'
        ? [
            { type: 'INCIDENT', _count: { _all: 3 } },
            { type: 'SERVICE', _count: { _all: 2 } },
          ]
        : [
            { status: 'NEW', _count: { _all: 2 } },
            { status: 'IN_PROGRESS', _count: { _all: 2 } },
            { status: 'RESOLVED', _count: { _all: 1 } },
          ],
    );
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(1);
  });

  it('returns active operational metrics for technicians', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set(...authHeader(technicianUser));
    expect(res.status).toBe(200);
    expect(res.body.operations).toEqual({
      active: 5,
      byStatus: { NEW: 2, IN_PROGRESS: 2, WAITING_FOR_USER: 0, RESOLVED: 1 },
      byType: { INCIDENT: 3, SERVICE: 2 },
      critical: 1,
      unassigned: 1,
      attention: 1,
      sla: { breached: 1, warning: 1, dueToday: 1 },
    });
    // Operational counts are limited to non-closed tickets.
    const groupWhere = prismaMock.ticket.groupBy.mock.calls
      .filter(([args]: [{ by: string[] }]) => args.by[0] === 'type')
      .map(([args]: [{ where: unknown }]) => args.where);
    expect(groupWhere).toEqual([{ status: { not: 'CLOSED' } }]);
  });

  it('selects only public person fields for dashboard ticket queues', async () => {
    await request(app)
      .get('/api/dashboard')
      .set(...authHeader(adminUser));
    for (const [args] of prismaMock.ticket.findMany.mock.calls)
      for (const relation of ['reporter', 'assignee'])
        expect(args.include[relation]).toEqual({
          select: { id: true, firstName: true, lastName: true },
        });
  });

  it('excludes closed tickets from the staff recent-tickets list', async () => {
    await request(app)
      .get('/api/dashboard')
      .set(...authHeader(technicianUser));
    const recentCall = prismaMock.ticket.findMany.mock.calls.find(
      ([args]: [{ orderBy: unknown }]) =>
        JSON.stringify(args.orderBy) === JSON.stringify({ updatedAt: 'desc' }),
    );
    expect(recentCall[0].where).toEqual({ status: { not: 'CLOSED' } });
  });

  it('does not expose operational metrics to a plain user', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set(...authHeader(ownerUser));
    expect(res.status).toBe(200);
    expect(res.body.operations).toBeUndefined();
    expect(res.body.attentionTickets).toBeUndefined();
  });
});
