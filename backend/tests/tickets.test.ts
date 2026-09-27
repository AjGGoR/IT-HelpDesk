import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from './helpers/prisma-mock.js';
import {
  makeTicket,
  makeUser,
  ownerUser,
  otherUser,
  technicianUser,
  usersById,
} from './helpers/fixtures.js';
import { authHeader } from './helpers/auth.js';

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }));
import { app } from '../src/app.js';

beforeEach(() => {
  resetPrismaMock();
});

describe('ticket ownership and workflow', () => {
  it('lets a user create a ticket and records history', async () => {
    const ticket = makeTicket({ reporterId: ownerUser.id });
    prismaMock.ticket.create.mockResolvedValue(ticket);
    prismaMock.ticketHistory.create.mockResolvedValue({});
    const res = await request(app)
      .post('/api/tickets')
      .set(...authHeader(ownerUser))
      .send({
        title: 'Drukarka nie działa poprawnie',
        description: 'Opis dłuższy niż dziesięć znaków.',
        type: 'INCIDENT',
        category: 'HARDWARE',
        priority: 'MEDIUM',
      });
    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).toBe('HD-000001');
    expect(prismaMock.ticketHistory.create).toHaveBeenCalled();
  });

  it('scopes the ticket list to the requesting user', async () => {
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(0);
    await request(app)
      .get('/api/tickets')
      .set(...authHeader(ownerUser));
    expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ reporterId: ownerUser.id }) }),
    );
  });

  it("blocks a user from viewing another user's ticket", async () => {
    const ticket = makeTicket({ reporterId: otherUser.id });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    const res = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set(...authHeader(ownerUser));
    expect(res.status).toBe(403);
  });

  it('allows a technician to view any ticket', async () => {
    const ticket = makeTicket({ reporterId: otherUser.id });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.comment.findMany.mockResolvedValue([]);
    prismaMock.ticketHistory.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set(...authHeader(technicianUser));
    expect(res.status).toBe(200);
  });

  it('rejects a plain user changing ticket status', async () => {
    const ticket = makeTicket({ reporterId: ownerUser.id, status: 'NEW' });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(...authHeader(ownerUser))
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid status transition even for staff', async () => {
    const ticket = makeTicket({ status: 'NEW' });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(...authHeader(technicianUser))
      .send({ status: 'CLOSED' });
    expect(res.status).toBe(409);
  });

  it('records TICKET_RESOLVED when staff resolves through PATCH', async () => {
    const ticket = makeTicket({ status: 'IN_PROGRESS' });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.ticket.update.mockResolvedValue({
      ...ticket,
      status: 'RESOLVED',
      resolvedAt: new Date(),
    });
    prismaMock.ticketHistory.createMany.mockResolvedValue({ count: 1 });
    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set(...authHeader(technicianUser))
      .send({ status: 'RESOLVED', resolutionNote: 'Wymieniono toner.' });
    expect(res.status).toBe(200);
    expect(prismaMock.ticketHistory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ action: 'TICKET_RESOLVED' })]),
      }),
    );
  });

  it('rejects assignment attempts from a plain user', async () => {
    const ticket = makeTicket();
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/assign`)
      .set(...authHeader(ownerUser))
      .send({ assigneeId: technicianUser.id });
    expect(res.status).toBe(403);
  });

  it('rejects assigning an account that is not an active technician', async () => {
    const ticket = makeTicket();
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/assign`)
      .set(...authHeader(technicianUser))
      .send({ assigneeId: ownerUser.id });
    expect(res.status).toBe(422);
  });

  it('lets a technician assign an active technician to a ticket', async () => {
    const ticket = makeTicket();
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.ticket.update.mockResolvedValue({ ...ticket, assigneeId: technicianUser.id });
    prismaMock.ticketHistory.createMany.mockResolvedValue({});
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/assign`)
      .set(...authHeader(technicianUser))
      .send({ assigneeId: technicianUser.id });
    expect(res.status).toBe(200);
    expect(prismaMock.ticket.update).toHaveBeenCalled();
  });

  it('rejects assigning an inactive technician account', async () => {
    const inactiveTechnician = makeUser({
      id: '66666666-6666-4666-8666-666666666666',
      role: 'TECHNICIAN',
      isActive: false,
    });
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) =>
      where.id === inactiveTechnician.id
        ? inactiveTechnician
        : (usersById.get(where.id ?? '') ?? null),
    );
    const ticket = makeTicket();
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/assign`)
      .set(...authHeader(technicianUser))
      .send({ assigneeId: inactiveTechnician.id });
    expect(res.status).toBe(422);
  });

  describe('resolve', () => {
    it('rejects resolution from a plain user', async () => {
      const res = await request(app)
        .post(`/api/tickets/${makeTicket().id}/resolve`)
        .set(...authHeader(ownerUser));
      expect(res.status).toBe(403);
    });

    it('lets staff resolve a valid IN_PROGRESS ticket', async () => {
      const ticket = makeTicket({ status: 'IN_PROGRESS' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      prismaMock.ticket.update.mockResolvedValue({
        ...ticket,
        status: 'RESOLVED',
        resolvedAt: new Date(),
      });
      prismaMock.ticketHistory.create.mockResolvedValue({});
      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/resolve`)
        .set(...authHeader(technicianUser))
        .send({ resolutionNote: 'Wymieniono toner.' });
      expect(res.status).toBe(200);
    });

    it('rejects resolving a ticket from an invalid status', async () => {
      const ticket = makeTicket({ status: 'NEW' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/resolve`)
        .set(...authHeader(technicianUser))
        .send({ resolutionNote: 'Wymieniono toner.' });
      expect(res.status).toBe(409);
    });
  });

  describe('close', () => {
    it('rejects a non-owner user closing a ticket', async () => {
      const ticket = makeTicket({ reporterId: otherUser.id, status: 'RESOLVED' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/close`)
        .set(...authHeader(ownerUser));
      expect(res.status).toBe(403);
    });

    it('lets the owner close their own resolved ticket', async () => {
      const ticket = makeTicket({ reporterId: ownerUser.id, status: 'RESOLVED' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      prismaMock.ticket.update.mockResolvedValue({
        ...ticket,
        status: 'CLOSED',
        closedAt: new Date(),
      });
      prismaMock.ticketHistory.create.mockResolvedValue({});
      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/close`)
        .set(...authHeader(ownerUser));
      expect(res.status).toBe(200);
    });

    it('rejects closing a ticket that is not resolved', async () => {
      const ticket = makeTicket({ reporterId: ownerUser.id, status: 'IN_PROGRESS' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/close`)
        .set(...authHeader(ownerUser));
      expect(res.status).toBe(409);
    });

    it('lets staff close a resolved ticket owned by someone else', async () => {
      const ticket = makeTicket({ reporterId: otherUser.id, status: 'RESOLVED' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      prismaMock.ticket.update.mockResolvedValue({
        ...ticket,
        status: 'CLOSED',
        closedAt: new Date(),
      });
      prismaMock.ticketHistory.create.mockResolvedValue({});
      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/close`)
        .set(...authHeader(technicianUser));
      expect(res.status).toBe(200);
    });
  });

  describe('history', () => {
    it('lets the owner read the ticket history', async () => {
      const ticket = makeTicket({ reporterId: ownerUser.id });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      prismaMock.comment.findMany.mockResolvedValue([]);
      prismaMock.ticketHistory.findMany.mockResolvedValue([{ id: 'h1', action: 'TICKET_CREATED' }]);
      const res = await request(app)
        .get(`/api/tickets/${ticket.id}/history`)
        .set(...authHeader(ownerUser));
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });

    it("blocks a foreign user from reading a ticket's history", async () => {
      const ticket = makeTicket({ reporterId: otherUser.id });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      const res = await request(app)
        .get(`/api/tickets/${ticket.id}/history`)
        .set(...authHeader(ownerUser));
      expect(res.status).toBe(403);
    });

    it('lets staff read any ticket history', async () => {
      const ticket = makeTicket({ reporterId: otherUser.id });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      prismaMock.comment.findMany.mockResolvedValue([]);
      prismaMock.ticketHistory.findMany.mockResolvedValue([]);
      const res = await request(app)
        .get(`/api/tickets/${ticket.id}/history`)
        .set(...authHeader(technicianUser));
      expect(res.status).toBe(200);
    });
  });

  describe('patch permissions', () => {
    it('rejects a foreign user patching a ticket they do not own', async () => {
      const ticket = makeTicket({ reporterId: otherUser.id, status: 'NEW' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      const res = await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set(...authHeader(ownerUser))
        .send({ title: 'Zaktualizowany tytuł zgłoszenia' });
      expect(res.status).toBe(403);
    });

    it('lets the owner edit their own NEW ticket', async () => {
      const ticket = makeTicket({ reporterId: ownerUser.id, status: 'NEW' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      prismaMock.ticket.update.mockResolvedValue({
        ...ticket,
        title: 'Zaktualizowany tytuł zgłoszenia',
      });
      const res = await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set(...authHeader(ownerUser))
        .send({ title: 'Zaktualizowany tytuł zgłoszenia' });
      expect(res.status).toBe(200);
    });

    it('rejects the owner editing an IN_PROGRESS ticket', async () => {
      const ticket = makeTicket({ reporterId: ownerUser.id, status: 'IN_PROGRESS' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      const res = await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set(...authHeader(ownerUser))
        .send({ title: 'Zaktualizowany tytuł zgłoszenia' });
      expect(res.status).toBe(409);
    });

    it('rejects the owner editing a RESOLVED ticket', async () => {
      const ticket = makeTicket({ reporterId: ownerUser.id, status: 'RESOLVED' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      const res = await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set(...authHeader(ownerUser))
        .send({ title: 'Zaktualizowany tytuł zgłoszenia' });
      expect(res.status).toBe(409);
    });

    it('rejects a plain user setting assigneeId directly through PATCH', async () => {
      const ticket = makeTicket({ reporterId: ownerUser.id, status: 'NEW' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      const res = await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set(...authHeader(ownerUser))
        .send({ assigneeId: technicianUser.id });
      expect(res.status).toBe(403);
      expect(prismaMock.ticket.update).not.toHaveBeenCalled();
    });

    it('rejects a foreign user patching the priority of a ticket they do not own', async () => {
      const ticket = makeTicket({ reporterId: otherUser.id, status: 'NEW' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      const res = await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set(...authHeader(ownerUser))
        .send({ priority: 'HIGH' });
      expect(res.status).toBe(403);
      expect(prismaMock.ticket.update).not.toHaveBeenCalled();
    });

    it('rejects a foreign user patching the category of a ticket they do not own', async () => {
      const ticket = makeTicket({ reporterId: otherUser.id, status: 'NEW' });
      prismaMock.ticket.findUnique.mockResolvedValue(ticket);
      const res = await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set(...authHeader(ownerUser))
        .send({ category: 'SOFTWARE' });
      expect(res.status).toBe(403);
      expect(prismaMock.ticket.update).not.toHaveBeenCalled();
    });
  });

  describe('invalid or missing ticket ids', () => {
    it('returns 422 INVALID_ID for a malformed ticket id', async () => {
      const res = await request(app)
        .get('/api/tickets/not-a-valid-uuid')
        .set(...authHeader(technicianUser));
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_ID');
      expect(prismaMock.ticket.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 TICKET_NOT_FOUND for a well-formed but non-existent ticket id', async () => {
      prismaMock.ticket.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/tickets/99999999-9999-4999-8999-999999999999')
        .set(...authHeader(technicianUser));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TICKET_NOT_FOUND');
    });
  });

  describe('listTickets query building', () => {
    it('passes a case-insensitive search across ticketNumber/title/description into the Prisma where clause', async () => {
      prismaMock.ticket.findMany.mockResolvedValue([]);
      prismaMock.ticket.count.mockResolvedValue(0);
      await request(app)
        .get('/api/tickets?search=printer')
        .set(...authHeader(technicianUser));
      expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              {
                OR: [
                  { ticketNumber: { contains: 'printer', mode: 'insensitive' } },
                  { title: { contains: 'printer', mode: 'insensitive' } },
                  { description: { contains: 'printer', mode: 'insensitive' } },
                ],
              },
            ],
          }),
        }),
      );
    });

    it('applies status/priority/category filters to the Prisma where clause', async () => {
      prismaMock.ticket.findMany.mockResolvedValue([]);
      prismaMock.ticket.count.mockResolvedValue(0);
      await request(app)
        .get('/api/tickets?status=IN_PROGRESS&priority=HIGH&category=SOFTWARE')
        .set(...authHeader(technicianUser));
      expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            category: 'SOFTWARE',
          }),
        }),
      );
    });

    it('translates page/pageSize into Prisma skip/take', async () => {
      prismaMock.ticket.findMany.mockResolvedValue([]);
      prismaMock.ticket.count.mockResolvedValue(0);
      const res = await request(app)
        .get('/api/tickets?page=3&pageSize=5')
        .set(...authHeader(technicianUser));
      expect(res.status).toBe(200);
      expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
      expect(res.body.pagination).toEqual({ page: 3, pageSize: 5, total: 0, totalPages: 0 });
    });

    it('defaults to page 1 with a pageSize of 20 when no pagination params are given', async () => {
      prismaMock.ticket.findMany.mockResolvedValue([]);
      prismaMock.ticket.count.mockResolvedValue(0);
      await request(app)
        .get('/api/tickets')
        .set(...authHeader(technicianUser));
      expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('sorts by the requested sortBy/sortOrder instead of the default updatedAt desc', async () => {
      prismaMock.ticket.findMany.mockResolvedValue([]);
      prismaMock.ticket.count.mockResolvedValue(0);
      await request(app)
        .get('/api/tickets?sortBy=priority&sortOrder=asc')
        .set(...authHeader(technicianUser));
      expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { priority: 'asc' } }),
      );
    });

    it('defaults to sorting by updatedAt desc when no sort params are given', async () => {
      prismaMock.ticket.findMany.mockResolvedValue([]);
      prismaMock.ticket.count.mockResolvedValue(0);
      await request(app)
        .get('/api/tickets')
        .set(...authHeader(technicianUser));
      expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { updatedAt: 'desc' } }),
      );
    });
  });
});
