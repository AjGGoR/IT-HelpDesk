import type { SlaState, TicketSla } from '../types/ticket';

const WORKING_DAY_MINUTES = 8 * 60;

// Formats a number of *working* minutes (1 working day = 8 h, Mon-Fri
// 08:00-16:00) as a compact Polish duration, e.g. "2 d 3 h", "5 h 20 min".
export function formatWorkingDuration(minutes: number): string {
  const total = Math.abs(Math.round(minutes));
  const days = Math.floor(total / WORKING_DAY_MINUTES);
  const hours = Math.floor((total % WORKING_DAY_MINUTES) / 60);
  const mins = total % 60;
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
  return `${mins} min`;
}

export const SLA_STATE_LABELS: Record<SlaState, string> = {
  ON_TRACK: 'W terminie',
  WARNING: 'Termin blisko',
  BREACHED: 'SLA przekroczone',
  MET: 'SLA dotrzymane',
};

// One-line, human readable SLA summary used by badges and screen readers.
export function slaSummary(sla: TicketSla): string {
  if (!sla.running) return SLA_STATE_LABELS[sla.state];
  const remaining = sla.remainingMinutes ?? 0;
  // A deadline that passed outside working hours has no working-time delay yet.
  if (sla.state === 'BREACHED')
    return remaining < 0 ? `SLA przekroczone o ${formatWorkingDuration(remaining)}` : SLA_STATE_LABELS.BREACHED;
  return `Pozostało ${formatWorkingDuration(remaining)}`;
}
