import type { UserRole } from './auth';

// Mirrors backend/src/validators/api.ts's `userCreateSchema`.
export type UserCreateInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};
