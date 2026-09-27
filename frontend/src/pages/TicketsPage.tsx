import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { fetchTickets } from '../api/tickets';
import { PriorityBadge, SlaBadge, StatusBadge, TypeBadge } from '../components/ticket/TicketBadges';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type {
  SlaFilter,
  Ticket,
  TicketCategory,
  TicketListParams,
  TicketListSortBy,
  TicketListSortOrder,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../types/ticket';
import { displayName } from '../utils/person';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS, formatDate } from '../utils/ticketLabels';
import { CARD_CLASSES, ERROR_PANEL_CLASSES, LOADING_PANEL_CLASSES, RETRY_BUTTON_CLASSES } from '../utils/surfaceStyles';
import { PRIMARY_BUTTON_CLASSES } from '../utils/formStyles';

const PAGE_SIZE = 20;
const DEFAULT_SORT_BY: TicketListSortBy = 'updatedAt';
const DEFAULT_SORT_ORDER: TicketListSortOrder = 'desc';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const FILTER_LABEL_CLASSES = 'block text-xs font-medium text-slate-600 dark:text-slate-400';
const FILTER_INPUT_CLASSES = `w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 ${FOCUS_RING} dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`;
const CHECKBOX_LABEL_CLASSES = 'inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300';
const CHECKBOX_CLASSES = `h-4 w-4 rounded border-slate-300 text-blue-700 ${FOCUS_RING} dark:border-slate-600 dark:bg-slate-800`;
const PAGINATION_BUTTON_CLASSES = `rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800`;

const SORT_OPTIONS: { value: TicketListSortBy; label: string }[] = [
  { value: 'updatedAt', label: 'Data aktualizacji' },
  { value: 'createdAt', label: 'Data utworzenia' },
  { value: 'priority', label: 'Priorytet' },
  { value: 'status', label: 'Status' },
  { value: 'slaDueAt', label: 'Termin SLA' },
];

const SLA_FILTER_LABELS: Record<SlaFilter, string> = {
  BREACHED: 'Przekroczone',
  WARNING: 'Ostrzeżenie',
  DUE_TODAY: 'Termin dziś',
  ATTENTION: 'Wymagające uwagi',
};

// Allowed values for every URL-driven filter; anything else in the query
// string (hand-edited or stale links) is ignored rather than sent to the API.
function pickEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}
const keysOf = <T extends string>(record: Record<T, string>) => Object.keys(record) as T[];
const STATUSES = keysOf(STATUS_LABELS);
const PRIORITIES = keysOf(PRIORITY_LABELS);
const CATEGORIES = keysOf(CATEGORY_LABELS);
const TYPES = keysOf(TYPE_LABELS);
const SLA_FILTERS = keysOf(SLA_FILTER_LABELS);
const SORT_BY_VALUES = SORT_OPTIONS.map((option) => option.value);
const SORT_ORDERS: readonly TicketListSortOrder[] = ['asc', 'desc'];

type Filters = {
  search: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  type?: TicketType;
  sla?: SlaFilter;
  unassigned: boolean;
  includeClosed: boolean;
  sortBy: TicketListSortBy;
  sortOrder: TicketListSortOrder;
  page: number;
};

function parseFilters(searchParams: URLSearchParams): Filters {
  const page = Number(searchParams.get('page'));
  return {
    search: (searchParams.get('search') ?? '').trim(),
    status: pickEnum(searchParams.get('status'), STATUSES),
    priority: pickEnum(searchParams.get('priority'), PRIORITIES),
    category: pickEnum(searchParams.get('category'), CATEGORIES),
    type: pickEnum(searchParams.get('type'), TYPES),
    sla: pickEnum(searchParams.get('sla'), SLA_FILTERS),
    unassigned: searchParams.get('unassigned') === 'true',
    includeClosed: searchParams.get('includeClosed') === 'true',
    sortBy: pickEnum(searchParams.get('sortBy'), SORT_BY_VALUES) ?? DEFAULT_SORT_BY,
    sortOrder: pickEnum(searchParams.get('sortOrder'), SORT_ORDERS) ?? DEFAULT_SORT_ORDER,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

// URL keys whose change must send the user back to page 1.
type FilterKey = 'search' | 'status' | 'priority' | 'category' | 'type' | 'sla' | 'unassigned' | 'includeClosed' | 'sortBy' | 'sortOrder';
type ParamChanges = Partial<Record<FilterKey | 'page', string | null>>;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

function isBreachedRunning(ticket: Ticket): boolean {
  return ticket.sla?.state === 'BREACHED' && ticket.sla.running;
}

function FilterSelect<T extends string>({ id, label, value, options, onChange, allLabel = 'Wszystkie' }: {
  id: string;
  label: string;
  value: T | undefined;
  options: Record<T, string>;
  onChange: (value: T | null) => void;
  allLabel?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={FILTER_LABEL_CLASSES}>
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value ? (event.target.value as T) : null)}
        className={`mt-1 ${FILTER_INPUT_CLASSES}`}
      >
        <option value="">{allLabel}</option>
        {keysOf(options).map((key) => (
          <option key={key} value={key}>
            {options[key]}
          </option>
        ))}
      </select>
    </div>
  );
}

function assigneeLabel(ticket: Ticket): string {
  return ticket.assignee ? displayName(ticket.assignee) : 'Nieprzypisane';
}

function TicketTable({ tickets, isStaff }: { tickets: Ticket[]; isStaff: boolean }) {
  return (
    <table className="w-full table-fixed text-left text-sm">
      <caption className="sr-only">Lista zgłoszeń z typem, priorytetem, statusem, stanem SLA i przypisaniem</caption>
      <colgroup>
        <col />
        <col className="w-28" />
        <col className="w-32" />
        <col className="w-52" />
        <col className="w-40" />
      </colgroup>
      <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <tr>
          <th scope="col" className="px-3 py-2">Zgłoszenie</th>
          <th scope="col" className="px-3 py-2">Typ / priorytet</th>
          <th scope="col" className="px-3 py-2">Status</th>
          <th scope="col" className="px-3 py-2">SLA</th>
          <th scope="col" className="px-3 py-2">Serwisant / zmiana</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {tickets.map((ticket) => {
          const breached = isBreachedRunning(ticket);
          return (
            <tr
              key={ticket.id}
              className={
                breached
                  ? 'bg-red-50/70 hover:bg-red-50 dark:bg-red-950/30 dark:hover:bg-red-950/50'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }
            >
              <td
                className={`px-3 py-3 align-top ${
                  breached ? 'shadow-[inset_4px_0_0_0_theme(colors.red.600)]' : ''
                }`}
              >
                <Link to={`/tickets/${ticket.id}`} className={`group block min-w-0 rounded ${FOCUS_RING}`}>
                  <span className="block text-xs tabular-nums text-slate-500 dark:text-slate-400">{ticket.ticketNumber}</span>
                  <span className="block truncate font-medium text-slate-900 group-hover:underline dark:text-slate-100" title={ticket.title}>
                    {ticket.title}
                  </span>
                </Link>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {CATEGORY_LABELS[ticket.category]}
                  {isStaff && <> · {displayName(ticket.reporter)}</>}
                </span>
              </td>
              <td className="px-3 py-3 align-top">
                <span className="flex flex-col items-start gap-1">
                  <TypeBadge type={ticket.type} />
                  <PriorityBadge priority={ticket.priority} />
                </span>
              </td>
              <td className="px-3 py-3 align-top">
                <StatusBadge status={ticket.status} />
              </td>
              <td className="px-3 py-3 align-top">
                <SlaBadge sla={ticket.sla} />
              </td>
              <td className="px-3 py-3 align-top">
                <span
                  className={`block truncate ${
                    ticket.assignee ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {assigneeLabel(ticket)}
                </span>
                <span className="block text-xs tabular-nums text-slate-500 dark:text-slate-400">{formatDate(ticket.updatedAt)}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TicketCards({ tickets, isStaff }: { tickets: Ticket[]; isStaff: boolean }) {
  return (
    <ul aria-label="Lista zgłoszeń" className="divide-y divide-slate-100 dark:divide-slate-800">
      {tickets.map((ticket) => {
        const breached = isBreachedRunning(ticket);
        return (
          <li
            key={ticket.id}
            className={
              breached
                ? 'border-l-4 border-l-red-600 bg-red-50/70 dark:border-l-red-500 dark:bg-red-950/30'
                : 'border-l-4 border-l-transparent'
            }
          >
            <Link
              to={`/tickets/${ticket.id}`}
              className={`block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${FOCUS_RING} focus-visible:ring-inset`}
            >
              <span className="flex items-baseline justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="tabular-nums">{ticket.ticketNumber}</span>
                <span className="tabular-nums">{formatDate(ticket.updatedAt)}</span>
              </span>
              <span className="mt-0.5 block break-words font-medium text-slate-900 dark:text-slate-100">{ticket.title}</span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                <TypeBadge type={ticket.type} />
                <PriorityBadge priority={ticket.priority} />
                <StatusBadge status={ticket.status} />
                <SlaBadge sla={ticket.sla} />
              </span>
              <span className="mt-2 block text-xs text-slate-600 dark:text-slate-400">
                {CATEGORY_LABELS[ticket.category]}
                {isStaff && <> · Zgłaszający: {displayName(ticket.reporter)}</>} · Serwisant: {assigneeLabel(ticket)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function TicketsPage() {
  useDocumentTitle('Zgłoszenia');
  const { user } = useAuth();
  const isStaff = user?.role === 'TECHNICIAN' || user?.role === 'ADMIN';
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);

  // Writes filter changes to the URL (the single source of truth). Any
  // filter/sort change drops `page` so the list restarts at page 1; default
  // values are removed so shared links stay short.
  const updateParams = useCallback(
    (changes: ParamChanges, options: { replace?: boolean } = {}) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === undefined || value === '') next.delete(key);
            else next.set(key, value);
          }
          if (!('page' in changes)) next.delete('page');
          if (next.get('sortBy') === DEFAULT_SORT_BY) next.delete('sortBy');
          if (next.get('sortOrder') === DEFAULT_SORT_ORDER) next.delete('sortOrder');
          return next;
        },
        { replace: options.replace },
      );
    },
    [setSearchParams],
  );

  // The search box keeps its own (undebounced) state; the debounced, trimmed
  // value is written to the URL with `replace` so typing does not flood the
  // history. When the URL changes from elsewhere (back button, "Wyczyść
  // filtry") the box follows it.
  const [searchInput, setSearchInput] = useState(filters.search);
  const [syncedSearch, setSyncedSearch] = useState(filters.search);
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search);
    if (filters.search !== searchInput.trim()) setSearchInput(filters.search);
  }
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const urlSearch = filters.search;
  const searchSettled = debouncedSearch === searchInput.trim();
  useEffect(() => {
    if (searchSettled && debouncedSearch !== urlSearch) {
      updateParams({ search: debouncedSearch || null }, { replace: true });
    }
  }, [debouncedSearch, searchSettled, urlSearch, updateParams]);

  const params: TicketListParams = {
    page: filters.page,
    pageSize: PAGE_SIZE,
    search: filters.search || undefined,
    status: filters.status,
    priority: filters.priority,
    category: filters.category,
    type: filters.type,
    sla: filters.sla,
    unassigned: isStaff && filters.unassigned ? true : undefined,
    includeClosed: !filters.status && filters.includeClosed ? true : undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  };

  const ticketsQuery = useQuery({
    queryKey: ['tickets', params],
    queryFn: () => fetchTickets(params),
    placeholderData: (previous) => previous,
    // SLA state is time-dependent.
    refetchInterval: 60_000,
  });
  const data = ticketsQuery.data;

  // A page beyond the last one (stale link, or tickets closed meanwhile)
  // would show an empty list with no pagination controls: clamp it.
  const lastPage = data?.pagination.totalPages ?? 0;
  useEffect(() => {
    if (!ticketsQuery.isPlaceholderData && lastPage > 0 && filters.page > lastPage)
      updateParams({ page: lastPage > 1 ? String(lastPage) : null }, { replace: true });
  }, [ticketsQuery.isPlaceholderData, lastPage, filters.page, updateParams]);

  const activeFilters: { key: FilterKey; label: string }[] = [];
  if (filters.search) activeFilters.push({ key: 'search', label: `Szukaj: „${filters.search}”` });
  if (filters.status) activeFilters.push({ key: 'status', label: `Status: ${STATUS_LABELS[filters.status]}` });
  if (filters.priority) activeFilters.push({ key: 'priority', label: `Priorytet: ${PRIORITY_LABELS[filters.priority]}` });
  if (filters.category) activeFilters.push({ key: 'category', label: `Kategoria: ${CATEGORY_LABELS[filters.category]}` });
  if (filters.type) activeFilters.push({ key: 'type', label: `Typ: ${TYPE_LABELS[filters.type]}` });
  if (filters.sla) activeFilters.push({ key: 'sla', label: `SLA: ${SLA_FILTER_LABELS[filters.sla]}` });
  if (isStaff && filters.unassigned) activeFilters.push({ key: 'unassigned', label: 'Tylko nieprzypisane' });
  if (filters.includeClosed && !filters.status) activeFilters.push({ key: 'includeClosed', label: 'Z zamkniętymi' });

  const clearFilters = () => {
    setSearchInput('');
    updateParams({
      search: null,
      status: null,
      priority: null,
      category: null,
      type: null,
      sla: null,
      unassigned: null,
      includeClosed: null,
    });
  };

  const removeFilter = (key: FilterKey) => {
    if (key === 'search') setSearchInput('');
    updateParams({ [key]: null } as ParamChanges);
  };

  const setPage = (page: number) => updateParams({ page: page > 1 ? String(page) : null });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Zgłoszenia</h1>
        <Link to="/tickets/new" className={PRIMARY_BUTTON_CLASSES}>
          + Nowe zgłoszenie
        </Link>
      </div>

      <div className={`space-y-4 p-4 ${CARD_CLASSES}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2 lg:col-span-2">
            <label htmlFor="ticket-search" className={FILTER_LABEL_CLASSES}>
              Szukaj
            </label>
            <input
              id="ticket-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Numer, tytuł, opis…"
              className={`mt-1 ${FILTER_INPUT_CLASSES}`}
            />
          </div>
          <FilterSelect
            id="ticket-status"
            label="Status"
            value={filters.status}
            options={STATUS_LABELS}
            allLabel={filters.includeClosed ? 'Wszystkie' : 'Wszystkie bez zamkniętych'}
            onChange={(value) => updateParams({ status: value })}
          />
          <FilterSelect
            id="ticket-priority"
            label="Priorytet"
            value={filters.priority}
            options={PRIORITY_LABELS}
            onChange={(value) => updateParams({ priority: value })}
          />
          <FilterSelect
            id="ticket-category"
            label="Kategoria"
            value={filters.category}
            options={CATEGORY_LABELS}
            onChange={(value) => updateParams({ category: value })}
          />
          <FilterSelect
            id="ticket-type"
            label="Typ"
            value={filters.type}
            options={TYPE_LABELS}
            onChange={(value) => updateParams({ type: value })}
          />
          <FilterSelect
            id="ticket-sla"
            label="SLA"
            value={filters.sla}
            options={SLA_FILTER_LABELS}
            onChange={(value) => updateParams({ sla: value })}
          />
          <div className="sm:col-span-2 lg:col-span-2">
            <label htmlFor="ticket-sort" className={FILTER_LABEL_CLASSES}>
              Sortuj według
            </label>
            <div className="mt-1 flex gap-1">
              <select
                id="ticket-sort"
                value={filters.sortBy}
                onChange={(event) => {
                  const sortBy = event.target.value as TicketListSortBy;
                  // The nearest SLA deadline first is the only useful default
                  // for "Termin SLA"; other sorts keep the current direction.
                  updateParams(sortBy === 'slaDueAt' ? { sortBy, sortOrder: 'asc' } : { sortBy });
                }}
                className={FILTER_INPUT_CLASSES}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => updateParams({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
                aria-label={filters.sortOrder === 'asc' ? 'Sortowanie rosnące' : 'Sortowanie malejące'}
                className={`shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 ${FOCUS_RING} dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800`}
              >
                {filters.sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
          <div className="flex flex-col justify-end gap-2 sm:col-span-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 lg:col-span-4 lg:pb-1.5">
            <label className={CHECKBOX_LABEL_CLASSES}>
              <input
                type="checkbox"
                className={CHECKBOX_CLASSES}
                checked={filters.includeClosed && !filters.status}
                disabled={filters.status !== undefined}
                onChange={(event) => updateParams({ includeClosed: event.target.checked ? 'true' : null })}
              />
              Pokaż zamknięte
            </label>
            {isStaff && (
              <label className={CHECKBOX_LABEL_CLASSES}>
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASSES}
                  checked={filters.unassigned}
                  onChange={(event) => updateParams({ unassigned: event.target.checked ? 'true' : null })}
                />
                Tylko nieprzypisane
              </label>
            )}
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Aktywne filtry:</span>
            <ul className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <li key={filter.key}>
                  <button
                    type="button"
                    onClick={() => removeFilter(filter.key)}
                    aria-label={`Usuń filtr ${filter.label}`}
                    className={`inline-flex max-w-full items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 ${FOCUS_RING} dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900`}
                  >
                    <span className="truncate">{filter.label}</span>
                    <X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={clearFilters}
              className={`rounded text-xs font-medium text-blue-700 hover:underline ${FOCUS_RING} dark:text-blue-400`}
            >
              Wyczyść filtry
            </button>
          </div>
        )}
      </div>

      {ticketsQuery.isPending && (
        <div role="status" aria-live="polite" className={LOADING_PANEL_CLASSES}>
          Wczytywanie zgłoszeń…
        </div>
      )}

      {ticketsQuery.isError && (
        <div role="alert" className={ERROR_PANEL_CLASSES}>
          <p>
            {ticketsQuery.error instanceof ApiError ? ticketsQuery.error.message : 'Nie udało się wczytać zgłoszeń.'}
          </p>
          <button type="button" onClick={() => ticketsQuery.refetch()} className={RETRY_BUTTON_CLASSES}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {data && (
        <div className={`overflow-hidden ${CARD_CLASSES}`}>
          {data.items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-500 dark:text-slate-400">Brak zgłoszeń spełniających wybrane kryteria.</p>
          ) : (
            <>
              <div className="hidden lg:block">
                <TicketTable tickets={data.items} isStaff={isStaff} />
              </div>
              <div className="lg:hidden">
                <TicketCards tickets={data.items} isStaff={isStaff} />
              </div>
            </>
          )}

          {data.pagination.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
              <span>
                Strona {data.pagination.page} z {data.pagination.totalPages} ({data.pagination.total} zgłoszeń)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, filters.page - 1))}
                  disabled={data.pagination.page <= 1}
                  className={PAGINATION_BUTTON_CLASSES}
                >
                  Poprzednia
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(data.pagination.totalPages, filters.page + 1))}
                  disabled={data.pagination.page >= data.pagination.totalPages}
                  className={PAGINATION_BUTTON_CLASSES}
                >
                  Następna
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
