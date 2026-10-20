import { api, onUnauthorized, unwrap, type Branch, type Permission, type StaffUser, type Tenant } from '@physio/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import i18n from 'i18next';

export interface Session {
  user: StaffUser;
  tenant: Tenant;
  branches: Branch[];
  permissions: string[];
}

interface SessionContextValue {
  session: Session;
  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
  branchId: number | null;
  setBranchId: (id: number | null) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<unknown>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const sessionQueryKey = ['session'] as const;

export async function fetchSession(): Promise<Session | null> {
  const { data, response } = await api.GET('/auth/me');
  if (response.status === 401) return null;
  if (!response.ok || !data) throw new Error('Failed to load session');
  return data.data as unknown as Session;
}

/** Loads /auth/me once; null means signed out. */
export function useSessionQuery() {
  return useQuery({ queryKey: sessionQueryKey, queryFn: fetchSession, staleTime: 5 * 60_000, retry: false });
}

const BRANCH_KEY = 'physio360.branch';

export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [branchId, setBranchState] = useState<number | null>(() => {
    try {
      const stored = Number(localStorage.getItem(BRANCH_KEY));
      return session.branches.some((b) => b.id === stored) ? stored : null;
    } catch {
      return null;
    }
  });

  // Staff language preference follows their profile on first load.
  useEffect(() => {
    if (session.user.locale && session.user.locale !== i18n.language && !localStorage.getItem('physio360.lang')) {
      void i18n.changeLanguage(session.user.locale);
    }
  }, [session.user.locale]);

  // Any 401 (expired / absolute timeout) drops the cached session -> login screen.
  useEffect(
    () =>
      onUnauthorized(() => {
        queryClient.setQueryData(sessionQueryKey, null);
      }),
    [queryClient],
  );

  const setBranchId = useCallback((id: number | null) => {
    setBranchState(id);
    try {
      if (id === null) localStorage.removeItem(BRANCH_KEY);
      else localStorage.setItem(BRANCH_KEY, String(id));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const perms = new Set(session.permissions);
    return {
      session,
      can: (p) => perms.has(p),
      canAny: (...ps) => ps.some((p) => perms.has(p)),
      branchId,
      setBranchId,
      refresh: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
      signOut: async () => {
        await unwrap(api.POST('/auth/logout')).catch(() => undefined);
        queryClient.clear();
        queryClient.setQueryData(sessionQueryKey, null);
      },
    };
  }, [session, branchId, setBranchId, queryClient]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** The branch to default new records to: the selected one, else the first accessible. */
export function useDefaultBranchId(): number {
  const { branchId, session } = useSession();
  return branchId ?? session.branches[0]?.id ?? 0;
}
