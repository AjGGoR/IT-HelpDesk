import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearToken, getToken, setToken } from '../api/tokenStorage';
import type { SessionUser } from '../types/auth';
import { AuthProvider, useAuth } from './AuthContext';

// Deliberately does NOT mock '../api/auth': this test exercises the real
// apiRequest() -> unauthorizedHandler wiring against a stubbed fetch, since
// that is where the token-aware 401 guard actually lives.

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const userB: SessionUser = {
  id: 'b1',
  email: 'b@helpdesk.test',
  firstName: 'Bartek',
  lastName: 'Nowy',
  role: 'USER',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="user">{auth.user ? `${auth.user.firstName} ${auth.user.lastName}` : ''}</span>
      <button onClick={() => auth.login('b@helpdesk.test', 'Helpdesk123!')}>login</button>
    </div>
  );
}

function renderAuth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AuthProvider session race safety', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearToken();
  });

  it('keeps the freshly logged-in session when a stale /me request for the previous token later resolves with 401', async () => {
    setToken('token-A');

    let resolveStaleMe!: (response: Response) => void;
    const staleMePromise = new Promise<Response>((resolve) => {
      resolveStaleMe = resolve;
    });

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (url.endsWith('/auth/login') && method === 'POST') {
        return Promise.resolve(jsonResponse(200, { token: 'token-B', user: userB }));
      }
      if (url.endsWith('/auth/me') && method === 'GET') {
        return staleMePromise;
      }
      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderAuth();
    expect(screen.getByTestId('status')).toHaveTextContent('loading');

    await act(async () => {
      screen.getByText('login').click();
    });
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('Bartek Nowy');
    expect(getToken()).toBe('token-B');

    await act(async () => {
      resolveStaleMe(jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Sesja jest nieważna.' } }));
      await staleMePromise.catch(() => undefined);
    });

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('Bartek Nowy');
    expect(getToken()).toBe('token-B');
  });
});
