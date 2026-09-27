export type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketCategory = 'HARDWARE' | 'SOFTWARE' | 'NETWORK' | 'ACCOUNTS_ACCESS' | 'EMAIL' | 'SECURITY' | 'OTHER';
export type TicketType = 'SERVICE' | 'INCIDENT';

// Mirrors backend/src/services/sla.service.ts's `SlaInfo`. Calculated by the
// server (working time: Mon-Fri 08:00-16:00 Europe/Warsaw without Polish
// public holidays) - the frontend only formats it, it never recalculates it.
export type SlaState = 'ON_TRACK' | 'WARNING' | 'BREACHED' | 'MET';
export type SlaFilter = 'BREACHED' | 'WARNING' | 'DUE_TODAY' | 'ATTENTION';
export type TicketSla = {
  dueAt: string;
  targetMinutes: number;
  warningThresholdMinutes: number;
  // Signed working minutes to the deadline (negative once breached); null
  // when the clock is stopped (RESOLVED/CLOSED).
  remainingMinutes: number | null;
  running: boolean;
  dueToday: boolean;
  state: SlaState;
};

export type TicketPerson = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'TECHNICIAN' | 'ADMIN';
  isActive: boolean;
};

// Matches backend/src/services/ticket.service.ts's `ticketInclude` (reporter
// and assignee always included with this exact field subset for both
// GET /api/tickets and GET /api/tickets/:id).
export type Ticket = {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  type: TicketType;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  reporterId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  slaDueAt: string | null;
  // Required when a ticket is resolved; null for tickets resolved before the
  // field existed and for tickets that are not resolved (again) yet.
  resolutionNote: string | null;
  sla: TicketSla | null;
  reporter: TicketPerson;
  assignee: TicketPerson | null;
};

export type TicketListSortBy = 'createdAt' | 'updatedAt' | 'priority' | 'status' | 'slaDueAt';
export type TicketListSortOrder = 'asc' | 'desc';

// Mirrors backend/src/validators/api.ts's `ticketListSchema` query params.
export type TicketListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  type?: TicketType;
  assigneeId?: string;
  unassigned?: boolean;
  // The backend hides CLOSED tickets unless `status` or this flag asks for them.
  includeClosed?: boolean;
  sla?: SlaFilter;
  sortBy?: TicketListSortBy;
  sortOrder?: TicketListSortOrder;
};

export type TicketPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type TicketListResponse = {
  items: Ticket[];
  pagination: TicketPagination;
};

// Mirrors backend/src/validators/api.ts's `ticketCreateSchema`.
export type TicketCreateInput = {
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
};

export type TicketHistoryAction =
  | 'TICKET_CREATED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'CATEGORY_CHANGED'
  | 'ASSIGNEE_CHANGED'
  | 'COMMENT_ADDED'
  | 'TICKET_RESOLVED'
  | 'TICKET_CLOSED';

// The {id,firstName,lastName,role} subset backend/src/services/ticket.service.ts's
// getTicket() selects for both comment authors and history actors.
export type TicketActorSummary = {
  id: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'TECHNICIAN' | 'ADMIN';
};

export type TicketComment = {
  id: string;
  content: string;
  authorId: string;
  ticketId: string;
  createdAt: string;
  updatedAt: string;
  author: TicketActorSummary;
};

export type TicketHistoryEntry = {
  id: string;
  ticketId: string;
  actorId: string;
  action: TicketHistoryAction;
  // The backend already renders a human-readable Polish sentence here
  // (see ticket.service.ts) - the frontend renders it verbatim rather than
  // re-deriving a label from `action`.
  description: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: TicketActorSummary;
};

// GET /api/tickets/:id - the full ticket plus its comments and history in
// one query (ticket.service.ts's getTicket()).
export type TicketDetail = Ticket & {
  comments: TicketComment[];
  history: TicketHistoryEntry[];
};

// Mirrors backend/src/validators/api.ts's `ticketPatchSchema` (only the
// subset this app's UI actually drives - status and priority changes;
// title/description/category self-editing by USER while a ticket is still
// NEW/WAITING_FOR_USER is not part of this slice).
export type TicketPatchInput = {
  status?: TicketStatus;
  priority?: TicketPriority;
};

// Mirrors backend/src/validators/api.ts's `commentSchema`.
export type TicketCommentInput = {
  content: string;
};
