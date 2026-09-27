import { CircleCheck, Clock, TriangleAlert } from 'lucide-react';

import type { TicketPriority, TicketSla, TicketStatus, TicketType } from '../../types/ticket';
import { SLA_STATE_LABELS, slaSummary } from '../../utils/sla';
import { PRIORITY_BADGE_CLASSES, PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS, formatDateTime } from '../../utils/ticketLabels';

const BADGE_BASE = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium';

const TYPE_BADGE_CLASSES: Record<TicketType, string> = {
  INCIDENT: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900',
  SERVICE: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900',
};

export function TypeBadge({ type }: { type: TicketType }) {
  return <span className={`${BADGE_BASE} ${TYPE_BADGE_CLASSES[type]}`}>{TYPE_LABELS[type]}</span>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={`${BADGE_BASE} ${PRIORITY_BADGE_CLASSES[priority]}`}>{PRIORITY_LABELS[priority]}</span>;
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`${BADGE_BASE} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// SLA state as a compact badge. A running, breached SLA uses a solid red
// badge with an alert icon so it cannot be missed in dense lists; the text
// always carries the meaning, the icon is decorative.
export function SlaBadge({ sla }: { sla: TicketSla | null }) {
  if (!sla) return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
  const title = `Termin SLA: ${formatDateTime(sla.dueAt)}`;
  if (sla.state === 'BREACHED') {
    return (
      <span
        title={title}
        className={`${BADGE_BASE} ${
          sla.running
            ? 'bg-red-600 text-white dark:bg-red-600 dark:text-white'
            : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900'
        }`}
      >
        <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
        {sla.running ? slaSummary(sla) : SLA_STATE_LABELS.BREACHED}
      </span>
    );
  }
  if (sla.state === 'MET') {
    return (
      <span title={title} className={`${BADGE_BASE} bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300`}>
        <CircleCheck aria-hidden="true" className="h-3.5 w-3.5" />
        {SLA_STATE_LABELS.MET}
      </span>
    );
  }
  const warning = sla.state === 'WARNING';
  return (
    <span
      title={title}
      className={`${BADGE_BASE} ${
        warning
          ? 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      <Clock aria-hidden="true" className="h-3.5 w-3.5" />
      {slaSummary(sla)}
    </span>
  );
}
