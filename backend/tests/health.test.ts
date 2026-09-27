import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from './helpers/prisma-mock.js';

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }));
import { app } from '../src/app.js';

beforeEach(() => {
  resetPrismaMock();
});

describe('GET /api/health', () => {
  it('returns 200 with an ok status and database shape when the database is reachable', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'helpdesk-api',
        database: 'ok',
        timestamp: expect.any(String),
      }),
    );
  });

  it('returns 503 with a degraded status when the database is unreachable', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'degraded',
        service: 'helpdesk-api',
        database: 'unavailable',
      }),
    );
  });
});
