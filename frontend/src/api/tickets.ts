import { apiRequest } from './client';
import type {
  Ticket,
  TicketComment,
  TicketCommentInput,
  TicketCreateInput,
  TicketDetail,
  TicketListParams,
  TicketListResponse,
  TicketPatchInput,
} from '../types/ticket';

function buildQuery(params: TicketListParams): string {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.category) query.set('category', params.category);
  if (params.type) query.set('type', params.type);
  if (params.assigneeId) query.set('assigneeId', params.assigneeId);
  if (params.unassigned) query.set('unassigned', 'true');
  if (params.includeClosed) query.set('includeClosed', 'true');
  if (params.sla) query.set('sla', params.sla);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export const fetchTickets = (params: TicketListParams = {}): Promise<TicketListResponse> =>
  apiRequest<TicketListResponse>(`/tickets${buildQuery(params)}`);

export const createTicket = (input: TicketCreateInput): Promise<Ticket> =>
  apiRequest<Ticket>('/tickets', { method: 'POST', body: input });

export const fetchTicket = (id: string): Promise<TicketDetail> => apiRequest<TicketDetail>(`/tickets/${id}`);

export const patchTicket = (id: string, input: TicketPatchInput): Promise<Ticket> =>
  apiRequest<Ticket>(`/tickets/${id}`, { method: 'PATCH', body: input });

export const assignTicket = (id: string, assigneeId: string | null): Promise<Ticket> =>
  apiRequest<Ticket>(`/tickets/${id}/assign`, { method: 'POST', body: { assigneeId } });

export const resolveTicket = (id: string, resolutionNote: string): Promise<Ticket> =>
  apiRequest<Ticket>(`/tickets/${id}/resolve`, { method: 'POST', body: { resolutionNote } });

export const closeTicket = (id: string): Promise<Ticket> =>
  apiRequest<Ticket>(`/tickets/${id}/close`, { method: 'POST' });

export const addTicketComment = (id: string, input: TicketCommentInput): Promise<TicketComment> =>
  apiRequest<TicketComment>(`/tickets/${id}/comments`, { method: 'POST', body: input });
