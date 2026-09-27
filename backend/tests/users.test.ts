import { Prisma } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from './helpers/prisma-mock.js';
import { adminUser, makeUser, ownerUser, technicianUser } from './helpers/fixtures.js';
import { authHeader } from './helpers/auth.js';

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }));
import { app } from '../src/app.js';

beforeEach(() => {
  resetPrismaMock();
});

describe('user administration', () => {
  it('forbids non-admins from listing users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set(...authHeader(technicianUser));
    expect(res.status).toBe(403);
  });

  it('forbids non-admins from creating users', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(...authHeader(technicianUser))
      .send({
        email: 'blocked@helpdesk.test',
        password: 'Password123!',
        firstName: 'Jan',
        lastName: 'Nowak',
        role: 'USER',
      });
    expect(res.status).toBe(403);
  });

  it('forbids non-admins from patching a user profile', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminUser.id}`)
      .set(...authHeader(technicianUser))
      .send({ firstName: 'Zmieniony' });
    expect(res.status).toBe(403);
  });

  it('forbids non-admins from changing a role', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminUser.id}/role`)
      .set(...authHeader(technicianUser))
      .send({ role: 'USER' });
    expect(res.status).toBe(403);
  });

  it('forbids non-admins from changing account status', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminUser.id}/status`)
      .set(...authHeader(technicianUser))
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });

  it('forbids a plain USER from listing users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set(...authHeader(ownerUser));
    expect(res.status).toBe(403);
  });

  it('forbids a plain USER from creating users', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(...authHeader(ownerUser))
      .send({
        email: 'blocked@helpdesk.test',
        password: 'Password123!',
        firstName: 'Jan',
        lastName: 'Nowak',
        role: 'USER',
      });
    expect(res.status).toBe(403);
  });

  it('forbids a plain USER from patching a user profile', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminUser.id}`)
      .set(...authHeader(ownerUser))
      .send({ firstName: 'Zmieniony' });
    expect(res.status).toBe(403);
  });

  it('forbids a plain USER from changing a role', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminUser.id}/role`)
      .set(...authHeader(ownerUser))
      .send({ role: 'USER' });
    expect(res.status).toBe(403);
  });

  it('forbids a plain USER from changing account status', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminUser.id}/status`)
      .set(...authHeader(ownerUser))
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });

  it('lets admins list users without exposing password hashes', async () => {
    prismaMock.user.findMany.mockResolvedValue([adminUser, technicianUser]);
    const res = await request(app)
      .get('/api/users')
      .set(...authHeader(adminUser));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].passwordHash).toBeUndefined();
  });

  it('rejects demoting the last active administrator', async () => {
    prismaMock.user.count.mockResolvedValue(1);
    const res = await request(app)
      .patch(`/api/users/${adminUser.id}/role`)
      .set(...authHeader(adminUser))
      .send({ role: 'TECHNICIAN' });
    expect(res.status).toBe(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects deactivating the final active administrator', async () => {
    prismaMock.user.count.mockResolvedValue(1);
    const res = await request(app)
      .patch(`/api/users/${adminUser.id}/status`)
      .set(...authHeader(adminUser))
      .send({ isActive: false });
    expect(res.status).toBe(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('allows demoting an admin when another active admin remains', async () => {
    prismaMock.user.count.mockResolvedValue(2);
    prismaMock.user.update.mockResolvedValue({ ...adminUser, role: 'TECHNICIAN' });
    const res = await request(app)
      .patch(`/api/users/${adminUser.id}/role`)
      .set(...authHeader(adminUser))
      .send({ role: 'TECHNICIAN' });
    expect(res.status).toBe(200);
  });

  it('creates a new user and rejects a duplicate email', async () => {
    const created = makeUser({ id: 'new-user-id', email: 'new@helpdesk.test' });
    prismaMock.user.findUnique.mockImplementation(
      async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email) return null;
        return where.id === adminUser.id ? adminUser : null;
      },
    );
    prismaMock.user.create.mockResolvedValue(created);
    const res = await request(app)
      .post('/api/users')
      .set(...authHeader(adminUser))
      .send({
        email: 'new@helpdesk.test',
        password: 'Password123!',
        firstName: 'Jan',
        lastName: 'Nowak',
        role: 'USER',
      });
    expect(res.status).toBe(201);
    expect(res.body.user.passwordHash).toBeUndefined();

    prismaMock.user.findUnique.mockImplementation(
      async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email) return adminUser;
        return where.id === adminUser.id ? adminUser : null;
      },
    );
    const dup = await request(app)
      .post('/api/users')
      .set(...authHeader(adminUser))
      .send({
        email: adminUser.email,
        password: 'Password123!',
        firstName: 'Jan',
        lastName: 'Nowak',
        role: 'USER',
      });
    expect(dup.status).toBe(409);
  });

  it('rejects patching a user with an email that already belongs to another user', async () => {
    prismaMock.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: '6.12.0' },
      ),
    );
    const res = await request(app)
      .patch(`/api/users/${technicianUser.id}`)
      .set(...authHeader(adminUser))
      .send({ email: adminUser.email });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('lowercases the email when patching a user, matching creation behavior', async () => {
    const updated = { ...technicianUser, email: 'new.email@helpdesk.test' };
    prismaMock.user.update.mockResolvedValue(updated);
    const res = await request(app)
      .patch(`/api/users/${technicianUser.id}`)
      .set(...authHeader(adminUser))
      .send({ email: 'New.Email@Helpdesk.TEST' });
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'new.email@helpdesk.test' }),
      }),
    );
    expect(res.body.user.email).toBe('new.email@helpdesk.test');
  });
});
