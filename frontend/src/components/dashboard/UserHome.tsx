import { useQuery } from '@tanstack/react-query';
import { ChevronRight, PackagePlus, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { fetchTickets } from '../../api/tickets';
import type { TicketListParams, TicketType } from '../../types/ticket';
import { TYPE_DESCRIPTIONS, formatDate } from '../../utils/ticketLabels';
import { CARD_CLASSES, ERROR_PANEL_CLASSES, LOADING_PANEL_CLASSES, RETRY_BUTTON_CLASSES } from '../../utils/surfaceStyles';
import { SlaBadge, StatusBadge, TypeBadge } from '../ticket/TicketBadges';

// The requester's start page: two unmistakable "what do you need?" choices
// first, then a short list of their own tickets that are still open.
const CURRENT_TICKETS_PARAMS: TicketListParams = { pageSize: 10, sortBy: 'updatedAt', sortOrder: 'desc' };

type Choice = {
  type: TicketType;
  label: string;
  icon: LucideIcon;
  accent: string;
};

const CHOICES: Choice[] = [
  {
    type: 'SERVICE',
    label: 'Nowa usługa',
    icon: PackagePlus,
    accent: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  },
  {
    type: 'INCIDENT',
    label: 'Nowy incydent',
    icon: TriangleAlert,
    accent: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  },
];

function CurrentTickets() {
  const ticketsQuery = useQuery({
    queryKey: ['tickets', CURRENT_TICKETS_PARAMS],
    queryFn: () => fetchTickets(CURRENT_TICKETS_PARAMS),
    // SLA state is time-dependent.
    refetchInterval: 60_000,
  });

  if (ticketsQuery.isPending) {
    return (
      <div role="status" aria-live="polite" className={LOADING_PANEL_CLASSES}>
        Wczytywanie zgłoszeń…
      </div>
    );
  }
  if (ticketsQuery.isError) {
    return (
      <div role="alert" className={ERROR_PANEL_CLASSES}>
        <p>{ticketsQuery.error instanceof ApiError ? ticketsQuery.error.message : 'Nie udało się wczytać zgłoszeń.'}</p>
        <button type="button" onClick={() => ticketsQuery.refetch()} className={RETRY_BUTTON_CLASSES}>
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  const { items, pagination } = ticketsQuery.data;
  if (items.length === 0) {
    return <p className={`${CARD_CLASSES} px-4 py-6 text-sm text-slate-500 dark:text-slate-400`}>Nie masz otwartych zgłoszeń.</p>;
  }
  return (
    <div className={CARD_CLASSES}>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((ticket) => (
          <li key={ticket.id}>
            <Link
              to={`/tickets/${ticket.id}`}
              className={`flex flex-col gap-2 px-4 py-3 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-slate-800/60 ${
                ticket.sla?.state === 'BREACHED' && ticket.sla.running ? 'border-l-4 border-red-600' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{ticket.title}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {ticket.ticketNumber} · zaktualizowano {formatDate(ticket.updatedAt)}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <TypeBadge type={ticket.type} />
                <StatusBadge status={ticket.status} />
                <SlaBadge sla={ticket.sla} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {pagination.total > items.length && (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Pokazano {items.length} z {pagination.total} otwartych zgłoszeń.
        </p>
      )}
    </div>
  );
}

export function UserHome() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">W czym możemy pomóc?</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Wybierz rodzaj zgłoszenia.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CHOICES.map(({ type, label, icon: Icon, accent }) => (
          <Link
            key={type}
            to={`/tickets/new?type=${type}`}
            className={`${CARD_CLASSES} group flex items-start gap-4 p-6 transition hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:border-blue-700`}
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${accent}`}>
              <Icon aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold text-slate-900 dark:text-slate-100">{label}</span>
              <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{TYPE_DESCRIPTIONS[type]}</span>
            </span>
            <ChevronRight aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <section aria-labelledby="current-tickets-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="current-tickets-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Moje bieżące zgłoszenia
          </h2>
          <Link to="/tickets" className="rounded text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
            Wszystkie zgłoszenia
          </Link>
        </div>
        <CurrentTickets />
      </section>
    </div>
  );
}
