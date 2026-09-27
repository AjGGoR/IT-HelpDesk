import { Prisma, TicketHistoryAction, TicketStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import type { z } from 'zod';
import type {
  assignSchema,
  commentSchema,
  resolveSchema,
  ticketCreateSchema,
  ticketListSchema,
  ticketPatchSchema,
} from '../validators/api.js';
import {
  SLA_RUNNING_STATUSES,
  assertPriorityAllowed,
  calculateSlaDueAt,
  slaWhere,
  withSla,
} from './sla.service.js';

type Actor = { userId: string; role: UserRole };
const staff = (role: UserRole) => role === UserRole.TECHNICIAN || role === UserRole.ADMIN;
const ticketInclude = {
  reporter: {
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  },
  assignee: {
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  },
} as const;
const transitions: Record<TicketStatus, TicketStatus[]> = {
  NEW: [TicketStatus.IN_PROGRESS],
  IN_PROGRESS: [TicketStatus.WAITING_FOR_USER, TicketStatus.RESOLVED],
  WAITING_FOR_USER: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
  RESOLVED: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
  CLOSED: [],
};
export const assertTransition = (from: TicketStatus, to: TicketStatus) => {
  if (!transitions[from].includes(to))
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `Przejście ze statusu ${from} do ${to} jest niedozwolone.`,
    );
};
async function visible(id: string, actor: Actor) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: ticketInclude });
  if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Nie znaleziono zgłoszenia.');
  if (actor.role === UserRole.USER && ticket.reporterId !== actor.userId)
    throw new AppError(403, 'FORBIDDEN', 'Brak dostępu do tego zgłoszenia.');
  return ticket;
}
async function validAssignee(id: string | null) {
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'ASSIGNEE_NOT_FOUND', 'Nie znaleziono serwisanta.');
  if (!user.isActive || user.role !== UserRole.TECHNICIAN)
    throw new AppError(422, 'INVALID_ASSIGNEE', 'Można przypisać wyłącznie aktywnego serwisanta.');
  return user;
}
export async function listTickets(actor: Actor, query: z.infer<typeof ticketListSchema>) {
  const now = new Date();
  const where: Prisma.TicketWhereInput = {
    ...(actor.role === UserRole.USER ? { reporterId: actor.userId } : {}),
    ...(query.status
      ? { status: query.status }
      : query.includeClosed
        ? {}
        : { status: { not: TicketStatus.CLOSED } }),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    ...(query.unassigned ? { assigneeId: null } : {}),
    // Filters that carry their own OR clauses are ANDed so they cannot
    // overwrite each other.
    AND: [
      ...(query.sla ? [slaWhere(query.sla, now)] : []),
      ...(query.search
        ? [
            {
              OR: [
                { ticketNumber: { contains: query.search, mode: 'insensitive' as const } },
                { title: { contains: query.search, mode: 'insensitive' as const } },
                { description: { contains: query.search, mode: 'insensitive' as const } },
              ],
            },
          ]
        : []),
    ],
  };
  const orderBy: Prisma.TicketOrderByWithRelationInput =
    query.sortBy === 'slaDueAt'
      ? { slaDueAt: { sort: query.sortOrder, nulls: 'last' } }
      : { [query.sortBy]: query.sortOrder };
  const [items, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);
  return {
    items: items.map((ticket) => withSla(ticket, now)),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}
export async function getTicket(id: string, actor: Actor) {
  const ticket = await visible(id, actor);
  const [comments, history] = await Promise.all([
    prisma.comment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    }),
    prisma.ticketHistory.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, firstName: true, lastName: true, role: true } } },
    }),
  ]);
  return { ...withSla(ticket), comments, history };
}
export async function createTicket(actor: Actor, input: z.infer<typeof ticketCreateSchema>) {
  assertPriorityAllowed(input.type, input.priority);
  const createdAt = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.create({
      data: {
        ...input,
        reporterId: actor.userId,
        createdAt,
        slaDueAt: calculateSlaDueAt(createdAt, input.type, input.priority),
      },
      include: ticketInclude,
    });
    await tx.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: actor.userId,
        action: TicketHistoryAction.TICKET_CREATED,
        description: `Utworzono zgłoszenie ${ticket.ticketNumber}.`,
      },
    });
    return ticket;
  });
  return withSla(created);
}
export async function patchTicket(
  id: string,
  actor: Actor,
  input: z.infer<typeof ticketPatchSchema>,
) {
  const ticket = await visible(id, actor);
  // Priority drives the SLA deadline, so after creation it is a staff
  // (triage) decision only.
  if (
    !staff(actor.role) &&
    (input.status || input.assigneeId !== undefined || input.priority !== undefined)
  )
    throw new AppError(
      403,
      'FORBIDDEN',
      'Użytkownik nie może zmieniać statusu, priorytetu ani przypisania.',
    );
  if (
    !staff(actor.role) &&
    ticket.status !== TicketStatus.NEW &&
    ticket.status !== TicketStatus.WAITING_FOR_USER
  )
    throw new AppError(
      409,
      'TICKET_NOT_EDITABLE',
      'To zgłoszenie nie może być już edytowane przez użytkownika.',
    );
  if (input.status) assertTransition(ticket.status, input.status);
  if (input.status === TicketStatus.RESOLVED && !input.resolutionNote)
    throw new AppError(422, 'RESOLUTION_NOTE_REQUIRED', 'Opis rozwiązania jest wymagany.');
  if (input.priority) assertPriorityAllowed(ticket.type, input.priority);
  // Once the SLA clock has stopped its outcome is final and must not be
  // rewritten by re-prioritising a resolved/closed ticket.
  if (input.priority !== undefined && !SLA_RUNNING_STATUSES.includes(ticket.status))
    throw new AppError(
      409,
      'PRIORITY_LOCKED',
      'Priorytetu nie można zmienić w rozwiązanym lub zamkniętym zgłoszeniu.',
    );
  const newPriority =
    input.priority !== undefined && input.priority !== ticket.priority ? input.priority : null;
  const reopened =
    ticket.status === TicketStatus.RESOLVED && input.status === TicketStatus.IN_PROGRESS;
  const assignee =
    input.assigneeId !== undefined ? await validAssignee(input.assigneeId) : undefined;
  const updatedTicket = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: input.status,
        assigneeId: assignee === undefined ? undefined : (assignee?.id ?? null),
        // The SLA target follows the current priority, measured from creation.
        slaDueAt: newPriority
          ? calculateSlaDueAt(ticket.createdAt, ticket.type, newPriority)
          : undefined,
        resolutionNote:
          input.status === TicketStatus.RESOLVED
            ? input.resolutionNote
            : reopened
              ? null
              : undefined,
        resolvedAt:
          input.status === TicketStatus.RESOLVED
            ? new Date()
            : input.status === TicketStatus.IN_PROGRESS
              ? null
              : undefined,
        closedAt:
          input.status === TicketStatus.CLOSED
            ? new Date()
            : input.status === TicketStatus.IN_PROGRESS
              ? null
              : undefined,
      },
      include: ticketInclude,
    });
    const entries = [];
    if (input.status && input.status !== ticket.status) {
      const action =
        input.status === TicketStatus.RESOLVED
          ? TicketHistoryAction.TICKET_RESOLVED
          : input.status === TicketStatus.CLOSED
            ? TicketHistoryAction.TICKET_CLOSED
            : TicketHistoryAction.STATUS_CHANGED;
      // A reopened ticket's note is cleared until it is resolved again, so the
      // previous note is kept in the audit trail.
      const description =
        action === TicketHistoryAction.TICKET_RESOLVED
          ? 'Oznaczono zgłoszenie jako rozwiązane.'
          : action === TicketHistoryAction.TICKET_CLOSED
            ? 'Zamknięto zgłoszenie.'
            : reopened && ticket.resolutionNote
              ? `Wznowiono zgłoszenie. Poprzedni opis rozwiązania: ${ticket.resolutionNote}`
              : `Zmieniono status na ${input.status}.`;
      entries.push({
        ticketId: id,
        actorId: actor.userId,
        action,
        description,
        oldValue: ticket.status,
        newValue: input.status,
      });
    }
    if (input.priority && input.priority !== ticket.priority)
      entries.push({
        ticketId: id,
        actorId: actor.userId,
        action: TicketHistoryAction.PRIORITY_CHANGED,
        description: 'Zmieniono priorytet.',
        oldValue: ticket.priority,
        newValue: input.priority,
      });
    if (input.category && input.category !== ticket.category)
      entries.push({
        ticketId: id,
        actorId: actor.userId,
        action: TicketHistoryAction.CATEGORY_CHANGED,
        description: 'Zmieniono kategorię.',
        oldValue: ticket.category,
        newValue: input.category,
      });
    if (assignee !== undefined && ticket.assigneeId !== (assignee?.id ?? null))
      entries.push({
        ticketId: id,
        actorId: actor.userId,
        action: TicketHistoryAction.ASSIGNEE_CHANGED,
        description: 'Zmieniono przypisanie serwisanta.',
        oldValue: ticket.assigneeId,
        newValue: assignee?.id ?? null,
      });
    if (entries.length) await tx.ticketHistory.createMany({ data: entries });
    return updated;
  });
  return withSla(updatedTicket);
}
export async function assignTicket(id: string, actor: Actor, input: z.infer<typeof assignSchema>) {
  if (!staff(actor.role))
    throw new AppError(403, 'FORBIDDEN', 'Tylko serwisant może przypisywać zgłoszenia.');
  return patchTicket(id, actor, { assigneeId: input.assigneeId });
}
export async function addComment(id: string, actor: Actor, input: z.infer<typeof commentSchema>) {
  await visible(id, actor);
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { ticketId: id, authorId: actor.userId, content: input.content },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
    await tx.ticketHistory.create({
      data: {
        ticketId: id,
        actorId: actor.userId,
        action: TicketHistoryAction.COMMENT_ADDED,
        description: 'Dodano komentarz.',
      },
    });
    return comment;
  });
}
export async function resolveTicket(
  id: string,
  actor: Actor,
  input: z.infer<typeof resolveSchema>,
) {
  if (!staff(actor.role))
    throw new AppError(403, 'FORBIDDEN', 'Tylko serwisant może rozwiązać zgłoszenie.');
  const ticket = await visible(id, actor);
  assertTransition(ticket.status, TicketStatus.RESOLVED);
  const resolved = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNote: input.resolutionNote,
      },
    });
    await tx.ticketHistory.create({
      data: {
        ticketId: id,
        actorId: actor.userId,
        action: TicketHistoryAction.TICKET_RESOLVED,
        description: 'Oznaczono zgłoszenie jako rozwiązane.',
        oldValue: ticket.status,
        newValue: TicketStatus.RESOLVED,
      },
    });
    return updated;
  });
  return withSla(resolved);
}
export async function closeTicket(id: string, actor: Actor) {
  const ticket = await visible(id, actor);
  assertTransition(ticket.status, TicketStatus.CLOSED);
  const closed = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id },
      data: { status: TicketStatus.CLOSED, closedAt: new Date() },
    });
    await tx.ticketHistory.create({
      data: {
        ticketId: id,
        actorId: actor.userId,
        action: TicketHistoryAction.TICKET_CLOSED,
        description: 'Zamknięto zgłoszenie.',
        oldValue: ticket.status,
        newValue: TicketStatus.CLOSED,
      },
    });
    return updated;
  });
  return withSla(closed);
}
