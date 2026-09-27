import { TicketCategory, TicketPriority, TicketStatus, TicketType, UserRole } from '@prisma/client';
import { z } from 'zod';
import { SLA_FILTERS, isPriorityAllowed } from '../services/sla.service.js';

const priorityNotAllowed = {
  message: 'Priorytet krytyczny jest dostępny wyłącznie dla incydentów.',
  path: ['priority'],
};
const queryBoolean = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();
export const resolutionNoteSchema = z.string().trim().min(1).max(10000);

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
});
const ticketFields = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(10000),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority),
});
export const ticketCreateSchema = ticketFields
  .extend({ type: z.nativeEnum(TicketType) })
  .refine((data) => isPriorityAllowed(data.type, data.priority), priorityNotAllowed);
// The type is fixed at creation. A resolution note can only be supplied
// together with the RESOLVED status (and is then mandatory), so it can never
// be written by anyone who is not allowed to resolve the ticket.
export const ticketPatchSchema = ticketFields
  .partial()
  .extend({
    status: z.nativeEnum(TicketStatus).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    resolutionNote: resolutionNoteSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0)
  .refine(
    (data) => (data.status === TicketStatus.RESOLVED) === (data.resolutionNote !== undefined),
    {
      message:
        'Opis rozwiązania jest wymagany przy rozwiązaniu zgłoszenia i tylko wtedy dozwolony.',
      path: ['resolutionNote'],
    },
  );
export const resolveSchema = z.object({ resolutionNote: resolutionNoteSchema });
export const ticketListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  type: z.nativeEnum(TicketType).optional(),
  assigneeId: z.string().uuid().optional(),
  unassigned: queryBoolean,
  // CLOSED tickets are hidden unless explicitly requested by status or flag.
  includeClosed: queryBoolean,
  sla: z.enum(SLA_FILTERS).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status', 'slaDueAt']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export const commentSchema = z.object({ content: z.string().trim().min(1).max(5000) });
export const assignSchema = z.object({ assigneeId: z.string().uuid().nullable() });
export const userCreateSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
});
export const userPatchSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.string().email().max(320).optional(),
  })
  .refine((data) => Object.keys(data).length > 0);
export const roleSchema = z.object({ role: z.nativeEnum(UserRole) });
export const accountStatusSchema = z.object({ isActive: z.boolean() });
