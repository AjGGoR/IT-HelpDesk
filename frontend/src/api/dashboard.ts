import { apiRequest } from './client';
import type { DashboardResponse } from '../types/dashboard';

export const fetchDashboard = (): Promise<DashboardResponse> => apiRequest<DashboardResponse>('/dashboard');
