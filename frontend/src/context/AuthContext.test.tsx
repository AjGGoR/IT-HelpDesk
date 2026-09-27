import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { clearToken, getToken, setToken } from '../api/tokenStorage';
import type { SessionUser } from '../types/auth';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  fetchMe: vi.fn(),
}));

import { fetchMe, login } from '../api/auth';

const user: SessionUser = {
  id: 'u1',
  email: 'user@helpdesk.test',
  firstName: 'Jan',
  lastName: 'Kowalski',
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
      <button onClick={() => auth.login('user@helpdesk.test', 'Helpdesk123!')}>login</button>
      <button onClick={() => auth.logout()}>logout</button>
    </div>
  );
}

function renderAuth(queryClient: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { queryClient, ...render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  ) };
}

describe('AuthProvider', () => {
  beforeEach(() => {
    clearToken();
    vi.mocked(login).mockReset();
    vi.mocked(fetchMe).mockReset();
  });

  afterEach(() => {
    clearToken();
  });

  it('starts unauthenticated when there is no stored token', () => {
    renderAuth();
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
  });

  it('restores the session from an existing token via GET /me', async () => {
    setToken('existing-token');
    vi.mocked(fetchMe).mockResolvedValue({ user });

    renderAuth();

    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('Jan Kowalski');
  });

  it('clears the session when session restoration fails with 401', async () => {
    setToken('stale-token');
    vi.mocked(fetchMe).mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'Sesja jest nieważna.'));

    renderAuth();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(getToken()).toBeNull();
  });

  it('logs in successfully, stores the token, and exposes the user', async () => {
    vi.mocked(login).mockResolvedValue({ token: 'new-token', user });

    renderAuth();
    await act(async () => {
      screen.getByText('login').click();
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(getToken()).toBe('new-token');
    expect(screen.getByTestId('user')).toHaveTextContent('Jan Kowalski');
  });

  it('logs out and clears the stored token', async () => {
    vi.mocked(login).mockResolvedValue({ token: 'new-token', user });
    renderAuth();
    await act(async () => {
      screen.getByText('login').click();
    });
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(getToken()).toBeNull();
  });

  it('clears the entire query cache on logout, not only the session query', async () => {
    vi.mocked(login).mockResolvedValue({ token: 'new-token', user });
    const { queryClient } = renderAuth();
    queryClient.setQueryData(['tickets', 'list'], { items: [{ id: 't1' }] });

    await act(async () => {
      screen.getByText('login').click();
    });
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(queryClient.getQueryData(['tickets', 'list'])).toEqual({ items: [{ id: 't1' }] });

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(queryClient.getQueryData(['tickets', 'list'])).toBeUndefined();
  });
});
