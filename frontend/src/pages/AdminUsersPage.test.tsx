import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { ToastProvider } from '../context/ToastContext';
import type { SessionUser } from '../types/auth';
import { AdminUsersPage } from './AdminUsersPage';

vi.mock('../api/users', () => ({
  fetchUsers: vi.fn(),
  changeUserRole: vi.fn(),
  changeUserStatus: vi.fn(),
}));

import { changeUserRole, changeUserStatus, fetchUsers } from '../api/users';

function renderAdminUsersPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <AdminUsersPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const activeUser: SessionUser = {
  id: 'u1',
  email: 'jan@helpdesk.test',
  firstName: 'Jan',
  lastName: 'Kowalski',
  role: 'USER',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const inactiveTechnician: SessionUser = {
  id: 't1',
  email: 'anna@helpdesk.test',
  firstName: 'Anna',
  lastName: 'Nowak',
  role: 'TECHNICIAN',
  isActive: false,
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.mocked(fetchUsers).mockReset();
    vi.mocked(changeUserRole).mockReset();
    vi.mocked(changeUserStatus).mockReset();
  });

  it('shows a loading indicator while users are being fetched', () => {
    vi.mocked(fetchUsers).mockReturnValue(new Promise(() => {}));
    renderAdminUsersPage();

    expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie użytkowników…');
  });

  it('sets the document title', () => {
    vi.mocked(fetchUsers).mockReturnValue(new Promise(() => {}));
    renderAdminUsersPage();

    expect(document.title).toBe('Administracja użytkownikami — HelpDesk');
  });

  it('shows an error state with a retry action', async () => {
    vi.mocked(fetchUsers)
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Wystąpił błąd serwera.'))
      .mockResolvedValueOnce({ items: [activeUser] });
    const user = userEvent.setup();
    renderAdminUsersPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Wystąpił błąd serwera.');
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    await waitFor(() => expect(screen.getByText('Jan Kowalski')).toBeInTheDocument());
  });

  it('renders the users table with role and account status', async () => {
    vi.mocked(fetchUsers).mockResolvedValue({ items: [activeUser, inactiveTechnician] });
    renderAdminUsersPage();

    await waitFor(() => expect(screen.getByText('Jan Kowalski')).toBeInTheDocument());
    expect(screen.getByText('jan@helpdesk.test')).toBeInTheDocument();
    expect(screen.getByText('Aktywne')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
    expect(screen.getByText('anna@helpdesk.test')).toBeInTheDocument();
    expect(screen.getByText('Nieaktywne')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aktywuj konto Anna Nowak' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dezaktywuj konto Jan Kowalski' })).toBeInTheDocument();
  });

  it('names each row action button with the specific user for assistive technology', async () => {
    vi.mocked(fetchUsers).mockResolvedValue({ items: [activeUser, inactiveTechnician] });
    renderAdminUsersPage();

    await waitFor(() => expect(screen.getByText('Jan Kowalski')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Dezaktywuj konto Jan Kowalski' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aktywuj konto Anna Nowak' })).toBeInTheDocument();
  });

  it('gives the users table an accessible caption and column headers', async () => {
    vi.mocked(fetchUsers).mockResolvedValue({ items: [activeUser] });
    renderAdminUsersPage();

    const table = await screen.findByRole('table');
    expect(table.querySelector('caption')).not.toBeNull();
    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders.length).toBeGreaterThan(0);
    columnHeaders.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
  });

  it('shows an empty state when there are no users', async () => {
    vi.mocked(fetchUsers).mockResolvedValue({ items: [] });
    renderAdminUsersPage();

    expect(await screen.findByText('Brak użytkowników.')).toBeInTheDocument();
  });

  it('changes a role via the per-row selector after confirming the dialog', async () => {
    vi.mocked(fetchUsers).mockResolvedValue({ items: [activeUser] });
    vi.mocked(changeUserRole).mockResolvedValue({ user: { ...activeUser, role: 'TECHNICIAN' } });
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => expect(screen.getByText('Jan Kowalski')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Rola dla Jan Kowalski'), 'TECHNICIAN');

    expect(changeUserRole).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Jan Kowalski');
    expect(dialog).toHaveTextContent('Serwisant');

    await user.click(screen.getByRole('button', { name: 'Zmień rolę' }));

    expect(changeUserRole).toHaveBeenCalledWith('u1', 'TECHNICIAN');
    expect(await screen.findByText('Rola użytkownika została zmieniona.')).toBeInTheDocument();
  });

  it('does not change the role when the confirm dialog is cancelled', async () => {
    vi.mocked(fetchUsers).mockResolvedValue({ items: [activeUser] });
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => expect(screen.getByText('Jan Kowalski')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Rola dla Jan Kowalski'), 'TECHNICIAN');

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(changeUserRole).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Rola dla Jan Kowalski')).toHaveValue('USER');
  });

  it('does not change the role when the confirm dialog is dismissed with Escape', async () => {
    vi.mocked(fetchUsers).mockResolvedValue({ items: [activeUser] });
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => expect(screen.getByText('Jan Kowalski')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Rola dla Jan Kowalski'), 'TECHNICIAN');

    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(changeUserRole).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Rola dla Jan Kowalski')).toHaveValue('USER');
  });

  it('toggles account status via the per-row button after confirming the dialog', async () => {
    vi.mocked(fetchUsers).mockResolvedValue({ items: [activeUser] });
    vi.mocked(changeUserStatus).mockResolvedValue({ user: { ...activeUser, isActive: false } });
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Dezaktywuj konto Jan Kowalski' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Dezaktywuj konto Jan Kowalski' }));

    expect(changeUserStatus).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Jan Kowalski');

    await user.click(screen.getByRole('button', { name: 'Dezaktywuj' }));

    expect(changeUserStatus).toHaveBeenCalledWith('u1', false);
    expect(await screen.findByText('Status konta został zmieniony.')).toBeInTheDocument();
  });

  it('does not change account status when the confirm dialog is cancelled', async () => {
    vi.mocked(fetchUsers).mockResolvedValue({ items: [activeUser] });
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Dezaktywuj konto Jan Kowalski' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Dezaktywuj konto Jan Kowalski' }));

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(changeUserStatus).not.toHaveBeenCalled();
  });

  it('shows the backend error when protecting the last active admin', async () => {
    vi.mocked(fetchUsers).mockResolvedValue({ items: [{ ...activeUser, role: 'ADMIN' }] });
    vi.mocked(changeUserStatus).mockRejectedValue(new ApiError(409, 'LAST_ADMIN', 'Nie można zmienić ostatniego aktywnego administratora.'));
    const user = userEvent.setup();
    renderAdminUsersPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Dezaktywuj konto Jan Kowalski' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Dezaktywuj konto Jan Kowalski' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Dezaktywuj' }));

    expect(await screen.findByText('Nie można zmienić ostatniego aktywnego administratora.')).toBeInTheDocument();
  });

  it('links to the new-user page', async () => {
    vi.mocked(fetchUsers).mockResolvedValue({ items: [] });
    renderAdminUsersPage();

    expect(screen.getByRole('link', { name: '+ Nowy użytkownik' })).toHaveAttribute('href', '/admin/users/new');
  });
});
