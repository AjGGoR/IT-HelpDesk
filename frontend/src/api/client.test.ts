import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest, ApiError, setUnauthorizedHandler } from './client';
import { clearToken, setToken } from './tokenStorage';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('apiRequest', () => {
  beforeEach(() => {
    clearToken();
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearToken();
    setUnauthorizedHandler(null);
  });

  it('returns parsed JSON on success and does not attach an Authorization header without a token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: { id: '1' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest<{ user: { id: string } }>('/auth/me');

    expect(result).toEqual({ user: { id: '1' } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('attaches a Bearer token when one is stored', async () => {
    setToken('token-123');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/tickets');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });

  it('throws an ApiError using the backend error code and message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Nieprawidłowy e-mail lub hasło.' } })),
    );

    await expect(apiRequest('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Nieprawidłowy e-mail lub hasło.',
    });
  });

  it('invokes the registered unauthorized handler on a 401 response', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Sesja wygasła.' } })));

    await expect(apiRequest('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(null);
  });

  it('passes the exact bearer token used for the failed request to the unauthorized handler', async () => {
    setToken('token-A');
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Sesja wygasła.' } })));

    await expect(apiRequest('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledWith('token-A');
  });

  it('wraps network failures in a network ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
