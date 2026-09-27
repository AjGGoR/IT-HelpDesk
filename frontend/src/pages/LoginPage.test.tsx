import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { clearToken } from '../api/tokenStorage';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { LoginPage } from './LoginPage';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  fetchMe: vi.fn(),
}));

import { login } from '../api/auth';

function renderLoginPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<div>Pulpit</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(login).mockReset();
  });

  afterEach(() => {
    clearToken();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('marks both login fields as required for assistive technology', () => {
    renderLoginPage();

    expect(screen.getByLabelText('Adres e-mail')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('Hasło')).toHaveAttribute('aria-required', 'true');
  });

  it('sets the document title', () => {
    renderLoginPage();

    expect(document.title).toBe('Logowanie — HelpDesk');
  });

  it('lets an unauthenticated visitor toggle the theme', async () => {
    document.documentElement.classList.remove('dark');
    const user = userEvent.setup();
    renderLoginPage();

    const toggleButton = screen.getByRole('button', { name: 'Przełącz na motyw ciemny' });
    await user.click(toggleButton);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button', { name: 'Przełącz na motyw jasny' })).toBeInTheDocument();
  });

  it('shows validation errors and does not call the API when the form is empty', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));

    expect(await screen.findByText('Podaj adres e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Podaj hasło.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('logs in and redirects to the dashboard on success', async () => {
    vi.mocked(login).mockResolvedValue({
      token: 'token-abc',
      user: {
        id: 'u1',
        email: 'user@helpdesk.test',
        firstName: 'Jan',
        lastName: 'Kowalski',
        role: 'USER',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Adres e-mail'), 'user@helpdesk.test');
    await user.type(screen.getByLabelText('Hasło'), 'Helpdesk123!');
    await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));

    await waitFor(() => expect(screen.getByText('Pulpit')).toBeInTheDocument());
  });

  it('shows the backend error message when the credentials are invalid', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Nieprawidłowy e-mail lub hasło.'));
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Adres e-mail'), 'user@helpdesk.test');
    await user.type(screen.getByLabelText('Hasło'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Zaloguj się' }));

    expect(await screen.findByText('Nieprawidłowy e-mail lub hasło.')).toBeInTheDocument();
  });
});
