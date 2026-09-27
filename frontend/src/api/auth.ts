import { apiRequest } from './client';
import type { LoginResponse, MeResponse } from '../types/auth';

export const login = (email: string, password: string): Promise<LoginResponse> =>
  apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });

export const fetchMe = (): Promise<MeResponse> => apiRequest<MeResponse>('/auth/me');
