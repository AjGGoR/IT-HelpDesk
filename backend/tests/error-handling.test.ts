import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Body-parser (express.json) throws its own errors for malformed JSON and oversized
// payloads before any route handler runs. The central error handler must translate
// those into the project's standard {error:{code,message}} shape with the correct
// client-error status codes (400 / 413), instead of falling through to the generic
// 500 INTERNAL_SERVER_ERROR handler.
vi.mock('../src/config/prisma.js', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { app } from '../src/app.js';

describe('central error handler: body-parser errors', () => {
  it('returns 400 for malformed JSON instead of 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).not.toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.error).toEqual(
      expect.objectContaining({ code: expect.any(String), message: expect.any(String) }),
    );
  });

  it('returns 413 for a payload exceeding the configured body size limit', async () => {
    const oversizedEmail = `${'a'.repeat(1024 * 1024 + 100)}@helpdesk.test`;
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: oversizedEmail, password: 'Password123!' }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).not.toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.error).toEqual(
      expect.objectContaining({ code: expect.any(String), message: expect.any(String) }),
    );
  });
});
