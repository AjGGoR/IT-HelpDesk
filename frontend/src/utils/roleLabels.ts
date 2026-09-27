import type { UserRole } from '../types/auth';

export const ROLE_LABELS: Record<UserRole, string> = {
  USER: 'Użytkownik',
  TECHNICIAN: 'Serwisant',
  ADMIN: 'Administrator',
};
