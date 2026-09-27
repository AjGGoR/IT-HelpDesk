import type { TicketCategory, TicketPriority, TicketStatus, TicketType } from '../types/ticket';

export const TYPE_LABELS: Record<TicketType, string> = {
  SERVICE: 'Usługa',
  INCIDENT: 'Incydent',
};

export const TYPE_DESCRIPTIONS: Record<TicketType, string> = {
  SERVICE: 'Prośba o coś nowego: dostęp, sprzęt, instalację lub zmianę konfiguracji.',
  INCIDENT: 'Coś przestało działać albo działa nieprawidłowo.',
};

// Mirrors backend/src/services/sla.service.ts's SLA_TARGET_MINUTES keys:
// services cannot be CRITICAL (the backend rejects it as well).
export const ALLOWED_PRIORITIES: Record<TicketType, TicketPriority[]> = {
  SERVICE: ['LOW', 'MEDIUM', 'HIGH'],
  INCIDENT: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'Nowe',
  IN_PROGRESS: 'W trakcie',
  WAITING_FOR_USER: 'Oczekujące',
  RESOLVED: 'Rozwiązane',
  CLOSED: 'Zamknięte',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Niski',
  MEDIUM: 'Średni',
  HIGH: 'Wysoki',
  CRITICAL: 'Krytyczny',
};

export const PRIORITY_BADGE_CLASSES: Record<TicketPriority, string> = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  MEDIUM: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  HIGH: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  CRITICAL: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  HARDWARE: 'Sprzęt',
  SOFTWARE: 'Oprogramowanie',
  NETWORK: 'Sieć',
  ACCOUNTS_ACCESS: 'Konta i dostęp',
  EMAIL: 'E-mail',
  SECURITY: 'Bezpieczeństwo',
  OTHER: 'Inne',
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', year: 'numeric', month: 'short', day: 'numeric' });
}
