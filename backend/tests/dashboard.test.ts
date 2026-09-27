import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from './helpers/prisma-mock.js';
import { adminUser, ownerUser, technicianUser } from './helpers/fixtures.js';
import { authHeader } from './helpers/auth.js';

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }));
import { app } from '../src/app.js';

beforeEach(() => {
  resetPrismaMock();
});

describe('dashboard', () => {
  it('limits a user dashboard to their own ticket counts', async () => {
    prismaMock.ticket.groupBy.mockResolvedValue([{ status: 'NEW', _count: { _all: 2 } }]);
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(2);
    const res = await request(app)
      .get('/api/dashboard')
      .set(...authHeader(ownerUser));
    expect(res.status).toBe(200);
    expect(res.body.tickets.new).toBe(2);
    expect(res.body.attentionTickets).toBeUndefined();
    expect(res.body.users).toBeUndefined();
    expect(prismaMock.ticket.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ reporterId: ownerUser.id }) }),
    );
  });

  it('gives admins attention tickets and user role counts', async () => {
    prismaMock.ticket.groupBy.mockResolvedValue([]);
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(0);
    prismaMock.user.count.mockResolvedValue(1);
    const res = await request(app)
      .get('/api/dashboard')
      .set(...authHeader(adminUser));
    expect(res.status).toBe(200);
    expect(res.body.attentionTickets).toBeDefined();
    expect(res.body.users).toEqual({ users: 1, technicians: 1, admins: 1 });
  });

  it('gives technicians attention tickets but not the admin-only user statistics', async () => {
    prismaMock.ticket.groupBy.mockResolvedValue([]);
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(0);
    const res = await request(app)
      .get('/api/dashboard')
      .set(...authHeader(technicianUser));
    expect(res.status).toBe(200);
    expect(res.body.attentionTickets).toBeDefined();
    expect(res.body.users).toBeUndefined();
  });

  it('rejects an unauthenticated dashboard request', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });
});
