import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import type { SessionUser } from '../types/auth';
import type { DashboardResponse } from '../types/dashboard';
import type { Ticket, TicketListResponse } from '../types/ticket';
import { DashboardPage } from './DashboardPage';

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../api/dashboard', () => ({
  fetchDashboard: vi.fn(),
}));
vi.mock('../api/tickets', () => ({
  fetchTickets: vi.fn(),
}));
// The staff dashboard has its own tests; here we only check that the page
// routes staff to it with the fetched data.
vi.mock('../components/dashboard/StaffDashboard', () => ({
  StaffDashboard: ({ data }: { data: DashboardResponse }) => <div>Pulpit operacyjny: {data.tickets.total}</div>,
}));

import { fetchDashboard } from '../api/dashboard';
import { fetchTickets } from '../api/tickets';

function userWithRole(role: SessionUser['role']): SessionUser {
  return {
    id: 'u1',
    email: 'user@helpdesk.test',
    firstName: 'Użytkownik',
    lastName: '',
    role,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderDashboard(role: SessionUser['role']) {
  mockUseAuth.mockReturnValue({ user: userWithRole(role), status: 'authenticated', login: vi.fn(), logout: vi.fn() });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const person = { id: 'u1', email: 'user@helpdesk.test', firstName: 'Użytkownik', lastName: '', role: 'USER' as const, isActive: true };

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't1',
    ticketNumber: 'HD-000001',
    title: 'Nie działa drukarka',
    description: 'Drukarka nie drukuje od rana.',
    type: 'INCIDENT',
    category: 'HARDWARE',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    reporterId: 'u1',
    assigneeId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    resolvedAt: null,
    closedAt: null,
    slaDueAt: '2026-01-05T15:00:00.000Z',
    resolutionNote: null,
    sla: {
      dueAt: '2026-01-05T15:00:00.000Z',
      targetMinutes: 1440,
      warningThresholdMinutes: 1440,
      remainingMinutes: 600,
      running: true,
      dueToday: false,
      state: 'WARNING',
    },
    reporter: person,
    assignee: null,
    ...overrides,
  };
}

const listOf = (items: Ticket[], total = items.length): TicketListResponse => ({
  items,
  pagination: { page: 1, pageSize: 10, total, totalPages: 1 },
});

const staffDashboard: DashboardResponse = {
  tickets: { total: 10, new: 2, inProgress: 3, waitingForUser: 1, resolved: 4, critical: 2 },
  recentTickets: [],
  attentionTickets: [],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    vi.mocked(fetchDashboard).mockReset();
    vi.mocked(fetchTickets).mockReset();
  });

  it('sets the document title', () => {
    vi.mocked(fetchTickets).mockReturnValue(new Promise(() => {}));
    renderDashboard('USER');

    expect(document.title).toBe('Pulpit — HelpDesk');
  });

  describe('for a requester (USER)', () => {
    it('starts with the two create-ticket choices, preselecting the type', () => {
      vi.mocked(fetchTickets).mockReturnValue(new Promise(() => {}));
      renderDashboard('USER');

      expect(screen.getByRole('heading', { level: 1, name: 'W czym możemy pomóc?' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Nowa usługa/ })).toHaveAttribute('href', '/tickets/new?type=SERVICE');
      expect(screen.getByRole('link', { name: /Nowy incydent/ })).toHaveAttribute('href', '/tickets/new?type=INCIDENT');
      // No statistics dashboard for requesters.
      expect(fetchDashboard).not.toHaveBeenCalled();
    });

    it('lists only current tickets using the default (non-closed) list scope', async () => {
      vi.mocked(fetchTickets).mockResolvedValue(listOf([makeTicket()], 12));
      renderDashboard('USER');

      const list = await screen.findByRole('list');
      const item = within(list).getByRole('link', { name: /Nie działa drukarka/ });
      expect(item).toHaveAttribute('href', '/tickets/t1');
      expect(item).toHaveTextContent('Incydent');
      expect(item).toHaveTextContent('W trakcie');
      expect(item).toHaveTextContent('Pozostało 1 d 2 h');
      expect(fetchTickets).toHaveBeenCalledWith({ pageSize: 10, sortBy: 'updatedAt', sortOrder: 'desc' });
      expect(screen.getByText('Pokazano 1 z 12 otwartych zgłoszeń.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Wszystkie zgłoszenia' })).toHaveAttribute('href', '/tickets');
    });

    it('makes a breached SLA unmistakable', async () => {
      vi.mocked(fetchTickets).mockResolvedValue(
        listOf([makeTicket({ sla: { ...makeTicket().sla!, state: 'BREACHED', remainingMinutes: -90 } })]),
      );
      renderDashboard('USER');

      expect(await screen.findByText('SLA przekroczone o 1 h 30 min')).toBeInTheDocument();
    });

    it('shows an empty state when the user has no open tickets', async () => {
      vi.mocked(fetchTickets).mockResolvedValue(listOf([]));
      renderDashboard('USER');

      expect(await screen.findByText('Nie masz otwartych zgłoszeń.')).toBeInTheDocument();
    });

    it('shows an error state for the ticket list with a retry action', async () => {
      vi.mocked(fetchTickets)
        .mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Wystąpił błąd serwera.'))
        .mockResolvedValueOnce(listOf([makeTicket()]));
      const user = userEvent.setup();
      renderDashboard('USER');

      expect(await screen.findByRole('alert')).toHaveTextContent('Wystąpił błąd serwera.');
      await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
      expect(await screen.findByText('Nie działa drukarka')).toBeInTheDocument();
    });
  });

  describe.each(['TECHNICIAN', 'ADMIN'] as const)('for %s', (role) => {
    it('shows a loading indicator while the dashboard is being fetched', () => {
      vi.mocked(fetchDashboard).mockReturnValue(new Promise(() => {}));
      renderDashboard(role);

      expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie pulpitu…');
    });

    it('shows an error state with a retry action', async () => {
      vi.mocked(fetchDashboard)
        .mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Wystąpił błąd serwera.'))
        .mockResolvedValueOnce(staffDashboard);
      const user = userEvent.setup();
      renderDashboard(role);

      expect(await screen.findByRole('alert')).toHaveTextContent('Wystąpił błąd serwera.');
      await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
      await waitFor(() => expect(screen.getByText('Pulpit operacyjny: 10')).toBeInTheDocument());
      expect(fetchDashboard).toHaveBeenCalledTimes(2);
    });

    it('renders the operational dashboard instead of the requester home', async () => {
      vi.mocked(fetchDashboard).mockResolvedValue(staffDashboard);
      renderDashboard(role);

      expect(await screen.findByText('Pulpit operacyjny: 10')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Nowy incydent/ })).not.toBeInTheDocument();
      expect(fetchTickets).not.toHaveBeenCalled();
    });
  });
});
