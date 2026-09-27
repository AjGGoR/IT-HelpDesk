import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), queryRaw: vi.fn() }));
vi.mock('../src/config/prisma.js', () => ({
  prisma: { user: { findUnique: mocks.findUnique }, $queryRaw: mocks.queryRaw },
}));
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { signToken } from '../src/middleware/auth.js';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@helpdesk.test',
  passwordHash: '',
  firstName: 'Anna',
  lastName: 'Administrator',
  role: 'ADMIN' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
describe('auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([{ value: 1 }]);
  });
  it('logs in an active account without returning passwordHash', async () => {
    user.passwordHash = await bcrypt.hash('Helpdesk123!', 4);
    mocks.findUnique.mockResolvedValue(user);
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Helpdesk123!' });
    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.passwordHash).toBeUndefined();
  });
  it('rejects invalid credentials and unauthenticated requests', async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'none@test.test', password: 'WrongPassword1!' })
      ).status,
    ).toBe(401);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });
  it('rejects malformed bearer token and accepts /me with valid token', async () => {
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer no')).status).toBe(
      401,
    );
    user.passwordHash = await bcrypt.hash('Helpdesk123!', 4);
    mocks.findUnique.mockResolvedValue(user);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Helpdesk123!' });
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(user.email);
  });
  it('rejects login for a deactivated account', async () => {
    mocks.findUnique.mockResolvedValue({ ...user, isActive: false });
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Helpdesk123!' });
    expect(response.status).toBe(401);
  });
  it('rejects a valid token when the user is inactive or no longer exists', async () => {
    const token = signToken({ userId: user.id, role: user.role });
    mocks.findUnique.mockResolvedValue({ ...user, isActive: false });
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status,
    ).toBe(401);
    mocks.findUnique.mockResolvedValue(null);
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status,
    ).toBe(401);
  });
  it('rejects a token signed with an algorithm other than the pinned HS256', async () => {
    mocks.findUnique.mockResolvedValue(user);
    // Correctly signed with the right secret and claims, but under a different HMAC
    // algorithm. `jwt.verify` with `algorithms: ['HS256']` must reject this outright,
    // as defense-in-depth against algorithm-confusion style attacks.
    const wrongAlgToken = jwt.sign({ userId: user.id, role: user.role }, env.jwtSecret, {
      algorithm: 'HS384',
      expiresIn: '8h',
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${wrongAlgToken}`);
    expect(res.status).toBe(401);
  });
});
