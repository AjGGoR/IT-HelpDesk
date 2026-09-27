import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from './helpers/prisma-mock.js';
import { makeTicket, ownerUser, otherUser, technicianUser } from './helpers/fixtures.js';
import { authHeader } from './helpers/auth.js';

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }));
import { app } from '../src/app.js';

beforeEach(() => {
  resetPrismaMock();
});

describe('ticket comments', () => {
  it('lets the ticket owner add a comment and records history', async () => {
    const ticket = makeTicket({ reporterId: ownerUser.id });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.comment.create.mockResolvedValue({
      id: 'comment-1',
      content: 'Sprawdziłem ponownie, nadal nie działa.',
      authorId: ownerUser.id,
    });
    prismaMock.ticketHistory.create.mockResolvedValue({});
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(...authHeader(ownerUser))
      .send({ content: 'Sprawdziłem ponownie, nadal nie działa.' });
    expect(res.status).toBe(201);
    expect(prismaMock.ticketHistory.create).toHaveBeenCalled();
  });

  it("blocks a user from commenting on someone else's ticket", async () => {
    const ticket = makeTicket({ reporterId: otherUser.id });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(...authHeader(ownerUser))
      .send({ content: 'Próba dodania komentarza do cudzego zgłoszenia.' });
    expect(res.status).toBe(403);
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
  });

  it('lets the owner read the comment list', async () => {
    const ticket = makeTicket({ reporterId: ownerUser.id });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.comment.findMany.mockResolvedValue([
      { id: 'c1', content: 'Witam', authorId: ownerUser.id },
    ]);
    prismaMock.ticketHistory.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set(...authHeader(ownerUser));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it("blocks a foreign user from reading a ticket's comments", async () => {
    const ticket = makeTicket({ reporterId: otherUser.id });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    const res = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set(...authHeader(ownerUser));
    expect(res.status).toBe(403);
  });

  it('lets staff read comments on any ticket', async () => {
    const ticket = makeTicket({ reporterId: otherUser.id });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.comment.findMany.mockResolvedValue([]);
    prismaMock.ticketHistory.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set(...authHeader(technicianUser));
    expect(res.status).toBe(200);
  });

  it('lets staff add a comment to a ticket they do not own', async () => {
    const ticket = makeTicket({ reporterId: otherUser.id });
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.comment.create.mockResolvedValue({
      id: 'comment-2',
      content: 'Zajmuję się tym zgłoszeniem.',
      authorId: technicianUser.id,
    });
    prismaMock.ticketHistory.create.mockResolvedValue({});
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(...authHeader(technicianUser))
      .send({ content: 'Zajmuję się tym zgłoszeniem.' });
    expect(res.status).toBe(201);
  });
});
