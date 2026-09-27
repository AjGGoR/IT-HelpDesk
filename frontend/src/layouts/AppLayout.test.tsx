import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUser } from '../types/auth';
import { AppLayout } from './AppLayout';

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseTheme = vi.fn();
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

function userWithRole(role: SessionUser['role']): SessionUser {
  return {
    id: 'u1',
    email: 'user@helpdesk.test',
    firstName: 'Jan',
    lastName: 'Kowalski',
    role,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderLayout(role: SessionUser['role'] = 'USER') {
  const logout = vi.fn();
  const toggleTheme = vi.fn();
  mockUseAuth.mockReturnValue({ user: userWithRole(role), status: 'authenticated', login: vi.fn(), logout });
  mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme });

  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<div>Treść pulpitu</div>} />
          <Route path="/tickets" element={<div>Treść zgłoszeń</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return { logout, toggleTheme };
}

describe('AppLayout', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseTheme.mockReset();
  });

  it('renders the outlet content and the logo', () => {
    renderLayout();

    expect(screen.getByText('IT HelpDesk')).toBeInTheDocument();
    expect(screen.getByText('Treść pulpitu')).toBeInTheDocument();
  });

  it('shows the Administracja link only for ADMIN', () => {
    renderLayout('ADMIN');
    expect(screen.getAllByRole('link', { name: 'Administracja' }).length).toBeGreaterThan(0);
  });

  it('hides the Administracja link for USER', () => {
    renderLayout('USER');
    expect(screen.queryByRole('link', { name: 'Administracja' })).not.toBeInTheDocument();
  });

  it('calls toggleTheme when the theme button is clicked', async () => {
    const user = userEvent.setup();
    const { toggleTheme } = renderLayout();

    await user.click(screen.getByRole('button', { name: 'Przełącz na motyw ciemny' }));

    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it('opens and closes the mobile menu, and closing via a nav link works', async () => {
    const user = userEvent.setup();
    renderLayout();

    const menuButton = screen.getByRole('button', { name: 'Otwórz menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuButton);
    expect(screen.getByRole('button', { name: 'Zamknij menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Główna (mobile)' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: 'Zgłoszenia' })[0]);

    expect(screen.getByText('Treść zgłoszeń')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Główna (mobile)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otwórz menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('logs out from the mobile menu and closes it', async () => {
    const user = userEvent.setup();
    const { logout } = renderLayout();

    await user.click(screen.getByRole('button', { name: 'Otwórz menu' }));
    const logoutButtons = screen.getAllByRole('button', { name: 'Wyloguj się' });
    await user.click(logoutButtons[logoutButtons.length - 1]);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('navigation', { name: 'Główna (mobile)' })).not.toBeInTheDocument();
  });

  it('points aria-controls at the mobile panel id', () => {
    renderLayout();

    const menuButton = screen.getByRole('button', { name: 'Otwórz menu' });
    const controlsId = menuButton.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
  });

  it('moves focus into the mobile panel when it opens', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Otwórz menu' }));

    const firstMobileLink = screen.getAllByRole('link', { name: 'Pulpit' })[1];
    expect(firstMobileLink).toHaveFocus();
  });

  it('closes the mobile menu on Escape and returns focus to the toggle button', async () => {
    const user = userEvent.setup();
    renderLayout();

    const menuButton = screen.getByRole('button', { name: 'Otwórz menu' });
    await user.click(menuButton);
    expect(screen.getByRole('navigation', { name: 'Główna (mobile)' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('navigation', { name: 'Główna (mobile)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otwórz menu' })).toHaveFocus();
  });

  it('marks the skip link target as focusable so activating it moves keyboard focus', () => {
    renderLayout();

    const main = document.getElementById('main-content');
    expect(main).toHaveAttribute('tabindex', '-1');
  });
});
