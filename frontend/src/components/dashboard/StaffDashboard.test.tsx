import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { DashboardOperations, DashboardResponse, DashboardTicketSummary } from '../../types/dashboard';
import { StaffDashboard } from './StaffDashboard';

const baseTicket: DashboardTicketSummary = {
  id: 'a1',
  ticketNumber: 'HD-000010',
  title: 'Serwer pocztowy nie odpowiada',
  type: 'INCIDENT',
  status: 'IN_PROGRESS',
  priority: 'CRITICAL',
  category: 'EMAIL',
  reporterId: 'u1',
  assigneeId: 't1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  sla: {
    dueAt: '2026-01-01T10:00:00.000Z',
    targetMinutes: 120,
    warningThresholdMinutes: 24,
    remainingMinutes: -45,
    running: true,
    dueToday: false,
    state: 'BREACHED',
  },
  reporter: { id: 'u1', firstName: 'Jan', lastName: 'Kowalski' },
  assignee: { id: 't1', firstName: 'Serwisant', lastName: '' },
};

const unassignedTicket: DashboardTicketSummary = {
  ...baseTicket,
  id: 'a2',
  ticketNumber: 'HD-000011',
  title: 'Nowy laptop dla pracownika',
  type: 'SERVICE',
  priority: 'HIGH',
  status: 'NEW',
  assigneeId: null,
  assignee: null,
  sla: { ...baseTicket.sla!, remainingMinutes: 30, state: 'WARNING', dueToday: true },
};

const operations: DashboardOperations = {
  active: 12,
  byStatus: { NEW: 4, IN_PROGRESS: 5, WAITING_FOR_USER: 2, RESOLVED: 1 },
  byType: { INCIDENT: 7, SERVICE: 5 },
  critical: 3,
  unassigned: 6,
  attention: 8,
  sla: { breached: 2, warning: 1, dueToday: 9 },
};

function dashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    tickets: { total: 13, new: 4, inProgress: 5, waitingForUser: 2, resolved: 1, critical: 3 },
    recentTickets: [{ ...baseTicket, id: 'r1', ticketNumber: 'HD-000020', title: 'Drukarka na 2. piętrze' }],
    operations,
    attentionTickets: [baseTicket, unassignedTicket],
    ...overrides,
  };
}

function renderDashboard(data: DashboardResponse) {
  return render(
    <MemoryRouter>
      <StaffDashboard data={data} />
    </MemoryRouter>,
  );
}

function linkHref(name: RegExp | string, container: HTMLElement = document.body) {
  return within(container).getByRole('link', { name }).getAttribute('href');
}

describe('StaffDashboard', () => {
  it('renders the header', () => {
    renderDashboard(dashboard());
    expect(screen.getByRole('heading', { level: 1, name: 'Pulpit' })).toBeInTheDocument();
  });

  it('links every KPI card to the matching filtered ticket list', () => {
    renderDashboard(dashboard());

    expect(linkHref(/^Aktywne\s*12/)).toBe('/tickets');
    expect(linkHref(/^Incydenty\s*7/)).toBe('/tickets?type=INCIDENT');
    expect(linkHref(/^Usługi\s*5/)).toBe('/tickets?type=SERVICE');
    expect(linkHref(/^Krytyczne\s*3/)).toBe('/tickets?priority=CRITICAL');
    expect(linkHref(/^Nieprzypisane\s*6/)).toBe('/tickets?unassigned=true');
    expect(linkHref(/^Wymagające uwagi\s*8/)).toBe('/tickets?sla=ATTENTION&sortBy=slaDueAt&sortOrder=asc');
  });

  it('links the SLA cards and highlights breaches in red', () => {
    renderDashboard(dashboard());

    const breached = screen.getByRole('link', { name: /^Przekroczone SLA\s*2/ });
    expect(breached).toHaveAttribute('href', '/tickets?sla=BREACHED&sortBy=slaDueAt&sortOrder=asc');
    expect(breached.className).toMatch(/bg-red-50/);
    const warning = screen.getByRole('link', { name: /^Ostrzeżenie SLA\s*1/ });
    expect(warning).toHaveAttribute('href', '/tickets?sla=WARNING&sortBy=slaDueAt&sortOrder=asc');
    expect(warning.className).toMatch(/bg-amber-50/);
    expect(linkHref(/^Termin dziś\s*9/)).toBe('/tickets?sla=DUE_TODAY&sortBy=slaDueAt&sortOrder=asc');
  });

  it('keeps zero SLA counts calm (no red or amber)', () => {
    renderDashboard(dashboard({ operations: { ...operations, sla: { breached: 0, warning: 0, dueToday: 0 } } }));

    const breached = screen.getByRole('link', { name: /^Przekroczone SLA\s*0/ });
    expect(breached.className).not.toMatch(/red/);
    expect(breached).toHaveTextContent('Brak przekroczeń');
    expect(screen.getByRole('link', { name: /^Ostrzeżenie SLA\s*0/ }).className).not.toMatch(/amber/);
  });

  it('charts active tickets by status with visible counts and status links', () => {
    renderDashboard(dashboard());

    const chart = screen.getByRole('region', { name: 'Zgłoszenia według statusu' });
    expect(within(chart).getByText('Bez zamkniętych · łącznie 12')).toBeInTheDocument();
    const inProgress = within(chart).getByRole('link', { name: 'W trakcie: 5 — pokaż zgłoszenia' });
    expect(inProgress).toHaveAttribute('href', '/tickets?status=IN_PROGRESS');
    expect(inProgress).toHaveTextContent('5');
    expect(within(chart).getByRole('link', { name: 'Nowe: 4 — pokaż zgłoszenia' })).toHaveAttribute('href', '/tickets?status=NEW');
    expect(within(chart).getByRole('link', { name: 'Oczekujące: 2 — pokaż zgłoszenia' })).toHaveAttribute('href', '/tickets?status=WAITING_FOR_USER');
    expect(within(chart).getByRole('link', { name: 'Rozwiązane: 1 — pokaż zgłoszenia' })).toHaveAttribute('href', '/tickets?status=RESOLVED');
    // Bars are scaled to the largest status.
    expect(screen.getByTestId('status-bar-IN_PROGRESS').style.width).toBe('max(4px, 100%)');
  });

  it('renders a sensible chart when every count is zero', () => {
    renderDashboard(
      dashboard({ operations: { ...operations, byStatus: { NEW: 0, IN_PROGRESS: 0, WAITING_FOR_USER: 0, RESOLVED: 0 } } }),
    );

    const chart = screen.getByRole('region', { name: 'Zgłoszenia według statusu' });
    expect(within(chart).getByText('Brak otwartych zgłoszeń.')).toBeInTheDocument();
    expect(within(chart).getByRole('link', { name: 'Nowe: 0 — pokaż zgłoszenia' })).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-NEW').style.width).toBe('0px');
  });

  it('renders the attention queue with badges, assignee and links', () => {
    renderDashboard(dashboard());

    const queue = screen.getByRole('region', { name: /Wymagające uwagi/ });
    const first = within(queue).getByRole('link', { name: /HD-000010/ });
    expect(first).toHaveAttribute('href', '/tickets/a1');
    expect(first).toHaveTextContent('Serwer pocztowy nie odpowiada');
    expect(first).toHaveTextContent('Incydent');
    expect(first).toHaveTextContent('Krytyczny');
    expect(first).toHaveTextContent('SLA przekroczone o 45 min');
    expect(first).toHaveTextContent('Serwisant');
    const second = within(queue).getByRole('link', { name: /HD-000011/ });
    expect(second).toHaveTextContent('Usługa');
    expect(second).toHaveTextContent('Nieprzypisane');
    expect(within(queue).getByRole('link', { name: 'Zobacz wszystkie zgłoszenia wymagające uwagi' })).toHaveAttribute(
      'href',
      '/tickets?sla=ATTENTION&sortBy=slaDueAt&sortOrder=asc',
    );
  });

  it('shows a calm empty attention queue', () => {
    renderDashboard(dashboard({ attentionTickets: [] }));
    expect(screen.getByText('Brak zgłoszeń wymagających uwagi.')).toBeInTheDocument();
  });

  it('keeps the recent tickets list', () => {
    renderDashboard(dashboard());

    const recent = screen.getByRole('region', { name: 'Najnowsze zgłoszenia' });
    expect(within(recent).getByRole('link', { name: /HD-000020/ })).toHaveAttribute('href', '/tickets/r1');
    expect(within(recent).getByText('Jan Kowalski → Serwisant')).toBeInTheDocument();
    expect(within(recent).getByRole('link', { name: 'Zobacz wszystkie zgłoszenia' })).toHaveAttribute('href', '/tickets');
  });

  it('shows user statistics only when the response includes them (admin)', () => {
    const { unmount } = renderDashboard(dashboard());
    expect(screen.queryByRole('heading', { name: 'Użytkownicy systemu' })).not.toBeInTheDocument();
    unmount();

    renderDashboard(dashboard({ users: { users: 20, technicians: 4, admins: 2 } }));
    const users = screen.getByRole('region', { name: 'Użytkownicy systemu' });
    expect(within(users).getByText('Serwisanci')).toBeInTheDocument();
    expect(within(users).getByText('4')).toBeInTheDocument();
    expect(within(users).getByText('20')).toBeInTheDocument();
  });
});
