import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import type { Ticket } from '../types/ticket';
import { NewTicketPage } from './NewTicketPage';

vi.mock('../api/tickets', () => ({
  createTicket: vi.fn(),
}));

import { createTicket } from '../api/tickets';

function renderNewTicketPage(url = '/tickets/new?type=INCIDENT') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/tickets/new" element={<NewTicketPage />} />
          <Route path="/tickets" element={<div>Lista zgłoszeń</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { invalidateSpy };
}

const createdTicket: Ticket = {
  id: 't1',
  ticketNumber: 'HD-000042',
  title: 'Nie działa drukarka',
  description: 'Drukarka nie odpowiada od rana, sprawdzono kabel zasilający.',
  type: 'INCIDENT',
  category: 'HARDWARE',
  priority: 'MEDIUM',
  status: 'NEW',
  reporterId: 'u1',
  assigneeId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  resolvedAt: null,
  closedAt: null,
  slaDueAt: '2026-01-09T15:00:00.000Z',
  resolutionNote: null,
  sla: null,
  reporter: { id: 'u1', email: 'user@helpdesk.test', firstName: 'Użytkownik', lastName: '', role: 'USER', isActive: true },
  assignee: null,
};

const priorityOptions = () =>
  within(screen.getByLabelText('Priorytet')).getAllByRole('option').map((option) => option.textContent);

describe('NewTicketPage', () => {
  beforeEach(() => {
    vi.mocked(createTicket).mockReset();
  });

  it('uses a neutral title when no type is preselected', () => {
    renderNewTicketPage('/tickets/new');

    expect(document.title).toBe('Nowe zgłoszenie — HelpDesk');
    expect(screen.getByRole('radio', { name: /Usługa/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Incydent/ })).not.toBeChecked();
  });

  it('preselects a service from the URL and does not offer the CRITICAL priority', () => {
    renderNewTicketPage('/tickets/new?type=SERVICE');

    expect(screen.getByRole('heading', { level: 1, name: 'Nowa usługa' })).toBeInTheDocument();
    expect(document.title).toBe('Nowa usługa — HelpDesk');
    expect(screen.getByRole('radio', { name: /Usługa/ })).toBeChecked();
    expect(priorityOptions()).toEqual(['Niski', 'Średni', 'Wysoki']);
  });

  it('preselects an incident from the URL and offers all priorities', () => {
    renderNewTicketPage('/tickets/new?type=INCIDENT');

    expect(screen.getByRole('heading', { level: 1, name: 'Nowy incydent' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Incydent/ })).toBeChecked();
    expect(priorityOptions()).toEqual(['Niski', 'Średni', 'Wysoki', 'Krytyczny']);
  });

  it('drops a CRITICAL priority when switching an incident to a service', async () => {
    const user = userEvent.setup();
    renderNewTicketPage('/tickets/new?type=INCIDENT');

    await user.selectOptions(screen.getByLabelText('Priorytet'), 'CRITICAL');
    await user.click(screen.getByRole('radio', { name: /Usługa/ }));

    expect(screen.getByLabelText('Priorytet')).toHaveValue('HIGH');
    expect(priorityOptions()).not.toContain('Krytyczny');
  });

  it('requires choosing a ticket type', async () => {
    const user = userEvent.setup();
    renderNewTicketPage('/tickets/new');

    await user.type(screen.getByLabelText('Tytuł'), 'Nie działa drukarka');
    await user.type(screen.getByLabelText('Opis'), 'Drukarka nie odpowiada od rana.');
    await user.click(screen.getByRole('button', { name: 'Utwórz zgłoszenie' }));

    expect(await screen.findByText('Wybierz rodzaj zgłoszenia.')).toBeInTheDocument();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it('rejects a title and description that are too short and does not call the API', async () => {
    const user = userEvent.setup();
    renderNewTicketPage();

    await user.type(screen.getByLabelText('Tytuł'), 'ab');
    await user.type(screen.getByLabelText('Opis'), 'zbyt krótko');
    await user.click(screen.getByRole('button', { name: 'Utwórz zgłoszenie' }));

    expect(await screen.findByText('Tytuł musi mieć co najmniej 3 znaki.')).toBeInTheDocument();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it('does not allow submitting an empty ticket', async () => {
    const user = userEvent.setup();
    renderNewTicketPage();

    await user.click(screen.getByRole('button', { name: 'Utwórz zgłoszenie' }));

    expect(await screen.findByText('Tytuł musi mieć co najmniej 3 znaki.')).toBeInTheDocument();
    expect(screen.getByText('Opis musi mieć co najmniej 10 znaków.')).toBeInTheDocument();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it('creates a ticket with its type, refreshes cached lists and shows its number', async () => {
    vi.mocked(createTicket).mockResolvedValue(createdTicket);
    const user = userEvent.setup();
    const { invalidateSpy } = renderNewTicketPage('/tickets/new?type=INCIDENT');

    await user.type(screen.getByLabelText('Tytuł'), 'Nie działa drukarka');
    await user.type(screen.getByLabelText('Opis'), 'Drukarka nie odpowiada od rana.');
    await user.selectOptions(screen.getByLabelText('Kategoria'), 'HARDWARE');
    await user.selectOptions(screen.getByLabelText('Priorytet'), 'CRITICAL');
    await user.click(screen.getByRole('button', { name: 'Utwórz zgłoszenie' }));

    await waitFor(() => expect(screen.getByText('Zgłoszenie zostało utworzone')).toBeInTheDocument());
    expect(screen.getByText('HD-000042')).toBeInTheDocument();
    expect(createTicket).toHaveBeenCalledWith({
      type: 'INCIDENT',
      title: 'Nie działa drukarka',
      description: 'Drukarka nie odpowiada od rana.',
      category: 'HARDWARE',
      priority: 'CRITICAL',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tickets'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(screen.getByRole('link', { name: 'Przejdź do zgłoszenia' })).toHaveAttribute('href', '/tickets/t1');
  });

  it('lets the user navigate back to the tickets list after creating a ticket', async () => {
    vi.mocked(createTicket).mockResolvedValue(createdTicket);
    const user = userEvent.setup();
    renderNewTicketPage();

    await user.type(screen.getByLabelText('Tytuł'), 'Nie działa drukarka');
    await user.type(screen.getByLabelText('Opis'), 'Drukarka nie odpowiada od rana.');
    await user.click(screen.getByRole('button', { name: 'Utwórz zgłoszenie' }));

    await waitFor(() => expect(screen.getByText('Zgłoszenie zostało utworzone')).toBeInTheDocument());
    await user.click(screen.getByRole('link', { name: 'Wróć do listy zgłoszeń' }));

    expect(await screen.findByText('Lista zgłoszeń')).toBeInTheDocument();
  });

  it('shows the backend error message when creation fails', async () => {
    vi.mocked(createTicket).mockRejectedValue(new ApiError(422, 'VALIDATION_ERROR', 'Niepoprawne dane zgłoszenia.'));
    const user = userEvent.setup();
    renderNewTicketPage();

    await user.type(screen.getByLabelText('Tytuł'), 'Nie działa drukarka');
    await user.type(screen.getByLabelText('Opis'), 'Drukarka nie odpowiada od rana.');
    await user.click(screen.getByRole('button', { name: 'Utwórz zgłoszenie' }));

    expect(await screen.findByText('Niepoprawne dane zgłoszenia.')).toBeInTheDocument();
  });
});
