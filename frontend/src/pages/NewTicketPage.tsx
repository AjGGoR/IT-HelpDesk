import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';

import { createTicket } from '../api/tickets';
import { ApiError } from '../api/client';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { isTicketType, ticketCreateSchema, type TicketCreateFormValues } from '../schemas/ticket.schema';
import type { Ticket, TicketType } from '../types/ticket';
import { ALLOWED_PRIORITIES, CATEGORY_LABELS, PRIORITY_LABELS, TYPE_DESCRIPTIONS, TYPE_LABELS } from '../utils/ticketLabels';
import { CARD_CLASSES, SUCCESS_PANEL_CLASSES, SUCCESS_PRIMARY_BUTTON_CLASSES, SUCCESS_SECONDARY_BUTTON_CLASSES } from '../utils/surfaceStyles';
import { FORM_ALERT_CLASSES, FORM_FIELD_ERROR_CLASSES, FORM_INPUT_CLASSES, FORM_LABEL_CLASSES, PRIMARY_BUTTON_CLASSES, SECONDARY_LINK_CLASSES } from '../utils/formStyles';

const PAGE_TITLES: Record<TicketType, string> = { SERVICE: 'Nowa usługa', INCIDENT: 'Nowy incydent' };
const TYPE_ORDER: TicketType[] = ['SERVICE', 'INCIDENT'];

export function NewTicketPage() {
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');
  const typeFromUrl = isTicketType(typeParam) ? typeParam : undefined;
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<Ticket | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TicketCreateFormValues>({
    resolver: zodResolver(ticketCreateSchema),
    defaultValues: { type: typeFromUrl, title: '', description: '', category: 'OTHER', priority: 'MEDIUM' },
  });
  const selectedType = useWatch({ control, name: 'type' });
  useDocumentTitle(selectedType ? PAGE_TITLES[selectedType] : 'Nowe zgłoszenie');

  // Choosing "Nowa usługa"/"Nowy incydent" again from the dashboard while
  // this page is open only changes the query string, not the route.
  useEffect(() => {
    if (typeFromUrl) setValue('type', typeFromUrl);
  }, [typeFromUrl, setValue]);

  // Services cannot be CRITICAL: never leave a now-invalid priority selected.
  useEffect(() => {
    if (selectedType && !ALLOWED_PRIORITIES[selectedType].includes(getValues('priority'))) setValue('priority', 'HIGH');
  }, [selectedType, getValues, setValue]);

  if (created) {
    return (
      <section className={SUCCESS_PANEL_CLASSES}>
        <h1 className="text-xl font-semibold text-green-900 dark:text-green-100">Zgłoszenie zostało utworzone</h1>
        <p className="mt-2 text-sm text-green-800 dark:text-green-300">
          {TYPE_LABELS[created.type]} · numer zgłoszenia: <span className="font-semibold">{created.ticketNumber}</span>
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={`/tickets/${created.id}`} className={SUCCESS_PRIMARY_BUTTON_CLASSES}>
            Przejdź do zgłoszenia
          </Link>
          <Link to="/tickets" className={SUCCESS_SECONDARY_BUTTON_CLASSES}>
            Wróć do listy zgłoszeń
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              reset({ type: created.type, title: '', description: '', category: 'OTHER', priority: 'MEDIUM' });
            }}
            className={SUCCESS_SECONDARY_BUTTON_CLASSES}
          >
            Utwórz kolejne zgłoszenie
          </button>
        </div>
      </section>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const ticket = await createTicket(values);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      setCreated(ticket);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.');
    }
  });

  const allowedPriorities = ALLOWED_PRIORITIES[selectedType ?? 'INCIDENT'];

  return (
    <section className={`max-w-2xl p-6 sm:p-8 ${CARD_CLASSES}`}>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {selectedType ? PAGE_TITLES[selectedType] : 'Nowe zgłoszenie'}
      </h1>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <fieldset aria-describedby={errors.type ? 'type-error' : undefined}>
          <legend className={FORM_LABEL_CLASSES}>Rodzaj zgłoszenia</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {TYPE_ORDER.map((type) => (
              <label
                key={type}
                className="flex cursor-pointer gap-3 rounded-lg border border-slate-300 p-3 text-sm transition hover:bg-slate-50 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 dark:border-slate-700 dark:hover:bg-slate-800 dark:has-[:checked]:border-blue-500 dark:has-[:checked]:bg-blue-950"
              >
                <input type="radio" value={type} className="mt-0.5 h-4 w-4 accent-blue-700 focus-visible:outline-none" {...register('type')} />
                <span>
                  <span className="block font-medium text-slate-900 dark:text-slate-100">{TYPE_LABELS[type]}</span>
                  <span className="mt-0.5 block text-slate-600 dark:text-slate-400">{TYPE_DESCRIPTIONS[type]}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.type && (
            <p id="type-error" role="alert" className={FORM_FIELD_ERROR_CLASSES}>
              {errors.type.message}
            </p>
          )}
        </fieldset>

        <div>
          <label htmlFor="title" className={FORM_LABEL_CLASSES}>
            Tytuł
          </label>
          <input
            id="title"
            type="text"
            aria-required="true"
            aria-invalid={errors.title ? 'true' : 'false'}
            aria-describedby={errors.title ? 'title-error' : undefined}
            className={FORM_INPUT_CLASSES}
            {...register('title')}
          />
          {errors.title && (
            <p id="title-error" role="alert" className={FORM_FIELD_ERROR_CLASSES}>
              {errors.title.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="description" className={FORM_LABEL_CLASSES}>
            Opis
          </label>
          <textarea
            id="description"
            rows={5}
            aria-required="true"
            aria-invalid={errors.description ? 'true' : 'false'}
            aria-describedby={errors.description ? 'description-error' : undefined}
            className={FORM_INPUT_CLASSES}
            {...register('description')}
          />
          {errors.description && (
            <p id="description-error" role="alert" className={FORM_FIELD_ERROR_CLASSES}>
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="min-w-0 flex-1">
            <label htmlFor="category" className={FORM_LABEL_CLASSES}>
              Kategoria
            </label>
            <select id="category" className={FORM_INPUT_CLASSES} {...register('category')}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 flex-1">
            <label htmlFor="priority" className={FORM_LABEL_CLASSES}>
              Priorytet
            </label>
            <select
              id="priority"
              aria-invalid={errors.priority ? 'true' : 'false'}
              aria-describedby={[errors.priority ? 'priority-error' : null, selectedType === 'SERVICE' ? 'priority-hint' : null].filter(Boolean).join(' ') || undefined}
              className={FORM_INPUT_CLASSES}
              {...register('priority')}
            >
              {allowedPriorities.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
            {selectedType === 'SERVICE' && (
              <p id="priority-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Priorytet krytyczny jest dostępny tylko dla incydentów.
              </p>
            )}
            {errors.priority && (
              <p id="priority-error" role="alert" className={FORM_FIELD_ERROR_CLASSES}>
                {errors.priority.message}
              </p>
            )}
          </div>
        </div>

        {formError && (
          <p role="alert" className={FORM_ALERT_CLASSES}>
            {formError}
          </p>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON_CLASSES}>
            {isSubmitting ? 'Zapisywanie…' : 'Utwórz zgłoszenie'}
          </button>
          <Link to="/tickets" className={SECONDARY_LINK_CLASSES}>
            Anuluj
          </Link>
        </div>
      </form>
    </section>
  );
}
