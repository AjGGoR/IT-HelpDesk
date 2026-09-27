import { CalendarClock, CircleCheck, Clock, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { ActiveTicketStatus, DashboardOperations, DashboardResponse, DashboardTicketSummary } from '../../types/dashboard';
import { displayName } from '../../utils/person';
import { STATUS_LABELS, formatDate } from '../../utils/ticketLabels';
import { CARD_CLASSES } from '../../utils/surfaceStyles';
import { PriorityBadge, SlaBadge, StatusBadge, TypeBadge } from '../ticket/TicketBadges';

// Every link below targets the default /tickets scope (non-CLOSED tickets),
// which is exactly the scope the backend counts `operations` over, so the
// number on a card always matches the length of the list it opens.
const SLA_SORT = 'sortBy=slaDueAt&sortOrder=asc';
const DASHBOARD_LINKS = {
  active: '/tickets',
  incidents: '/tickets?type=INCIDENT',
  services: '/tickets?type=SERVICE',
  critical: '/tickets?priority=CRITICAL',
  unassigned: '/tickets?unassigned=true',
  attention: `/tickets?sla=ATTENTION&${SLA_SORT}`,
  breached: `/tickets?sla=BREACHED&${SLA_SORT}`,
  warning: `/tickets?sla=WARNING&${SLA_SORT}`,
  dueToday: `/tickets?sla=DUE_TODAY&${SLA_SORT}`,
  status: (status: ActiveTicketStatus) => `/tickets?status=${status}`,
} as const;

const CHART_STATUSES: ActiveTicketStatus[] = ['NEW', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED'];

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const CARD_LINK_CLASSES = `block rounded-xl border p-4 shadow-sm transition ${FOCUS_RING}`;
const NEUTRAL_CARD_LINK_CLASSES = `${CARD_LINK_CLASSES} border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/60`;
const SECTION_TITLE_CLASSES = 'text-sm font-semibold text-slate-900 dark:text-slate-100';
const SECTION_HEAD_CLASSES = 'flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800';
const TEXT_LINK_CLASSES = `rounded text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300 ${FOCUS_RING}`;
const ROW_LINK_CLASSES = `block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${FOCUS_RING} focus-visible:ring-inset`;

function isBreachedRunning(ticket: DashboardTicketSummary): boolean {
  return ticket.sla?.state === 'BREACHED' && ticket.sla.running;
}

function KpiCard({ label, value, to, hint }: { label: string; value: number; to: string; hint?: string }) {
  return (
    <Link to={to} className={NEUTRAL_CARD_LINK_CLASSES}>
      <span className="block text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className="mt-1 block text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</span>
      {hint && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </Link>
  );
}

type SlaTone = 'critical' | 'warning' | 'neutral';

const SLA_TONE_CLASSES: Record<SlaTone, { card: string; value: string; icon: string }> = {
  critical: {
    card: `${CARD_LINK_CLASSES} border-red-300 bg-red-50 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:hover:bg-red-950`,
    value: 'text-red-700 dark:text-red-300',
    icon: 'text-red-600 dark:text-red-400',
  },
  warning: {
    card: `${CARD_LINK_CLASSES} border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:hover:bg-amber-950`,
    value: 'text-amber-800 dark:text-amber-300',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  neutral: {
    card: NEUTRAL_CARD_LINK_CLASSES,
    value: 'text-slate-900 dark:text-slate-100',
    icon: 'text-slate-400 dark:text-slate-500',
  },
};

function SlaCard({ label, value, hint, to, tone, icon }: {
  label: string;
  value: number;
  hint: string;
  to: string;
  tone: SlaTone;
  icon: ReactNode;
}) {
  const classes = SLA_TONE_CLASSES[tone];
  return (
    <Link to={to} className={classes.card}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span aria-hidden="true" className={classes.icon}>
          {icon}
        </span>
      </span>
      <span className={`mt-1 block text-2xl font-semibold tabular-nums ${classes.value}`}>{value}</span>
      <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{hint}</span>
    </Link>
  );
}

function StatusChart({ operations }: { operations: DashboardOperations }) {
  const counts = CHART_STATUSES.map((status) => ({ status, count: operations.byStatus[status] ?? 0 }));
  const max = Math.max(0, ...counts.map((entry) => entry.count));
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section aria-labelledby="dashboard-status-heading" className={CARD_CLASSES}>
      <div className={SECTION_HEAD_CLASSES}>
        <h2 id="dashboard-status-heading" className={SECTION_TITLE_CLASSES}>
          Zgłoszenia według statusu
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">Bez zamkniętych · łącznie {total}</span>
      </div>
      <ul className="space-y-1 p-2">
        {counts.map(({ status, count }) => {
          const label = STATUS_LABELS[status];
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          // Single series → one hue; bar length is relative to the largest
          // status so small differences stay visible. A non-zero count always
          // keeps a visible stub; zero draws no bar (the "0" text says it).
          const width = max > 0 && count > 0 ? `max(4px, ${(count / max) * 100}%)` : '0';
          return (
            <li key={status}>
              <Link
                to={DASHBOARD_LINKS.status(status)}
                aria-label={`${label}: ${count} — pokaż zgłoszenia`}
                title={`${label}: ${count} (${share}% aktywnych)`}
                className={`grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${FOCUS_RING}`}
              >
                <span className="truncate text-sm text-slate-700 dark:text-slate-300">{label}</span>
                <span className="block h-3">
                  <span
                    data-testid={`status-bar-${status}`}
                    className="block h-3 rounded-r bg-blue-600 dark:bg-blue-400"
                    style={{ width }}
                  />
                </span>
                <span className="text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {total === 0 && (
        <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Brak otwartych zgłoszeń.
        </p>
      )}
    </section>
  );
}

function AttentionQueue({ tickets, total }: { tickets: DashboardTicketSummary[]; total: number | undefined }) {
  return (
    <section aria-labelledby="dashboard-attention-heading" className={CARD_CLASSES}>
      <div className={SECTION_HEAD_CLASSES}>
        <h2 id="dashboard-attention-heading" className={SECTION_TITLE_CLASSES}>
          Wymagające uwagi
          {total !== undefined && <span className="ml-1.5 font-normal tabular-nums text-slate-500 dark:text-slate-400">({total})</span>}
        </h2>
        <Link to={DASHBOARD_LINKS.attention} aria-label="Zobacz wszystkie zgłoszenia wymagające uwagi" className={TEXT_LINK_CLASSES}>
          Zobacz wszystkie
        </Link>
      </div>
      {tickets.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
          <CircleCheck aria-hidden="true" className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          Brak zgłoszeń wymagających uwagi.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {tickets.map((ticket) => (
            <li
              key={ticket.id}
              className={isBreachedRunning(ticket) ? 'border-l-4 border-l-red-600 bg-red-50/50 dark:border-l-red-500 dark:bg-red-950/20' : 'border-l-4 border-l-transparent'}
            >
              <Link to={`/tickets/${ticket.id}`} className={ROW_LINK_CLASSES}>
                <span className="flex min-w-0 items-baseline gap-2 text-sm">
                  <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{ticket.ticketNumber}</span>
                  <span className="truncate font-medium text-slate-900 dark:text-slate-100">{ticket.title}</span>
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <TypeBadge type={ticket.type} />
                  <PriorityBadge priority={ticket.priority} />
                  <SlaBadge sla={ticket.sla} />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {ticket.assignee ? (
                      displayName(ticket.assignee)
                    ) : (
                      <span className="font-medium text-slate-800 dark:text-slate-200">Nieprzypisane</span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentTickets({ tickets }: { tickets: DashboardTicketSummary[] }) {
  return (
    <section aria-labelledby="dashboard-recent-heading" className={CARD_CLASSES}>
      <div className={SECTION_HEAD_CLASSES}>
        <h2 id="dashboard-recent-heading" className={SECTION_TITLE_CLASSES}>
          Najnowsze zgłoszenia
        </h2>
        <Link to="/tickets" aria-label="Zobacz wszystkie zgłoszenia" className={TEXT_LINK_CLASSES}>
          Zobacz wszystkie
        </Link>
      </div>
      {tickets.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Brak zgłoszeń w systemie.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link to={`/tickets/${ticket.id}`} className={`${ROW_LINK_CLASSES} sm:flex sm:items-center sm:justify-between sm:gap-3 sm:py-2.5`}>
                <span className="block min-w-0 sm:flex-1">
                  <span className="flex min-w-0 items-baseline gap-2 text-sm">
                    <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{ticket.ticketNumber}</span>
                    <span className="truncate font-medium text-slate-900 dark:text-slate-100">{ticket.title}</span>
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {displayName(ticket.reporter)} → {ticket.assignee ? displayName(ticket.assignee) : 'nieprzypisane'}
                  </span>
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:mt-0 sm:shrink-0">
                  <TypeBadge type={ticket.type} />
                  <PriorityBadge priority={ticket.priority} />
                  <StatusBadge status={ticket.status} />
                  <SlaBadge sla={ticket.sla} />
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{formatDate(ticket.updatedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UserStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <dt className="text-sm text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

export function StaffDashboard({ data }: { data: DashboardResponse }) {
  const operations = data.operations;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Pulpit</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Bieżące zgłoszenia i terminy SLA. Kliknij kafelek, aby otworzyć odpowiednią listę.
        </p>
      </div>

      {operations && (
        <>
          <section aria-labelledby="dashboard-kpi-heading">
            <h2 id="dashboard-kpi-heading" className="sr-only">
              Przegląd zgłoszeń
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard label="Aktywne" value={operations.active} to={DASHBOARD_LINKS.active} hint="Bez zamkniętych" />
              <KpiCard label="Incydenty" value={operations.byType.INCIDENT} to={DASHBOARD_LINKS.incidents} />
              <KpiCard label="Usługi" value={operations.byType.SERVICE} to={DASHBOARD_LINKS.services} />
              <KpiCard label="Krytyczne" value={operations.critical} to={DASHBOARD_LINKS.critical} />
              <KpiCard label="Nieprzypisane" value={operations.unassigned} to={DASHBOARD_LINKS.unassigned} />
              <KpiCard label="Wymagające uwagi" value={operations.attention} to={DASHBOARD_LINKS.attention} />
            </div>
          </section>

          <section aria-labelledby="dashboard-sla-heading">
            <h2 id="dashboard-sla-heading" className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Terminy SLA
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SlaCard
                label="Przekroczone SLA"
                value={operations.sla.breached}
                hint={operations.sla.breached > 0 ? 'Termin minął — wymagają natychmiastowej reakcji' : 'Brak przekroczeń'}
                to={DASHBOARD_LINKS.breached}
                tone={operations.sla.breached > 0 ? 'critical' : 'neutral'}
                icon={operations.sla.breached > 0 ? <TriangleAlert className="h-5 w-5" /> : <CircleCheck className="h-5 w-5" />}
              />
              <SlaCard
                label="Ostrzeżenie SLA"
                value={operations.sla.warning}
                hint="Termin zbliża się do końca"
                to={DASHBOARD_LINKS.warning}
                tone={operations.sla.warning > 0 ? 'warning' : 'neutral'}
                icon={<Clock className="h-5 w-5" />}
              />
              <SlaCard
                label="Termin dziś"
                value={operations.sla.dueToday}
                hint="Upływa w bieżącym dniu roboczym"
                to={DASHBOARD_LINKS.dueToday}
                tone="neutral"
                icon={<CalendarClock className="h-5 w-5" />}
              />
            </div>
          </section>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {operations && (
          <div className="lg:col-span-2">
            <StatusChart operations={operations} />
          </div>
        )}
        <div className={operations ? 'min-w-0 lg:col-span-3' : 'min-w-0 lg:col-span-5'}>
          <AttentionQueue tickets={data.attentionTickets ?? []} total={operations?.attention} />
        </div>
      </div>

      <RecentTickets tickets={data.recentTickets} />

      {data.users && (
        <section aria-labelledby="dashboard-users-heading" className={CARD_CLASSES}>
          <div className={SECTION_HEAD_CLASSES}>
            <h2 id="dashboard-users-heading" className={SECTION_TITLE_CLASSES}>
              Użytkownicy systemu
            </h2>
            <Link to="/admin/users" aria-label="Zarządzaj użytkownikami systemu" className={TEXT_LINK_CLASSES}>
              Zarządzaj
            </Link>
          </div>
          <dl className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            <UserStat label="Użytkownicy" value={data.users.users} />
            <UserStat label="Serwisanci" value={data.users.technicians} />
            <UserStat label="Administratorzy" value={data.users.admins} />
          </dl>
        </section>
      )}
    </div>
  );
}
