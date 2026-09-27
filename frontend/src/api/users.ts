import { apiRequest } from './client';
import type { SessionUser, UserRole } from '../types/auth';
import type { UserCreateInput } from '../types/user';

export const fetchUsers = (): Promise<{ items: SessionUser[] }> => apiRequest<{ items: SessionUser[] }>('/users');

export const createUser = (input: UserCreateInput): Promise<{ user: SessionUser }> =>
  apiRequest<{ user: SessionUser }>('/users', { method: 'POST', body: input });

export const changeUserRole = (id: string, role: UserRole): Promise<{ user: SessionUser }> =>
  apiRequest<{ user: SessionUser }>(`/users/${id}/role`, { method: 'PATCH', body: { role } });

export const changeUserStatus = (id: string, isActive: boolean): Promise<{ user: SessionUser }> =>
  apiRequest<{ user: SessionUser }>(`/users/${id}/status`, { method: 'PATCH', body: { isActive } });
