import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CircleCheck, Clock, TriangleAlert } from 'lucide-react';

import { ApiError } from '../api/client';
import { addTicketComment, assignTicket, closeTicket, fetchTicket, patchTicket, resolveTicket } from '../api/tickets';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PriorityBadge, SlaBadge, StatusBadge, TypeBadge } from '../components/ticket/TicketBadges';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { resolutionNoteSchema, ticketCommentSchema, type TicketCommentFormValues } from '../schemas/ticket.schema';
import type { TicketPriority, TicketSla, TicketStatus } from '../types/ticket';
import { displayName } from '../utils/person';
import { formatWorkingDuration } from '../utils/sla';
import { ALLOWED_PRIORITIES, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, formatDate, formatDateTime } from '../utils/ticketLabels';
import { CARD_CLASSES, ERROR_PANEL_CLASSES, LOADING_PANEL_CLASSES, SECTION_HEADER_CLASSES } from '../utils/surfaceStyles';
import { FORM_ALERT_CLASSES, FORM_FIELD_ERROR_CLASSES, FORM_INPUT_CLASSES, FORM_LABEL_CLASSES } from '../utils/formStyles';

// Mirrors backend/src/services/ticket.service.ts's `transitions` map, minus
// RESOLVED/CLOSED as destinations - those go through the dedicated
// resolve/close endpoints (buttons below) instead of a generic status PATCH,
// per the E5-FRONTEND-UX-TEST-PLAN recommendation.
const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ['IN_PROGRESS'],
  IN_PROGRESS: ['WAITING_FOR_USER'],
  WAITING_FOR_USER: ['IN_PROGRESS'],
  RESOLVED: ['IN_PROGRESS'],
  CLOSED: [],
};

const SECONDARY_ACTION_BUTTON_CLASSES =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

// Statuses in which the SLA clock runs; the backend locks the priority (and
// with it the SLA outcome) once a ticket is resolved or closed.
const SLA_RUNNING_STATUSES: TicketStatus[] = ['NEW', 'IN_PROGRESS', 'WAITING_FOR_USER'];

function personName(person: { firstName: string; lastName: string } | null): string {
  return person ? displayName(person) : 'Nieprzypisane';
}

// Prominent notice for a running SLA that is breached or close to breach;
// the same state is also shown as a badge in the ticket metadata.
function SlaNotice({ sla }: { sla: TicketSla }) {
  if (!sla.running || sla.remainingMinutes === null) return null;
  if (sla.state === 'BREACHED') {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <p>
          <strong className="font-semibold">Przekroczono termin SLA.</strong> Termin minął {formatDateTime(sla.dueAt)}
          {sla.remainingMinutes < 0 ? `; opóźnienie: ${formatWorkingDuration(sla.remainingMinutes)} czasu roboczego.` : '.'}
        </p>
      </div>
    );
  }
  if (sla.state === 'WARNING') {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <Clock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>
          <strong className="font-semibold">Termin SLA zbliża się.</strong> Pozostało {formatWorkingDuration(sla.remainingMinutes)} czasu
          roboczego (do {formatDateTime(sla.dueAt)}).
        </p>
      </div>
    );
  }
  return null;
}

function actionErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Nie udało się wykonać akcji. Spróbuj ponownie.';
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'resolve' | 'close' | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionNoteError, setResolutionNoteError] = useState<string | null>(null);
  // Resolve/close remove the button that opened the dialog, so focus moves to
  // the ticket heading instead of falling back to <body>.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [focusHeading, setFocusHeading] = useState(false);
  useEffect(() => {
    if (focusHeading && pendingAction === null) {
      headingRef.current?.focus();
      setFocusHeading(false);
    }
  }, [focusHeading, pendingAction]);

  const ticketQuery = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetchTicket(id!),
    enabled: Boolean(id),
  });
  useDocumentTitle(ticketQuery.data ? `Zgłoszenie ${ticketQuery.data.ticketNumber}` : 'Zgłoszenie');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const onActionSuccess = (message: string) => {
    setActionError(null);
    showToast(message);
    invalidate();
  };
  const onActionError = (error: unknown) => setActionError(actionErrorMessage(error));

  const assignMutation = useMutation({
    mutationFn: () => assignTicket(id!, user!.id),
    onSuccess: () => onActionSuccess('Zgłoszenie zostało przejęte.'),
    onError: onActionError,
  });
  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) => patchTicket(id!, { status }),
    onSuccess: () => onActionSuccess('Status zgłoszenia został zmieniony.'),
    onError: onActionError,
  });
  const priorityMutation = useMutation({
    mutationFn: (priority: TicketPriority) => patchTicket(id!, { priority }),
    onSuccess: () => onActionSuccess('Priorytet zgłoszenia został zmieniony.'),
    onError: onActionError,
  });
  const resolveMutation = useMutation({
    mutationFn: (note: string) => resolveTicket(id!, note),
    onSuccess: () => {
      setPendingAction(null);
      setResolutionNote('');
      setFocusHeading(true);
      onActionSuccess('Zgłoszenie zostało oznaczone jako rozwiązane.');
    },
    // The typed note is kept, so reopening the dialog does not lose it.
    onError: (error) => {
      setPendingAction(null);
      onActionError(error);
    },
  });
  const closeMutation = useMutation({
    mutationFn: () => closeTicket(id!),
    onSuccess: () => {
      setFocusHeading(true);
      onActionSuccess('Zgłoszenie zostało zamknięte.');
    },
    onError: onActionError,
  });
  const commentForm = useForm<TicketCommentFormValues>({
    resolver: zodResolver(ticketCommentSchema),
    defaultValues: { content: '' },
  });
  const commentMutation = useMutation({
    mutationFn: (values: TicketCommentFormValues) => addTicketComment(id!, values),
    onSuccess: () => { onActionSuccess('Komentarz został dodany.'); commentForm.reset(); },
    onError: onActionError,
  });
  const onSubmitComment = commentForm.handleSubmit((values) => commentMutation.mutate(values));

  const openResolveDialog = () => {
    setResolutionNoteError(null);
    setPendingAction('resolve');
  };

  const confirmPendingAction = () => {
    if (pendingAction === 'resolve') {
      const parsed = resolutionNoteSchema.safeParse(resolutionNote);
      if (!parsed.success) {
        setResolutionNoteError(parsed.error.issues[0]?.message ?? 'Opis rozwiązania jest wymagany.');
        return;
      }
      // The dialog stays open until the request settles (see resolveMutation).
      resolveMutation.mutate(parsed.data);
      return;
    }
    if (pendingAction === 'close') closeMutation.mutate();
    setPendingAction(null);
  };

  if (ticketQuery.isPending) {
    return (
      <div role="status" aria-live="polite" className={LOADING_PANEL_CLASSES}>
        Wczytywanie zgłoszenia…
      </div>
    );
  }

  if (ticketQuery.isError) {
    const message = ticketQuery.error instanceof ApiError ? ticketQuery.error.message : 'Nie udało się wczytać zgłoszenia.';
    return (
      <div role="alert" className={ERROR_PANEL_CLASSES}>
        <p>{message}</p>
        <Link
          to="/tickets"
          className="mt-4 inline-block rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900"
        >
          Wróć do listy zgłoszeń
        </Link>
      </div>
    );
  }

  const ticket = ticketQuery.data;
  const isStaff = user?.role === 'TECHNICIAN' || user?.role === 'ADMIN';
  const canAssignSelf = isStaff && ticket.assigneeId !== user?.id;
  const canResolve = isStaff && (ticket.status === 'IN_PROGRESS' || ticket.status === 'WAITING_FOR_USER');
  const canClose = ticket.status === 'RESOLVED';
  const nextStatuses = isStaff ? STATUS_TRANSITIONS[ticket.status] : [];
  const canChangePriority = isStaff && SLA_RUNNING_STATUSES.includes(ticket.status);
  const showResolution = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' || ticket.resolutionNote !== null;
  const anyActionPending =
    assignMutation.isPending ||
    statusMutation.isPending ||
    priorityMutation.isPending ||
    resolveMutation.isPending ||
    closeMutation.isPending;

  return (
    <div className="space-y-6">
      <Link to="/tickets" className="rounded text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
        ← Wróć do listy zgłoszeń
      </Link>

      <div className={`${CARD_CLASSES} p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-500 dark:text-slate-400">{ticket.ticketNumber}</p>
            <h1 ref={headingRef} tabIndex={-1} className="mt-1 break-words text-2xl focus:outline-none font-semibold tracking-tight text-slate-900 dark:text-slate-100">{ticket.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={ticket.type} />
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
        </div>

        {ticket.sla && <SlaNotice sla={ticket.sla} />}

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4 dark:border-slate-800">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Termin SLA</dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
              {ticket.sla ? formatDateTime(ticket.sla.dueAt) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Stan SLA</dt>
            <dd className="mt-0.5">
              <SlaBadge sla={ticket.sla} />
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Kategoria</dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{CATEGORY_LABELS[ticket.category]}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Zgłaszający</dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{personName(ticket.reporter)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Serwisant</dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{personName(ticket.assignee)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Utworzono</dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{formatDate(ticket.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Zaktualizowano</dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{formatDate(ticket.updatedAt)}</dd>
          </div>
          {ticket.resolvedAt && (
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Rozwiązano</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{formatDate(ticket.resolvedAt)}</dd>
            </div>
          )}
          {ticket.closedAt && (
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Zamknięto</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{formatDate(ticket.closedAt)}</dd>
            </div>
          )}
        </dl>

        <p className="mt-6 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:text-slate-300">
          {ticket.description}
        </p>

        {(isStaff || canClose) && (
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            {canAssignSelf && (
              <button
                type="button"
                disabled={anyActionPending}
                onClick={() => assignMutation.mutate()}
                className={SECONDARY_ACTION_BUTTON_CLASSES}
              >
                Przejmij zgłoszenie
              </button>
            )}
            {nextStatuses.map((next) => (
              <button
                key={next}
                type="button"
                disabled={anyActionPending}
                onClick={() => statusMutation.mutate(next)}
                className={SECONDARY_ACTION_BUTTON_CLASSES}
              >
                Przenieś do: {STATUS_LABELS[next]}
              </button>
            ))}
            {canResolve && (
              <button
                type="button"
                disabled={anyActionPending}
                onClick={openResolveDialog}
                className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:bg-green-600 dark:hover:bg-green-500"
              >
                Rozwiąż zgłoszenie
              </button>
            )}
            {canClose && (
              <button
                type="button"
                disabled={anyActionPending}
                onClick={() => setPendingAction('close')}
                className={SECONDARY_ACTION_BUTTON_CLASSES}
              >
                Zamknij zgłoszenie
              </button>
            )}
            {canChangePriority && (
              <label className="ml-auto flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                Priorytet
                <select
                  value={ticket.priority}
                  disabled={anyActionPending}
                  onChange={(event) => priorityMutation.mutate(event.target.value as TicketPriority)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {ALLOWED_PRIORITIES[ticket.type].map((value) => (
                    <option key={value} value={value}>
                      {PRIORITY_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {actionError && (
          <p role="alert" className={`mt-4 ${FORM_ALERT_CLASSES}`}>
            {actionError}
          </p>
        )}
      </div>

      {showResolution && (
        <section aria-labelledby="resolution-heading" className={`${CARD_CLASSES} border-l-4 border-l-green-600 dark:border-l-green-500`}>
          <h2 id="resolution-heading" className={`${SECTION_HEADER_CLASSES} flex items-center gap-2`}>
            <CircleCheck aria-hidden="true" className="h-4 w-4 text-green-600 dark:text-green-400" />
            Opis rozwiązania
          </h2>
          {ticket.resolutionNote ? (
            <div className="px-4 py-3">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{ticket.resolutionNote}</p>
              {ticket.resolvedAt && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Rozwiązano {formatDateTime(ticket.resolvedAt)}</p>
              )}
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
              Brak opisu rozwiązania — zgłoszenie rozwiązano przed wprowadzeniem tego pola.
            </p>
          )}
        </section>
      )}

      <section className={CARD_CLASSES}>
        <h2 className={SECTION_HEADER_CLASSES}>Komentarze</h2>
        {ticket.comments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Brak komentarzy.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {ticket.comments.map((comment) => (
              <li key={comment.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {displayName(comment.author)}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">{formatDateTime(comment.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{comment.content}</p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={onSubmitComment} noValidate className="border-t border-slate-100 p-4 dark:border-slate-800">
          <label htmlFor="comment-content" className={FORM_LABEL_CLASSES}>
            Dodaj komentarz
          </label>
          <textarea
            id="comment-content"
            rows={3}
            aria-required="true"
            aria-invalid={commentForm.formState.errors.content ? 'true' : 'false'}
            aria-describedby={commentForm.formState.errors.content ? 'comment-content-error' : undefined}
            className={FORM_INPUT_CLASSES}
            {...commentForm.register('content')}
          />
          {commentForm.formState.errors.content && (
            <p id="comment-content-error" role="alert" className={FORM_FIELD_ERROR_CLASSES}>
              {commentForm.formState.errors.content.message}
            </p>
          )}
          <button
            type="submit"
            disabled={commentMutation.isPending}
            className="mt-3 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {commentMutation.isPending ? 'Wysyłanie…' : 'Dodaj komentarz'}
          </button>
        </form>
      </section>

      <section className={CARD_CLASSES}>
        <h2 className={SECTION_HEADER_CLASSES}>Historia zgłoszenia</h2>
        {ticket.history.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Brak wpisów historii.</p>
        ) : (
          <ol className="divide-y divide-slate-100 dark:divide-slate-800">
            {ticket.history.map((entry) => (
              <li key={entry.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-700 dark:text-slate-300">{entry.description}</p>
                  <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">{formatDateTime(entry.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {displayName(entry.actor)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction === 'close' ? 'Zamknięcie zgłoszenia' : 'Rozwiązanie zgłoszenia'}
        message={
          pendingAction === 'close'
            ? `Czy na pewno chcesz zamknąć zgłoszenie ${ticket.ticketNumber}?`
            : `Czy na pewno chcesz oznaczyć zgłoszenie ${ticket.ticketNumber} jako rozwiązane?`
        }
        confirmLabel={pendingAction === 'close' ? 'Zamknij zgłoszenie' : resolveMutation.isPending ? 'Zapisywanie…' : 'Rozwiąż zgłoszenie'}
        confirmDisabled={resolveMutation.isPending}
        onConfirm={confirmPendingAction}
        onCancel={() => {
          if (!resolveMutation.isPending) setPendingAction(null);
        }}
      >
        {pendingAction === 'resolve' && (
          <div className="mt-4">
            <label htmlFor="resolution-note" className={FORM_LABEL_CLASSES}>
              Opis rozwiązania
            </label>
            <textarea
              id="resolution-note"
              rows={5}
              value={resolutionNote}
              onChange={(event) => {
                setResolutionNote(event.target.value);
                if (resolutionNoteError) setResolutionNoteError(null);
              }}
              aria-required="true"
              aria-invalid={resolutionNoteError ? 'true' : 'false'}
              aria-describedby={resolutionNoteError ? 'resolution-note-error' : 'resolution-note-hint'}
              className={FORM_INPUT_CLASSES}
            />
            {resolutionNoteError ? (
              <p id="resolution-note-error" role="alert" className={FORM_FIELD_ERROR_CLASSES}>
                {resolutionNoteError}
              </p>
            ) : (
              <p id="resolution-note-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Opis zobaczy zgłaszający. Napisz, co zostało zrobione.
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
