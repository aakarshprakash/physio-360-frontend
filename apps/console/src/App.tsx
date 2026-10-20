import { api, ApiError, onUnauthorized, unwrap } from '@physio/api';
import { Alert, Button, Field, Input, Logo, PageLoader, Toaster } from '@physio/ui';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, LayoutDashboard, LifeBuoy, LogOut, ScrollText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, NavLink, Outlet, RouterProvider, useNavigate } from 'react-router';
import { AuditPage } from './pages/AuditPage';
import { DashboardPage } from './pages/DashboardPage';
import { SupportPage } from './pages/SupportPage';
import { TenantPage } from './pages/TenantPage';
import { TenantsPage } from './pages/TenantsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2 } },
});

interface Admin {
  id: number;
  name: string;
  email: string;
}

function useAdmin() {
  return useQuery({
    queryKey: ['admin'],
    queryFn: async () => {
      const { data, response } = await api.GET('/platform/auth/me');
      if (response.status === 401) return null;
      return (data as unknown as { data: Admin }).data;
    },
    retry: false,
  });
}

function Shell() {
  const { data: admin, isLoading } = useAdmin();
  const client = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => onUnauthorized(() => client.setQueryData(['admin'], null)), [client]);

  if (isLoading) return <PageLoader />;
  if (!admin) return <Navigate to="/login" replace />;

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-white'}`;

  return (
    <div className="min-h-dvh lg:ps-60">
      <aside className="z-30 flex flex-col bg-sidebar lg:fixed lg:inset-y-0 lg:start-0 lg:w-60">
        <div className="flex h-16 items-center justify-between px-5">
          <Logo inverted />
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80">Console</span>
        </div>
        <nav aria-label="Console" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:pt-3">
          <NavLink to="/" end className={link}><LayoutDashboard className="size-[18px]" />Overview</NavLink>
          <NavLink to="/tenants" className={link}><Building2 className="size-[18px]" />Clinics</NavLink>
          <NavLink to="/support" className={link}><LifeBuoy className="size-[18px]" />Support</NavLink>
          <NavLink to="/audit" className={link}><ScrollText className="size-[18px]" />Audit</NavLink>
        </nav>
        <div className="hidden border-t border-white/10 p-4 text-xs text-sidebar-muted lg:block">
          <p className="truncate font-semibold text-white/90">{admin.name}</p>
          <p className="truncate">{admin.email}</p>
          <button
            type="button"
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-sidebar-fg hover:text-white"
            onClick={async () => {
              await unwrap(api.POST('/platform/auth/logout')).catch(() => undefined);
              client.clear();
              navigate('/login', { replace: true });
            }}
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

function LoginPage() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-h-dvh place-items-center bg-sidebar px-4">
      <form
        className="w-full max-w-sm rounded-2xl bg-surface p-7 shadow-pop"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const r = await unwrap(api.POST('/platform/auth/login', { body: { email, password } }));
            client.setQueryData(['admin'], (r as unknown as { data: Admin }).data);
            navigate('/', { replace: true });
          } catch (err) {
            setError(err instanceof ApiError ? (err.fieldError('email') ?? err.message) : 'Sign-in failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Logo />
        <h1 className="mt-6 text-xl font-bold">SYSNAC Console</h1>
        <p className="mt-1 text-sm text-fg-muted">Operator access to clinic tenants.</p>
        <div className="mt-6 space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Email" required><Input type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" required><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
        </div>
      </form>
    </div>
  );
}

const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      element: <Shell />,
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'tenants', element: <TenantsPage /> },
        { path: 'tenants/:tenantId', element: <TenantPage /> },
        { path: 'audit', element: <AuditPage /> },
        { path: 'support', element: <SupportPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: '/console' },
);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
