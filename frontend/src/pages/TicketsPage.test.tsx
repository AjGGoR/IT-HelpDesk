import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import type { SessionUser } from '../types/auth';
import type { Ticket, TicketListResponse } from '../types/ticket';
import { TicketsPage } from './TicketsPage';

vi.mock('../api/tickets', () => ({
  fetchTickets: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import { fetchTickets } from '../api/tickets';

function sessionUser(role: SessionUser['role']): SessionUser {
  return {
    id: 'me',
    email: 'me@helpdesk.test',
    firstName: 'Serwisant',
    lastName: '',
    role,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderTicketsPage(initialPath = '/tickets') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <TicketsPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const reporter = { id: 'u1', email: 'user@helpdesk.test', firstName: 'Jan', lastName: 'Kowalski', role: 'USER' as const, isActive: true };
const assignee = { id: 't1', email: 'tech@helpdesk.test', firstName: 'Anna', lastName: 'Nowak', role: 'TECHNICIAN' as const, isActive: true };

const ticket: Ticket = {
  id: 't1',
  ticketNumber: 'HD-000001',
  title: 'Nie działa drukarka',
  description: 'Drukarka nie odpowiada od rana.',
  type: 'INCIDENT',
  category: 'HARDWARE',
  priority: 'HIGH',
  status: 'NEW',
  reporterId: reporter.id,
  assigneeId: assignee.id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  resolvedAt: null,
  closedAt: null,
  slaDueAt: '2026-01-01T12:00:00.000Z',
  resolutionNote: null,
  sla: {
    dueAt: '2026-01-01T12:00:00.000Z',
    targetMinutes: 480,
    warningThresholdMinutes: 96,
    remainingMinutes: 200,
    running: true,
    dueToday: true,
    state: 'ON_TRACK',
  },
  reporter,
  assignee,
};

const breachedTicket: Ticket = {
  ...ticket,
  id: 't2',
  ticketNumber: 'HD-000002',
  title: 'Brak dostępu do VPN',
  type: 'SERVICE',
  priority: 'MEDIUM',
  assigneeId: null,
  assignee: null,
  sla: { ...ticket.sla!, remainingMinutes: -150, dueToday: false, state: 'BREACHED' },
};

function listResponse(overrides: Partial<TicketListResponse> = {}): TicketListResponse {
  return {
    items: [ticket],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    ...overrides,
  };
}

function lastParams() {
  return vi.mocked(fetchTickets).mock.lastCall?.[0];
}

describe('TicketsPage', () => {
  beforeEach(() => {
    vi.mocked(fetchTickets).mockReset();
    mockUseAuth.mockReturnValue({ user: sessionUser('TECHNICIAN') });
  });

  it('shows a loading indicator while tickets are being fetched', () => {
    vi.mocked(fetchTickets).mockReturnValue(new Promise(() => {}));
    renderTicketsPage();

    expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie zgłoszeń…');
  });

  it('shows an error state with a retry action', async () => {
    vi.mocked(fetchTickets)
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Wystąpił błąd serwera.'))
      .mockResolvedValueOnce(listResponse());
    const user = userEvent.setup();
    renderTicketsPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Wystąpił błąd serwera.');

    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByRole('table')).toHaveTextContent('HD-000001');
  });

  it('links to the ticket creation page', () => {
    vi.mocked(fetchTickets).mockReturnValue(new Promise(() => {}));
    renderTicketsPage();

    expect(screen.getByRole('link', { name: '+ Nowe zgłoszenie' })).toHaveAttribute('href', '/tickets/new');
  });

  it('renders desktop table rows with type, priority, status, SLA and people', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    renderTicketsPage();

    const row = within(await screen.findByRole('table'));
    expect(row.getByText('HD-000001')).toBeInTheDocument();
    expect(row.getByText('Nie działa drukarka')).toBeInTheDocument();
    expect(row.getByText(/Sprzęt/)).toBeInTheDocument();
    expect(row.getByText('Incydent')).toBeInTheDocument();
    expect(row.getByText('Wysoki')).toBeInTheDocument();
    expect(row.getByText('Nowe')).toBeInTheDocument();
    expect(row.getByText(/Pozostało/)).toBeInTheDocument();
    expect(row.getByText(/Jan Kowalski/)).toBeInTheDocument();
    expect(row.getByText('Anna Nowak')).toBeInTheDocument();
    expect(row.getByRole('link', { name: /HD-000001/ })).toHaveAttribute('href', '/tickets/t1');
  });

  it('renders a stacked card per ticket for narrow screens, linking to the detail page', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    renderTicketsPage();

    const cards = within(await screen.findByRole('list', { name: 'Lista zgłoszeń' }));
    const card = cards.getByRole('link', { name: /HD-000001/ });
    expect(card).toHaveAttribute('href', '/tickets/t1');
    expect(card).toHaveTextContent('Nie działa drukarka');
    expect(card).toHaveTextContent('Incydent');
    expect(card).toHaveTextContent('Serwisant: Anna Nowak');
  });

  it('makes a breached SLA unmistakable in both layouts', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse({ items: [ticket, breachedTicket] }));
    renderTicketsPage();

    const table = await screen.findByRole('table');
    expect(within(table).getByText('SLA przekroczone o 2 h 30 min')).toBeInTheDocument();
    expect(within(table).getByText('Nieprzypisane')).toBeInTheDocument();
    const breachedRow = within(table).getByText('Brak dostępu do VPN').closest('tr');
    expect(breachedRow?.className).toMatch(/bg-red-50/);
    const cards = screen.getByRole('list', { name: 'Lista zgłoszeń' });
    expect(within(cards).getByText('SLA przekroczone o 2 h 30 min')).toBeInTheDocument();
  });

  it('gives the tickets table an accessible caption and column headers', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    renderTicketsPage();

    const table = await screen.findByRole('table');
    expect(table.querySelector('caption')).not.toBeNull();
    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders.length).toBeGreaterThan(0);
    columnHeaders.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
  });

  it('sets the document title', () => {
    vi.mocked(fetchTickets).mockReturnValue(new Promise(() => {}));
    renderTicketsPage();

    expect(document.title).toBe('Zgłoszenia — HelpDesk');
  });

  it('shows an empty state when no tickets match the current filters', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }));
    renderTicketsPage();

    expect(await screen.findByText('Brak zgłoszeń spełniających wybrane kryteria.')).toBeInTheDocument();
  });

  it('requests the default scope (closed excluded by the backend) without status or includeClosed', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    renderTicketsPage();

    await waitFor(() => expect(fetchTickets).toHaveBeenCalledTimes(1));
    const params = lastParams();
    expect(params).toMatchObject({ page: 1, sortBy: 'updatedAt', sortOrder: 'desc' });
    expect(params?.status).toBeUndefined();
    expect(params?.includeClosed).toBeUndefined();
    expect(params?.unassigned).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Wyczyść filtry' })).not.toBeInTheDocument();
  });

  it('sends includeClosed when "Pokaż zamknięte" is checked and keeps the URL in sync', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    const user = userEvent.setup();
    renderTicketsPage();

    await waitFor(() => expect(fetchTickets).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('checkbox', { name: 'Pokaż zamknięte' }));

    await waitFor(() => expect(lastParams()).toMatchObject({ includeClosed: true, page: 1 }));
    expect(screen.getByTestId('location')).toHaveTextContent('/tickets?includeClosed=true');
  });

  it('still offers "Zamknięte" in the status filter', () => {
    vi.mocked(fetchTickets).mockReturnValue(new Promise(() => {}));
    renderTicketsPage();

    expect(within(screen.getByLabelText('Status')).getByRole('option', { name: 'Zamknięte' })).toHaveValue('CLOSED');
  });

  it('initialises filters from URL search params', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    renderTicketsPage('/tickets?sla=BREACHED&type=INCIDENT&unassigned=true&sortBy=slaDueAt&sortOrder=asc&page=2&search=vpn');

    await waitFor(() =>
      expect(fetchTickets).toHaveBeenCalledWith(
        expect.objectContaining({
          sla: 'BREACHED',
          type: 'INCIDENT',
          unassigned: true,
          sortBy: 'slaDueAt',
          sortOrder: 'asc',
          page: 2,
          search: 'vpn',
        }),
      ),
    );
    expect(screen.getByLabelText('SLA')).toHaveValue('BREACHED');
    expect(screen.getByLabelText('Typ')).toHaveValue('INCIDENT');
    expect(screen.getByLabelText('Sortuj według')).toHaveValue('slaDueAt');
    expect(screen.getByLabelText('Szukaj')).toHaveValue('vpn');
    expect(screen.getByRole('checkbox', { name: 'Tylko nieprzypisane' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Wyczyść filtry' })).toBeInTheDocument();
  });

  it('ignores invalid URL params', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    renderTicketsPage('/tickets?status=BOGUS&sla=LATE&type=x&sortBy=title&sortOrder=up&page=-3');

    await waitFor(() => expect(fetchTickets).toHaveBeenCalledTimes(1));
    const params = lastParams();
    expect(params).toMatchObject({ page: 1, sortBy: 'updatedAt', sortOrder: 'desc' });
    expect(params?.status).toBeUndefined();
    expect(params?.sla).toBeUndefined();
    expect(params?.type).toBeUndefined();
  });

  it('clears all filters with "Wyczyść filtry"', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    const user = userEvent.setup();
    renderTicketsPage('/tickets?priority=CRITICAL&sla=ATTENTION');

    await user.click(await screen.findByRole('button', { name: 'Wyczyść filtry' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/tickets$/));
    const params = lastParams();
    expect(params?.priority).toBeUndefined();
    expect(params?.sla).toBeUndefined();
  });

  it('offers the staff-only unassigned filter to technicians', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    const user = userEvent.setup();
    renderTicketsPage();

    await user.click(screen.getByRole('checkbox', { name: 'Tylko nieprzypisane' }));

    await waitFor(() => expect(lastParams()).toMatchObject({ unassigned: true }));
  });

  it('hides the unassigned filter from USER and never sends it', async () => {
    mockUseAuth.mockReturnValue({ user: sessionUser('USER') });
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    renderTicketsPage('/tickets?unassigned=true');

    await waitFor(() => expect(fetchTickets).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('checkbox', { name: 'Tylko nieprzypisane' })).not.toBeInTheDocument();
    expect(lastParams()?.unassigned).toBeUndefined();
  });

  it('filters by type and SLA', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    const user = userEvent.setup();
    renderTicketsPage();

    await user.selectOptions(screen.getByLabelText('Typ'), 'SERVICE');
    await user.selectOptions(screen.getByLabelText('SLA'), 'ATTENTION');

    await waitFor(() => expect(lastParams()).toMatchObject({ type: 'SERVICE', sla: 'ATTENTION', page: 1 }));
  });

  it('sorts by SLA deadline ascending when "Termin SLA" is chosen', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    const user = userEvent.setup();
    renderTicketsPage();

    await user.selectOptions(screen.getByLabelText('Sortuj według'), 'slaDueAt');

    await waitFor(() => expect(lastParams()).toMatchObject({ sortBy: 'slaDueAt', sortOrder: 'asc' }));
  });

  it('debounces search input and refetches with the search term', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    const user = userEvent.setup();
    renderTicketsPage();

    await waitFor(() => expect(fetchTickets).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText('Szukaj'), 'drukarka');

    await waitFor(() =>
      expect(fetchTickets).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'drukarka', page: 1 })),
    );
    expect(fetchTickets).not.toHaveBeenCalledWith(expect.objectContaining({ search: 'd' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/tickets?search=drukarka');
  });

  it('refetches with the selected status filter and resets to page 1', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse());
    const user = userEvent.setup();
    renderTicketsPage('/tickets?page=3');

    await waitFor(() => expect(fetchTickets).toHaveBeenCalledWith(expect.objectContaining({ page: 3 })));
    await user.selectOptions(screen.getByLabelText('Status'), 'IN_PROGRESS');

    await waitFor(() =>
      expect(fetchTickets).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'IN_PROGRESS', page: 1 })),
    );
  });

  it('paginates using the pagination controls', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(
      listResponse({ pagination: { page: 1, pageSize: 20, total: 40, totalPages: 2 } }),
    );
    const user = userEvent.setup();
    renderTicketsPage();

    await waitFor(() => expect(screen.getByText('Strona 1 z 2 (40 zgłoszeń)')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Poprzednia' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Następna' }));

    await waitFor(() => expect(fetchTickets).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    expect(screen.getByTestId('location')).toHaveTextContent('/tickets?page=2');
  });

  it('clamps a page beyond the last one instead of showing an empty list', async () => {
    vi.mocked(fetchTickets).mockResolvedValue(listResponse({ pagination: { page: 5, pageSize: 20, total: 21, totalPages: 2 } }));
    renderTicketsPage('/tickets?page=5');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/tickets?page=2'));
    await waitFor(() => expect(fetchTickets).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });
});
