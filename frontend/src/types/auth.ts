export const USER_ROLES = ['USER', 'TECHNICIAN', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LoginResponse = { token: string; user: SessionUser };
export type MeResponse = { user: SessionUser };
