import type { TicketCategory, TicketPriority, TicketSla, TicketStatus, TicketType } from './ticket';

export type DashboardPersonSummary = {
  id: string;
  firstName: string;
  lastName: string;
};

// Fields returned for every ticket embedded in the dashboard response (both
// `recentTickets` and `attentionTickets`), including the reporter/assignee
// relation and the server-calculated SLA.
export type DashboardTicketSummary = {
  id: string;
  ticketNumber: string;
  title: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  reporterId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  sla: TicketSla | null;
  reporter: DashboardPersonSummary;
  assignee: DashboardPersonSummary | null;
};

export type DashboardRecentTicket = DashboardTicketSummary;
export type DashboardAttentionTicket = DashboardTicketSummary;

export type ActiveTicketStatus = Exclude<TicketStatus, 'CLOSED'>;

// TECHNICIAN/ADMIN only. Every count is over non-CLOSED tickets - the same
// scope as the default GET /api/tickets list the dashboard links to - and
// the SLA counts cover tickets whose SLA clock is running.
export type DashboardOperations = {
  active: number;
  byStatus: Record<ActiveTicketStatus, number>;
  byType: Record<TicketType, number>;
  critical: number;
  unassigned: number;
  attention: number;
  sla: { breached: number; warning: number; dueToday: number };
};

export type DashboardTicketStats = {
  total: number;
  new: number;
  inProgress: number;
  waitingForUser: number;
  resolved: number;
  // Only present for TECHNICIAN/ADMIN.
  critical?: number;
};

export type DashboardUserStats = {
  users: number;
  technicians: number;
  admins: number;
};

export type DashboardResponse = {
  tickets: DashboardTicketStats;
  recentTickets: DashboardRecentTicket[];
  // Only present for TECHNICIAN/ADMIN.
  operations?: DashboardOperations;
  // Only present for TECHNICIAN/ADMIN; most urgent SLA first.
  attentionTickets?: DashboardAttentionTicket[];
  // Only present for ADMIN.
  users?: DashboardUserStats;
};
