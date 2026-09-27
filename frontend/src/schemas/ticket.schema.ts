import { z } from 'zod';

import { ALLOWED_PRIORITIES, CATEGORY_LABELS, PRIORITY_LABELS, TYPE_LABELS } from '../utils/ticketLabels';
import type { TicketCategory, TicketPriority, TicketType } from '../types/ticket';

const categoryValues = Object.keys(CATEGORY_LABELS) as [TicketCategory, ...TicketCategory[]];
const priorityValues = Object.keys(PRIORITY_LABELS) as [TicketPriority, ...TicketPriority[]];
const typeValues = Object.keys(TYPE_LABELS) as [TicketType, ...TicketType[]];

export const isTicketType = (value: unknown): value is TicketType => typeValues.includes(value as TicketType);

// Mirrors backend/src/validators/api.ts's `ticketCreateSchema` bounds
// exactly (title 3-200 chars, description 10-10000 chars, no CRITICAL
// service) so a form error is caught client-side before the request is sent.
export const ticketCreateSchema = z
  .object({
    type: z.enum(typeValues, { errorMap: () => ({ message: 'Wybierz rodzaj zgłoszenia.' }) }),
    title: z
      .string()
      .trim()
      .min(3, 'Tytuł musi mieć co najmniej 3 znaki.')
      .max(200, 'Tytuł może mieć maksymalnie 200 znaków.'),
    description: z
      .string()
      .trim()
      .min(10, 'Opis musi mieć co najmniej 10 znaków.')
      .max(10000, 'Opis może mieć maksymalnie 10000 znaków.'),
    category: z.enum(categoryValues, { errorMap: () => ({ message: 'Wybierz kategorię.' }) }),
    priority: z.enum(priorityValues, { errorMap: () => ({ message: 'Wybierz priorytet.' }) }),
  })
  .refine((values) => ALLOWED_PRIORITIES[values.type].includes(values.priority), {
    message: 'Priorytet krytyczny jest dostępny wyłącznie dla incydentów.',
    path: ['priority'],
  });

export type TicketCreateFormValues = z.infer<typeof ticketCreateSchema>;

// Mirrors backend/src/validators/api.ts's `resolutionNoteSchema`.
export const resolutionNoteSchema = z
  .string()
  .trim()
  .min(1, 'Opisz, jak rozwiązano zgłoszenie.')
  .max(10000, 'Opis rozwiązania może mieć maksymalnie 10000 znaków.');

// Mirrors backend/src/validators/api.ts's `commentSchema` (1-5000 chars).
export const ticketCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Podaj treść komentarza.')
    .max(5000, 'Komentarz może mieć maksymalnie 5000 znaków.'),
});

export type TicketCommentFormValues = z.infer<typeof ticketCommentSchema>;
