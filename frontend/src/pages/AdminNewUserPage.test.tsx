import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import type { SessionUser } from '../types/auth';
import { AdminNewUserPage } from './AdminNewUserPage';

vi.mock('../api/users', () => ({
  createUser: vi.fn(),
}));

import { createUser } from '../api/users';

function renderAdminNewUserPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/users/new']}>
      <Routes>
        <Route path="/admin/users/new" element={<AdminNewUserPage />} />
        <Route path="/admin/users" element={<div>Lista użytkowników</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const createdUser: SessionUser = {
  id: 'u2',
  email: 'nowy@helpdesk.test',
  firstName: 'Piotr',
  lastName: 'Wisniewski',
  role: 'TECHNICIAN',
  isActive: true,
  createdAt: '2026-01-05T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
};

describe('AdminNewUserPage', () => {
  beforeEach(() => {
    vi.mocked(createUser).mockReset();
  });

  it('sets the document title', () => {
    renderAdminNewUserPage();

    expect(document.title).toBe('Nowy użytkownik — HelpDesk');
  });

  it('rejects a form with an invalid email and a too-short password', async () => {
    const user = userEvent.setup();
    renderAdminNewUserPage();

    await user.type(screen.getByLabelText('Imię'), 'Piotr');
    await user.type(screen.getByLabelText('Nazwisko'), 'Wiśniewski');
    await user.type(screen.getByLabelText('Adres e-mail'), 'not-an-email');
    await user.type(screen.getByLabelText('Hasło tymczasowe'), 'short');
    await user.click(screen.getByRole('button', { name: 'Utwórz użytkownika' }));

    expect(await screen.findByText('Podaj poprawny adres e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Hasło musi mieć co najmniej 8 znaków.')).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  it('creates a user with the selected role and shows a confirmation', async () => {
    vi.mocked(createUser).mockResolvedValue({ user: createdUser });
    const user = userEvent.setup();
    renderAdminNewUserPage();

    await user.type(screen.getByLabelText('Imię'), 'Piotr');
    await user.type(screen.getByLabelText('Nazwisko'), 'Wiśniewski');
    await user.type(screen.getByLabelText('Adres e-mail'), 'nowy@helpdesk.test');
    await user.type(screen.getByLabelText('Hasło tymczasowe'), 'Helpdesk123!');
    await user.selectOptions(screen.getByLabelText('Rola'), 'TECHNICIAN');
    await user.click(screen.getByRole('button', { name: 'Utwórz użytkownika' }));

    await waitFor(() => expect(screen.getByText('Użytkownik został utworzony')).toBeInTheDocument());
    expect(screen.getByText('Piotr Wisniewski (nowy@helpdesk.test) — Serwisant')).toBeInTheDocument();
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'nowy@helpdesk.test', role: 'TECHNICIAN' }),
    );
  });

  it('shows the backend error message when creation fails', async () => {
    vi.mocked(createUser).mockRejectedValue(new ApiError(409, 'EMAIL_EXISTS', 'Użytkownik z tym e-mailem już istnieje.'));
    const user = userEvent.setup();
    renderAdminNewUserPage();

    await user.type(screen.getByLabelText('Imię'), 'Piotr');
    await user.type(screen.getByLabelText('Nazwisko'), 'Wiśniewski');
    await user.type(screen.getByLabelText('Adres e-mail'), 'nowy@helpdesk.test');
    await user.type(screen.getByLabelText('Hasło tymczasowe'), 'Helpdesk123!');
    await user.click(screen.getByRole('button', { name: 'Utwórz użytkownika' }));

    expect(await screen.findByText('Użytkownik z tym e-mailem już istnieje.')).toBeInTheDocument();
  });

  it('navigates back to the users list after creating a user', async () => {
    vi.mocked(createUser).mockResolvedValue({ user: createdUser });
    const user = userEvent.setup();
    renderAdminNewUserPage();

    await user.type(screen.getByLabelText('Imię'), 'Piotr');
    await user.type(screen.getByLabelText('Nazwisko'), 'Wiśniewski');
    await user.type(screen.getByLabelText('Adres e-mail'), 'nowy@helpdesk.test');
    await user.type(screen.getByLabelText('Hasło tymczasowe'), 'Helpdesk123!');
    await user.click(screen.getByRole('button', { name: 'Utwórz użytkownika' }));

    await waitFor(() => expect(screen.getByText('Użytkownik został utworzony')).toBeInTheDocument());
    await user.click(screen.getByRole('link', { name: 'Wróć do listy użytkowników' }));

    expect(await screen.findByText('Lista użytkowników')).toBeInTheDocument();
  });
});
