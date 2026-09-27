import { useQuery } from '@tanstack/react-query';

import { fetchDashboard } from '../api/dashboard';
import { ApiError } from '../api/client';
import { StaffDashboard } from '../components/dashboard/StaffDashboard';
import { UserHome } from '../components/dashboard/UserHome';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ERROR_PANEL_CLASSES, LOADING_PANEL_CLASSES, RETRY_BUTTON_CLASSES } from '../utils/surfaceStyles';

// SLA state is time-dependent, so the operational view refreshes itself.
const STAFF_REFRESH_MS = 60_000;

function StaffDashboardPage() {
  const dashboardQuery = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard, refetchInterval: STAFF_REFRESH_MS });

  if (dashboardQuery.isPending) {
    return (
      <div role="status" aria-live="polite" className={LOADING_PANEL_CLASSES}>
        Wczytywanie pulpitu…
      </div>
    );
  }

  if (dashboardQuery.isError) {
    const message = dashboardQuery.error instanceof ApiError
      ? dashboardQuery.error.message
      : 'Nie udało się wczytać pulpitu.';
    return (
      <div role="alert" className={ERROR_PANEL_CLASSES}>
        <p>{message}</p>
        <button type="button" onClick={() => dashboardQuery.refetch()} className={RETRY_BUTTON_CLASSES}>
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  return <StaffDashboard data={dashboardQuery.data} />;
}

export function DashboardPage() {
  useDocumentTitle('Pulpit');
  const { user } = useAuth();
  const isStaff = user?.role === 'TECHNICIAN' || user?.role === 'ADMIN';
  return isStaff ? <StaffDashboardPage /> : <UserHome />;
}
