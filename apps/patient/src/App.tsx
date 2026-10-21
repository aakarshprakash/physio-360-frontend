import { ApiError } from '@physio/api';
import { cn, PageLoader, Toaster } from '@physio/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarDays, Dumbbell, Home, Menu, Plus } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, Navigate, NavLink, Outlet, RouterProvider, useLocation } from 'react-router';
import { SessionProvider, useSessionQuery } from './lib/session';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2 } },
});

const page = (loader: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType })));

const LoginPage = page(() => import('./pages/LoginPage'), 'LoginPage');
const ActivatePage = page(() => import('./pages/LoginPage'), 'ActivatePage');
const HomePage = page(() => import('./pages/HomePage'), 'HomePage');
const AppointmentsPage = page(() => import('./pages/AppointmentsPage'), 'AppointmentsPage');
const BookPage = page(() => import('./pages/BookPage'), 'BookPage');
const ExercisesPage = page(() => import('./pages/ExercisesPage'), 'ExercisesPage');
const ProgressPage = page(() => import('./pages/ProgressPage'), 'ProgressPage');
const BillingPage = page(() => import('./pages/BillingPage'), 'BillingPage');
const ConsentsPage = page(() => import('./pages/ConsentsPage'), 'ConsentsPage');
const MorePage = page(() => import('./pages/MorePage'), 'MorePage');
const PublicBookingPage = page(() => import('./pages/PublicBookingPage'), 'PublicBookingPage');

function Shell() {
  const { t } = useTranslation();
  const { data: session, isLoading } = useSessionQuery();
  const location = useLocation();
  if (isLoading) return <PageLoader />;
  if (!session) return <Navigate to={`/login${location.search}`} replace />;

  const tab = ({ isActive }: { isActive: boolean }) =>
    cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-primary' : 'text-fg-muted');

  return (
    <SessionProvider session={session}>
      <div className="mx-auto min-h-dvh max-w-lg pb-24">
        <main id="main" className="px-4 pt-4">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-end">
          <NavLink to="/" end className={tab}><Home className="size-5" />{t('nav.home')}</NavLink>
          <NavLink to="/appointments" className={tab}><CalendarDays className="size-5" />{t('nav.appointments')}</NavLink>
          <NavLink to="/book" className="-mt-5 flex flex-1 flex-col items-center gap-0.5 text-[11px] font-medium text-primary">
            <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-fg shadow-pop"><Plus className="size-6" /></span>
            {t('nav.book')}
          </NavLink>
          <NavLink to="/exercises" className={tab}><Dumbbell className="size-5" />{t('nav.exercises')}</NavLink>
          <NavLink to="/more" className={tab}><Menu className="size-5" />{t('nav.more')}</NavLink>
        </div>
      </nav>
    </SessionProvider>
  );
}

function Guest() {
  const { data: session, isLoading } = useSessionQuery();
  if (isLoading) return <PageLoader />;
  if (session) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
}

const router = createBrowserRouter(
  [
    // Public booking page (link / WhatsApp / website embed): no account needed.
    { path: '/book/:slug', element: <Suspense fallback={<PageLoader />}><PublicBookingPage /></Suspense> },
    { element: <Guest />, children: [{ path: '/login', element: <LoginPage /> }, { path: '/activate', element: <ActivatePage /> }] },
    {
      element: <Shell />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'appointments', element: <AppointmentsPage /> },
        { path: 'book', element: <BookPage /> },
        { path: 'exercises', element: <ExercisesPage /> },
        { path: 'progress', element: <ProgressPage /> },
        { path: 'invoices', element: <BillingPage /> },
        { path: 'consents', element: <ConsentsPage /> },
        { path: 'more', element: <MorePage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: '/my' },
);

export function App() {
  const { i18n } = useTranslation();
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors dir={i18n.dir()} />
    </QueryClientProvider>
  );
}
