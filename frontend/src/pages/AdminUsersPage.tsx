import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '../api/client';
import { changeUserRole, changeUserStatus, fetchUsers } from '../api/users';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { USER_ROLES, type SessionUser, type UserRole } from '../types/auth';
import { ROLE_LABELS } from '../utils/roleLabels';
import { formatDate } from '../utils/ticketLabels';
import { CARD_CLASSES, ERROR_PANEL_CLASSES, LOADING_PANEL_CLASSES, RETRY_BUTTON_CLASSES } from '../utils/surfaceStyles';
import { FORM_ALERT_CLASSES, PRIMARY_BUTTON_CLASSES } from '../utils/formStyles';
import { displayName } from '../utils/person';

const USERS_QUERY_KEY = ['admin', 'users'] as const;

const ROLE_SELECT_CLASSES =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const STATUS_TOGGLE_BUTTON_CLASSES =
  'rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

function actionErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Nie udało się wykonać akcji. Spróbuj ponownie.';
}

export function AdminUsersPage() {
  useDocumentTitle('Administracja użytkownikami');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: SessionUser; role: UserRole } | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<SessionUser | null>(null);

  const usersQuery = useQuery({ queryKey: USERS_QUERY_KEY, queryFn: fetchUsers });

  const onActionSuccess = (message: string) => {
    setActionError(null);
    showToast(message);
    queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
  };

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => changeUserRole(id, role),
    onSuccess: () => onActionSuccess('Rola użytkownika została zmieniona.'),
    onError: (error) => setActionError(actionErrorMessage(error)),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => changeUserStatus(id, isActive),
    onSuccess: () => onActionSuccess('Status konta został zmieniony.'),
    onError: (error) => setActionError(actionErrorMessage(error)),
  });
  const anyActionPending = roleMutation.isPending || statusMutation.isPending;

  const confirmRoleChange = () => {
    if (!pendingRoleChange) return;
    roleMutation.mutate({ id: pendingRoleChange.user.id, role: pendingRoleChange.role });
    setPendingRoleChange(null);
  };
  const confirmStatusChange = () => {
    if (!pendingStatusChange) return;
    statusMutation.mutate({ id: pendingStatusChange.id, isActive: !pendingStatusChange.isActive });
    setPendingStatusChange(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Administracja użytkownikami</h1>
        <Link to="/admin/users/new" className={PRIMARY_BUTTON_CLASSES}>
          + Nowy użytkownik
        </Link>
      </div>

      {usersQuery.isPending && (
        <div role="status" aria-live="polite" className={LOADING_PANEL_CLASSES}>
          Wczytywanie użytkowników…
        </div>
      )}

      {usersQuery.isError && (
        <div role="alert" className={ERROR_PANEL_CLASSES}>
          <p>{usersQuery.error instanceof ApiError ? usersQuery.error.message : 'Nie udało się wczytać użytkowników.'}</p>
          <button type="button" onClick={() => usersQuery.refetch()} className={RETRY_BUTTON_CLASSES}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {actionError && (
        <p role="alert" className={FORM_ALERT_CLASSES}>
          {actionError}
        </p>
      )}

      {usersQuery.data && (
        <div className={`overflow-x-auto ${CARD_CLASSES}`}>
          {usersQuery.data.items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-500 dark:text-slate-400">Brak użytkowników.</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Lista użytkowników z rolą, statusem konta i akcjami administracyjnymi</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-2">Użytkownik</th>
                  <th scope="col" className="px-4 py-2">Email</th>
                  <th scope="col" className="px-4 py-2">Rola</th>
                  <th scope="col" className="px-4 py-2">Status konta</th>
                  <th scope="col" className="px-4 py-2">Data utworzenia</th>
                  <th scope="col" className="px-4 py-2">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {usersQuery.data.items.map((item: SessionUser) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {displayName(item)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{item.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{ROLE_LABELS[item.role]}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.isActive
                            ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {item.isActive ? 'Aktywne' : 'Nieaktywne'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(item.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <label className="sr-only" htmlFor={`role-${item.id}`}>
                          Rola dla {displayName(item)}
                        </label>
                        <select
                          id={`role-${item.id}`}
                          value={item.role}
                          disabled={anyActionPending}
                          onChange={(event) => {
                            const role = event.target.value as UserRole;
                            if (role === item.role) return;
                            setPendingRoleChange({ user: item, role });
                          }}
                          className={ROLE_SELECT_CLASSES}
                        >
                          {USER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={anyActionPending}
                          onClick={() => setPendingStatusChange(item)}
                          aria-label={`${item.isActive ? 'Dezaktywuj' : 'Aktywuj'} konto ${displayName(item)}`}
                          className={STATUS_TOGGLE_BUTTON_CLASSES}
                        >
                          {item.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingRoleChange !== null}
        title="Zmiana roli użytkownika"
        message={
          pendingRoleChange
            ? `Czy na pewno chcesz zmienić rolę użytkownika ${displayName(pendingRoleChange.user)} na „${ROLE_LABELS[pendingRoleChange.role]}”?`
            : ''
        }
        confirmLabel="Zmień rolę"
        onConfirm={confirmRoleChange}
        onCancel={() => setPendingRoleChange(null)}
      />

      <ConfirmDialog
        open={pendingStatusChange !== null}
        title={pendingStatusChange?.isActive ? 'Dezaktywacja konta' : 'Aktywacja konta'}
        message={
          pendingStatusChange
            ? `Czy na pewno chcesz ${pendingStatusChange.isActive ? 'dezaktywować' : 'aktywować'} konto użytkownika ${displayName(pendingStatusChange)}?`
            : ''
        }
        confirmLabel={pendingStatusChange?.isActive ? 'Dezaktywuj' : 'Aktywuj'}
        variant={pendingStatusChange?.isActive ? 'danger' : 'primary'}
        onConfirm={confirmStatusChange}
        onCancel={() => setPendingStatusChange(null)}
      />
    </div>
  );
}
