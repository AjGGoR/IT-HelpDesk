import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// The login route is rate limited per-client. In production the app sits behind the
// `frontend` nginx container, which sets X-Forwarded-For to the real client IP.
// Without `app.set('trust proxy', 1)` in src/app.ts, express-rate-limit either throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR (surfacing as a 500) or, if that were suppressed,
// would fall back to keying every request off the single nginx socket address -
// merging every real client into one shared bucket. These tests confirm neither
// happens: the header is accepted without error, and distinct X-Forwarded-For values
// are tracked as distinct clients.
vi.mock('../src/config/prisma.js', () => ({
  prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } },
}));
import { app } from '../src/app.js';

describe('login rate limiter behind a trusted reverse proxy', () => {
  it('does not log ERR_ERL_UNEXPECTED_X_FORWARDED_FOR when X-Forwarded-For is present', async () => {
    // express-rate-limit's internal validation catches this misconfiguration itself and
    // reports it via the logger (console.error) rather than throwing into the request -
    // so the regression shows up as a logged warning, not a 500. With `trust proxy` set
    // correctly, this validation must not fire at all.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '203.0.113.10')
        .send({ email: 'nobody@helpdesk.test', password: 'WrongPassword1!' });
      expect(res.status).not.toBe(500);
      const loggedUnexpectedXff = errorSpy.mock.calls.some((call) =>
        call.some(
          (arg) =>
            arg instanceof Error &&
            (arg as Error & { code?: string }).code === 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR',
        ),
      );
      expect(loggedUnexpectedXff).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('tracks distinct clients (by X-Forwarded-For) separately instead of sharing one bucket', async () => {
    const clientA = '198.51.100.1';
    const clientB = '198.51.100.2';

    // Exhaust the 10-per-window limit for client A only.
    let lastStatusForA = 0;
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', clientA)
        .send({ email: 'nobody@helpdesk.test', password: 'WrongPassword1!' });
      lastStatusForA = res.status;
    }
    expect(lastStatusForA).not.toBe(429); // the 10 allowed attempts should not yet be blocked

    const blockedA = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', clientA)
      .send({ email: 'nobody@helpdesk.test', password: 'WrongPassword1!' });
    expect(blockedA.status).toBe(429);
    expect(blockedA.body?.error?.code).toBe('TOO_MANY_REQUESTS');

    // A different client (different X-Forwarded-For) must not be affected by A's usage.
    // If trust proxy were misconfigured, both would collapse onto the same proxy socket
    // address and this request would also be blocked.
    const freshB = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', clientB)
      .send({ email: 'nobody@helpdesk.test', password: 'WrongPassword1!' });
    expect(freshB.status).not.toBe(429);
  });
});
