import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMe, login as loginRequest } from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import { clearToken, getToken, setToken } from '../api/tokenStorage';
import type { MeResponse, SessionUser } from '../types/auth';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  user: SessionUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const ME_QUERY_KEY = ['auth', 'me'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState<boolean>(() => getToken() !== null);

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    enabled: hasToken,
    retry: false,
    staleTime: Infinity,
  });

  const logout = useCallback(() => {
    clearToken();
    // Clear the entire cache, not just the session query: any other cached
    // (ticket/dashboard/etc.) data was scoped to this account and must not
    // be readable by whichever account signs in next in this browser tab.
    queryClient.clear();
    setHasToken(false);
  }, [queryClient]);

  useEffect(() => {
    // A 401 only invalidates the session if it belongs to the token that is
    // still the active one. A request started under a previous token (e.g.
    // an old /me restoration still in flight) must not be able to clear a
    // session that has since logged in again under a new token.
    const handleUnauthorized = (requestToken: string | null) => {
      if (requestToken && requestToken === getToken()) logout();
    };
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    if (hasToken && meQuery.isError) logout();
  }, [hasToken, meQuery.isError, logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginRequest(email, password);
      // Cancel any in-flight session query (e.g. a stale /me restoration for
      // a previous token) so its late resolution cannot overwrite the
      // session we are about to seed for the newly authenticated account.
      await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY });
      setToken(data.token);
      queryClient.setQueryData<MeResponse>(ME_QUERY_KEY, { user: data.user });
      setHasToken(true);
    },
    [queryClient],
  );

  const status: AuthStatus = !hasToken ? 'unauthenticated' : meQuery.data ? 'authenticated' : meQuery.isError ? 'unauthenticated' : 'loading';

  const value = useMemo<AuthContextValue>(
    () => ({ user: meQuery.data?.user ?? null, status, login, logout }),
    [meQuery.data, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
