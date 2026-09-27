import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { ToastProvider } from '../context/ToastContext';
import type { SessionUser } from '../types/auth';
import type { TicketDetail, TicketSla } from '../types/ticket';
import { TicketDetailPage } from './TicketDetailPage';

const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../api/tickets', () => ({
  fetchTicket: vi.fn(),
  patchTicket: vi.fn(),
  assignTicket: vi.fn(),
  resolveTicket: vi.fn(),
  closeTicket: vi.fn(),
  addTicketComment: vi.fn(),
}));

import { addTicketComment, assignTicket, closeTicket, fetchTicket, patchTicket, resolveTicket } from '../api/tickets';

function asUser(role: SessionUser['role'], id: string): SessionUser {
  return {
    id,
    email: `${id}@helpdesk.test`,
    firstName: 'Test',
    lastName: 'User',
    role,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderTicketDetailPage(role: SessionUser['role'] = 'USER', userId = 'u1', id = 't1') {
  mockUseAuth.mockReturnValue({ user: asUser(role, userId), status: 'authenticated', login: vi.fn(), logout: vi.fn() });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/tickets/${id}`]}>
          <Routes>
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/tickets" element={<div>Lista zgłoszeń</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const reporter = { id: 'u1', email: 'user@helpdesk.test', firstName: 'Jan', lastName: 'Kowalski', role: 'USER' as const, isActive: true };
const assignee = { id: 'tech1', email: 'tech@helpdesk.test', firstName: 'Anna', lastName: 'Nowak', role: 'TECHNICIAN' as const, isActive: true };

const onTrackSla: TicketSla = {
  dueAt: '2026-01-06T15:00:00.000Z',
  targetMinutes: 1440,
  warningThresholdMinutes: 1440,
  remainingMinutes: 1500,
  running: true,
  dueToday: false,
  state: 'ON_TRACK',
};

function ticketDetail(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return {
    id: 't1',
    ticketNumber: 'HD-000001',
    title: 'Nie działa drukarka',
    description: 'Drukarka nie odpowiada od rana.',
    type: 'INCIDENT',
    category: 'HARDWARE',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    reporterId: reporter.id,
    assigneeId: assignee.id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    resolvedAt: null,
    closedAt: null,
    slaDueAt: '2026-01-06T15:00:00.000Z',
    resolutionNote: null,
    sla: onTrackSla,
    reporter,
    assignee,
    comments: [
      {
        id: 'c1',
        content: 'Sprawdziłem kabel zasilający.',
        authorId: assignee.id,
        ticketId: 't1',
        createdAt: '2026-01-01T12:00:00.000Z',
        updatedAt: '2026-01-01T12:00:00.000Z',
        author: { id: assignee.id, firstName: 'Anna', lastName: 'Nowak', role: 'TECHNICIAN' },
      },
    ],
    history: [
      {
        id: 'h1',
        ticketId: 't1',
        actorId: reporter.id,
        action: 'TICKET_CREATED',
        description: 'Utworzono zgłoszenie HD-000001.',
        oldValue: null,
        newValue: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        actor: { id: reporter.id, firstName: 'Jan', lastName: 'Kowalski', role: 'USER' },
      },
      {
        id: 'h2',
        ticketId: 't1',
        actorId: assignee.id,
        action: 'STATUS_CHANGED',
        description: 'Zmieniono status na IN_PROGRESS.',
        oldValue: 'NEW',
        newValue: 'IN_PROGRESS',
        createdAt: '2026-01-01T10:00:00.000Z',
        actor: { id: assignee.id, firstName: 'Anna', lastName: 'Nowak', role: 'TECHNICIAN' },
      },
    ],
    ...overrides,
  };
}

describe('TicketDetailPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    vi.mocked(fetchTicket).mockReset();
    vi.mocked(patchTicket).mockReset();
    vi.mocked(assignTicket).mockReset();
    vi.mocked(resolveTicket).mockReset();
    vi.mocked(closeTicket).mockReset();
    vi.mocked(addTicketComment).mockReset();
  });

  it('shows a loading indicator while the ticket is being fetched', () => {
    vi.mocked(fetchTicket).mockReturnValue(new Promise(() => {}));
    renderTicketDetailPage();

    expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie zgłoszenia…');
  });

  it('shows an error state with a link back to the tickets list', async () => {
    vi.mocked(fetchTicket).mockRejectedValue(new ApiError(404, 'TICKET_NOT_FOUND', 'Nie znaleziono zgłoszenia.'));
    renderTicketDetailPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Nie znaleziono zgłoszenia.');
    expect(screen.getByRole('link', { name: 'Wróć do listy zgłoszeń' })).toHaveAttribute('href', '/tickets');
  });

  it('renders the ticket header, metadata, and description', async () => {
    vi.mocked(fetchTicket).mockResolvedValue(ticketDetail());
    renderTicketDetailPage();

    await waitFor(() => expect(screen.getByText('Nie działa drukarka')).toBeInTheDocument());
    expect(screen.getByText('HD-000001')).toBeInTheDocument();
    expect(screen.getByText('W trakcie')).toBeInTheDocument();
    expect(screen.getByText('Wysoki')).toBeInTheDocument();
    expect(screen.getByText('Sprzęt')).toBeInTheDocument();
    const metadata = within(screen.getByText('Zgłaszający').closest('dl')!);
    expect(metadata.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(metadata.getByText('Anna Nowak')).toBeInTheDocument();
    expect(screen.getByText('Drukarka nie odpowiada od rana.')).toBeInTheDocument();
    expect(fetchTicket).toHaveBeenCalledWith('t1');
  });

  it('renders comments and history entries', async () => {
    vi.mocked(fetchTicket).mockResolvedValue(ticketDetail());
    renderTicketDetailPage();

    await waitFor(() => expect(screen.getByText('Sprawdziłem kabel zasilający.')).toBeInTheDocument());
    expect(screen.getByText('Utworzono zgłoszenie HD-000001.')).toBeInTheDocument();
    expect(screen.getByText('Zmieniono status na IN_PROGRESS.')).toBeInTheDocument();
  });

  it('shows empty states for comments and history when there are none', async () => {
    vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ comments: [], history: [] }));
    renderTicketDetailPage();

    await waitFor(() => expect(screen.getByText('Brak komentarzy.')).toBeInTheDocument());
    expect(screen.getByText('Brak wpisów historii.')).toBeInTheDocument();
  });

  it('sets a generic document title while loading, then a ticket-specific one once loaded', async () => {
    vi.mocked(fetchTicket).mockResolvedValue(ticketDetail());
    renderTicketDetailPage();

    expect(document.title).toBe('Zgłoszenie — HelpDesk');
    await waitFor(() => expect(document.title).toBe('Zgłoszenie HD-000001 — HelpDesk'));
  });

  describe('role-based actions', () => {
    it('hides all staff actions and the priority selector from a USER viewing their own ticket', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail());
      renderTicketDetailPage('USER', 'u1');

      await waitFor(() => expect(screen.getByText('Nie działa drukarka')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Przejmij zgłoszenie' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Przenieś do/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Rozwiąż zgłoszenie' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Priorytet')).not.toBeInTheDocument();
    });

    it('lets a USER close their own resolved ticket after confirming the dialog', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ status: 'RESOLVED', resolvedAt: '2026-01-03T00:00:00.000Z' }));
      vi.mocked(closeTicket).mockResolvedValue({ ...ticketDetail(), status: 'CLOSED' });
      const user = userEvent.setup();
      renderTicketDetailPage('USER', 'u1');

      await waitFor(() => expect(screen.getByRole('button', { name: 'Zamknij zgłoszenie' })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Zamknij zgłoszenie' }));

      expect(closeTicket).not.toHaveBeenCalled();
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('HD-000001');

      await user.click(screen.getAllByRole('button', { name: 'Zamknij zgłoszenie' })[1]);

      expect(closeTicket).toHaveBeenCalledWith('t1');
      expect(await screen.findByText('Zgłoszenie zostało zamknięte.')).toBeInTheDocument();
    });

    it('does not close the ticket when the confirm dialog is cancelled', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ status: 'RESOLVED', resolvedAt: '2026-01-03T00:00:00.000Z' }));
      const user = userEvent.setup();
      renderTicketDetailPage('USER', 'u1');

      await waitFor(() => expect(screen.getByRole('button', { name: 'Zamknij zgłoszenie' })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Zamknij zgłoszenie' }));

      await screen.findByRole('dialog');
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(closeTicket).not.toHaveBeenCalled();
    });

    it('offers a technician "take" action when the ticket is unassigned or assigned to someone else', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail());
      vi.mocked(assignTicket).mockResolvedValue(ticketDetail());
      const user = userEvent.setup();
      renderTicketDetailPage('TECHNICIAN', 'tech2');

      await waitFor(() => expect(screen.getByRole('button', { name: 'Przejmij zgłoszenie' })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Przejmij zgłoszenie' }));

      expect(assignTicket).toHaveBeenCalledWith('t1', 'tech2');
    });

    it('does not offer "take" when the technician is already the assignee', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail());
      renderTicketDetailPage('TECHNICIAN', assignee.id);

      await waitFor(() => expect(screen.getByText('Nie działa drukarka')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Przejmij zgłoszenie' })).not.toBeInTheDocument();
    });

    it('lets a technician move an IN_PROGRESS ticket to WAITING_FOR_USER and change its priority', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ status: 'IN_PROGRESS' }));
      vi.mocked(patchTicket).mockResolvedValue(ticketDetail());
      const user = userEvent.setup();
      renderTicketDetailPage('TECHNICIAN', assignee.id);

      await waitFor(() => expect(screen.getByRole('button', { name: 'Przenieś do: Oczekujące' })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Przenieś do: Oczekujące' }));
      expect(patchTicket).toHaveBeenCalledWith('t1', { status: 'WAITING_FOR_USER' });

      await user.selectOptions(screen.getByLabelText('Priorytet'), 'CRITICAL');
      expect(patchTicket).toHaveBeenCalledWith('t1', { priority: 'CRITICAL' });
    });

    it('lets a technician resolve an IN_PROGRESS ticket after confirming the dialog', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ status: 'IN_PROGRESS' }));
      vi.mocked(resolveTicket).mockResolvedValue(ticketDetail({ status: 'RESOLVED' }));
      const user = userEvent.setup();
      renderTicketDetailPage('TECHNICIAN', assignee.id);

      await waitFor(() => expect(screen.getByRole('button', { name: 'Rozwiąż zgłoszenie' })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Rozwiąż zgłoszenie' }));

      expect(resolveTicket).not.toHaveBeenCalled();
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('HD-000001');
      await user.type(within(dialog).getByLabelText('Opis rozwiązania'), '  Wymieniono toner.  ');

      await user.click(screen.getAllByRole('button', { name: 'Rozwiąż zgłoszenie' })[1]);

      expect(resolveTicket).toHaveBeenCalledWith('t1', 'Wymieniono toner.');
      expect(await screen.findByText('Zgłoszenie zostało oznaczone jako rozwiązane.')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('requires a non-empty resolution note before resolving', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ status: 'IN_PROGRESS' }));
      const user = userEvent.setup();
      renderTicketDetailPage('TECHNICIAN', assignee.id);

      await user.click(await screen.findByRole('button', { name: 'Rozwiąż zgłoszenie' }));
      const dialog = await screen.findByRole('dialog');
      const note = within(dialog).getByLabelText('Opis rozwiązania');
      expect(note).toHaveFocus();
      await user.type(note, '   ');
      await user.click(within(dialog).getByRole('button', { name: 'Rozwiąż zgłoszenie' }));

      expect(within(dialog).getByRole('alert')).toHaveTextContent('Opisz, jak rozwiązano zgłoszenie.');
      expect(note).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(resolveTicket).not.toHaveBeenCalled();
    });

    it('offers only non-critical priorities for a service', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ type: 'SERVICE', status: 'IN_PROGRESS' }));
      renderTicketDetailPage('TECHNICIAN', assignee.id);

      const select = await screen.findByLabelText('Priorytet');
      expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['Niski', 'Średni', 'Wysoki']);
    });

    it('locks the priority once the ticket is resolved', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ status: 'RESOLVED', resolvedAt: '2026-01-03T00:00:00.000Z', resolutionNote: 'Gotowe.' }));
      renderTicketDetailPage('TECHNICIAN', assignee.id);

      await screen.findByRole('button', { name: 'Przenieś do: W trakcie' });
      expect(screen.queryByLabelText('Priorytet')).not.toBeInTheDocument();
    });

    it('does not resolve the ticket when the confirm dialog is cancelled', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ status: 'IN_PROGRESS' }));
      const user = userEvent.setup();
      renderTicketDetailPage('TECHNICIAN', assignee.id);

      await waitFor(() => expect(screen.getByRole('button', { name: 'Rozwiąż zgłoszenie' })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Rozwiąż zgłoszenie' }));

      await screen.findByRole('dialog');
      await user.click(screen.getByRole('button', { name: 'Anuluj' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(resolveTicket).not.toHaveBeenCalled();
    });

    it('does not offer resolve on a NEW ticket (no valid transition yet)', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ status: 'NEW' }));
      renderTicketDetailPage('TECHNICIAN', assignee.id);

      await waitFor(() => expect(screen.getByText('Nie działa drukarka')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Rozwiąż zgłoszenie' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Przenieś do: W trakcie' })).toBeInTheDocument();
    });

    it('shows the backend error message when an action fails', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ status: 'IN_PROGRESS' }));
      vi.mocked(resolveTicket).mockRejectedValue(new ApiError(409, 'INVALID_STATUS_TRANSITION', 'Przejście jest niedozwolone.'));
      const user = userEvent.setup();
      renderTicketDetailPage('TECHNICIAN', assignee.id);

      await waitFor(() => expect(screen.getByRole('button', { name: 'Rozwiąż zgłoszenie' })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Rozwiąż zgłoszenie' }));
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText('Opis rozwiązania'), 'Wymieniono toner.');
      await user.click(screen.getAllByRole('button', { name: 'Rozwiąż zgłoszenie' })[1]);

      expect(await screen.findByRole('alert')).toHaveTextContent('Przejście jest niedozwolone.');
    });
  });

  describe('SLA', () => {
    it('shows the type, SLA deadline and remaining working time', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail());
      renderTicketDetailPage();

      const metadata = within((await screen.findByText('Termin SLA')).closest('dl')!);
      expect(metadata.getByText('Pozostało 3 d 1 h')).toBeInTheDocument();
      expect(screen.getAllByText('Incydent').length).toBeGreaterThan(0);
      expect(screen.queryByText('Przekroczono termin SLA.')).not.toBeInTheDocument();
    });

    it('makes a breached SLA unmistakable', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(
        ticketDetail({ sla: { ...onTrackSla, state: 'BREACHED', remainingMinutes: -125 } }),
      );
      renderTicketDetailPage();

      expect(await screen.findByText('Przekroczono termin SLA.')).toBeInTheDocument();
      expect(screen.getByText(/opóźnienie: 2 h 5 min czasu roboczego/)).toBeInTheDocument();
      expect(screen.getByText('SLA przekroczone o 2 h 5 min')).toBeInTheDocument();
    });

    it('warns when the SLA deadline is close', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ sla: { ...onTrackSla, state: 'WARNING', remainingMinutes: 180 } }));
      renderTicketDetailPage();

      expect(await screen.findByText('Termin SLA zbliża się.')).toBeInTheDocument();
      expect(screen.getByText(/Pozostało 3 h czasu roboczego/)).toBeInTheDocument();
    });
  });

  it('keeps the typed resolution note when resolving fails', async () => {
    vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ status: 'IN_PROGRESS' }));
    vi.mocked(resolveTicket).mockRejectedValue(new ApiError(409, 'INVALID_STATUS_TRANSITION', 'Przejście jest niedozwolone.'));
    const user = userEvent.setup();
    renderTicketDetailPage('TECHNICIAN', assignee.id);

    await user.click(await screen.findByRole('button', { name: 'Rozwiąż zgłoszenie' }));
    await user.type(within(await screen.findByRole('dialog')).getByLabelText('Opis rozwiązania'), 'Długi opis naprawy.');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rozwiąż zgłoszenie' }));
    expect(await screen.findByText('Przejście jest niedozwolone.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rozwiąż zgłoszenie' }));
    expect(within(await screen.findByRole('dialog')).getByLabelText('Opis rozwiązania')).toHaveValue('Długi opis naprawy.');
  });

  it('does not report a zero-minute delay for a deadline missed outside working hours', async () => {
    vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ sla: { ...onTrackSla, state: 'BREACHED', remainingMinutes: 0 } }));
    renderTicketDetailPage();

    expect(await screen.findByText('Przekroczono termin SLA.')).toBeInTheDocument();
    expect(screen.queryByText(/0 min/)).not.toBeInTheDocument();
    expect(screen.getByText('SLA przekroczone')).toBeInTheDocument();
  });

  describe('resolution note', () => {
    it('shows the resolution note of a closed ticket to its requester in its own section', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(
        ticketDetail({
          status: 'CLOSED',
          resolvedAt: '2026-01-03T00:00:00.000Z',
          closedAt: '2026-01-04T00:00:00.000Z',
          resolutionNote: 'Wymieniono uszkodzony kabel sieciowy.',
          sla: { ...onTrackSla, running: false, remainingMinutes: null, state: 'MET' },
        }),
      );
      renderTicketDetailPage('USER', 'u1');

      const section = (await screen.findByRole('heading', { name: 'Opis rozwiązania' })).closest('section')!;
      expect(within(section).getByText('Wymieniono uszkodzony kabel sieciowy.')).toBeInTheDocument();
      // Kept separate from comments and history.
      expect(within(section).queryByText('Sprawdziłem kabel zasilający.')).not.toBeInTheDocument();
      expect(within(section).queryByText('Utworzono zgłoszenie HD-000001.')).not.toBeInTheDocument();
      expect(screen.getByText('SLA dotrzymane')).toBeInTheDocument();
    });

    it('explains a missing note on a ticket resolved before notes existed', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ status: 'RESOLVED', resolvedAt: '2026-01-03T00:00:00.000Z' }));
      renderTicketDetailPage('USER', 'u1');

      expect(await screen.findByText(/Brak opisu rozwiązania/)).toBeInTheDocument();
    });

    it('has no resolution section while the ticket is still being worked on', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail());
      renderTicketDetailPage('USER', 'u1');

      await screen.findByText('Nie działa drukarka');
      expect(screen.queryByRole('heading', { name: 'Opis rozwiązania' })).not.toBeInTheDocument();
    });
  });

  it('shows demo accounts by their role name only', async () => {
    const technician = { ...assignee, firstName: 'Serwisant', lastName: '' };
    vi.mocked(fetchTicket).mockResolvedValue(ticketDetail({ assignee: technician }));
    renderTicketDetailPage();

    const metadata = within((await screen.findByText('Zgłaszający')).closest('dl')!);
    expect(metadata.getByText('Serwisant', { selector: 'dd' }).textContent).toBe('Serwisant');
  });

  describe('comments', () => {
    it('rejects an empty comment and does not call the API', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail());
      const user = userEvent.setup();
      renderTicketDetailPage();

      await waitFor(() => expect(screen.getByLabelText('Dodaj komentarz')).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Dodaj komentarz' }));

      expect(await screen.findByText('Podaj treść komentarza.')).toBeInTheDocument();
      expect(addTicketComment).not.toHaveBeenCalled();
    });

    it('submits a comment and clears the form on success', async () => {
      vi.mocked(fetchTicket).mockResolvedValue(ticketDetail());
      vi.mocked(addTicketComment).mockResolvedValue({
        id: 'c2',
        content: 'Wymieniono kabel.',
        authorId: 'u1',
        ticketId: 't1',
        createdAt: '2026-01-04T00:00:00.000Z',
        updatedAt: '2026-01-04T00:00:00.000Z',
        author: { id: 'u1', firstName: 'Jan', lastName: 'Kowalski', role: 'USER' },
      });
      const user = userEvent.setup();
      renderTicketDetailPage();

      const textarea = await screen.findByLabelText('Dodaj komentarz');
      await user.type(textarea, 'Wymieniono kabel.');
      await user.click(screen.getByRole('button', { name: 'Dodaj komentarz' }));

      await waitFor(() => expect(addTicketComment).toHaveBeenCalledWith('t1', { content: 'Wymieniono kabel.' }));
      await waitFor(() => expect(textarea).toHaveValue(''));
      expect(await screen.findByText('Komentarz został dodany.')).toBeInTheDocument();
    });
  });
});
