import { PageLoader, Toaster } from '@physio/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { AppShell } from './components/AppShell';
import { Forbidden } from './components/Forbidden';
import { queryClient } from './lib/query';
import { SessionProvider, useSession, useSessionQuery } from './lib/session';
import type { Permission } from '@physio/api';

const page = (loader: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType })));

const LoginPage = page(() => import('./routes/auth/LoginPage'), 'LoginPage');
const ForgotPasswordPage = page(() => import('./routes/auth/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = page(() => import('./routes/auth/ResetPasswordPage'), 'ResetPasswordPage');
const DashboardPage = page(() => import('./routes/dashboard/DashboardPage'), 'DashboardPage');
const CalendarPage = page(() => import('./routes/appointments/CalendarPage'), 'CalendarPage');
const PatientsPage = page(() => import('./routes/patients/PatientsPage'), 'PatientsPage');
const PatientPage = page(() => import('./routes/patients/PatientPage'), 'PatientPage');
const EnquiriesPage = page(() => import('./routes/enquiries/EnquiriesPage'), 'EnquiriesPage');
const TreatmentPlansPage = page(() => import('./routes/plans/TreatmentPlansPage'), 'TreatmentPlansPage');
const TreatmentPlanPage = page(() => import('./routes/plans/TreatmentPlanPage'), 'TreatmentPlanPage');
const ExercisesPage = page(() => import('./routes/exercises/ExercisesPage'), 'ExercisesPage');
const BillingPage = page(() => import('./routes/billing/BillingPage'), 'BillingPage');
const InvoicePage = page(() => import('./routes/billing/InvoicePage'), 'InvoicePage');
const ReportsPage = page(() => import('./routes/reports/ReportsPage'), 'ReportsPage');
const StaffPage = page(() => import('./routes/staff/StaffPage'), 'StaffPage');
const SettingsPage = page(() => import('./routes/settings/SettingsPage'), 'SettingsPage');
const AuditPage = page(() => import('./routes/audit/AuditPage'), 'AuditPage');
const ProfilePage = page(() => import('./routes/profile/ProfilePage'), 'ProfilePage');
const ConsultationsPage = page(() => import('./routes/consultations/ConsultationsPage'), 'ConsultationsPage');
const PrescriptionsPage = page(() => import('./routes/prescriptions/PrescriptionsPage'), 'PrescriptionsPage');
const PackagesPage = page(() => import('./routes/packages/PackagesPage'), 'PackagesPage');
const PaymentRemindersPage = page(() => import('./routes/reminders/PaymentRemindersPage'), 'PaymentRemindersPage');
const MessagesPage = page(() => import('./routes/messages/MessagesPage'), 'MessagesPage');
const AttendancePage = page(() => import('./routes/attendance/AttendancePage'), 'AttendancePage');
const LeavePage = page(() => import('./routes/leave/LeavePage'), 'LeavePage');
const PayrollPage = page(() => import('./routes/payroll/PayrollPage'), 'PayrollPage');
const PayrollRunPage = page(() => import('./routes/payroll/PayrollRunPage'), 'PayrollRunPage');
const SupportPage = page(() => import('./routes/support/SupportPage'), 'SupportPage');
const NotFoundPage = page(() => import('./routes/NotFoundPage'), 'NotFoundPage');

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

/** Signed-in area: loads the session or redirects to /login?next=… */
function RequireAuth() {
  const { data: session, isLoading } = useSessionQuery();
  const location = useLocation();

  if (isLoading) return <PageLoader />;
  if (!session) {
    const next = location.pathname + location.search;
    return <Navigate to={next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'} replace />;
  }

  return (
    <SessionProvider session={session}>
      <AppShell>
        <Lazy>
          <Outlet />
        </Lazy>
      </AppShell>
    </SessionProvider>
  );
}

/** Hides pages the user's role cannot use (the API enforces this regardless). */
function RequirePermission({ any, children }: { any: Permission[]; children: ReactNode }) {
  const { canAny } = useSession();
  return canAny(...any) ? <>{children}</> : <Forbidden />;
}

function GuestOnly() {
  const { data: session, isLoading } = useSessionQuery();
  if (isLoading) return <PageLoader />;
  if (session) return <Navigate to="/" replace />;
  return (
    <Lazy>
      <Outlet />
    </Lazy>
  );
}

const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  { path: '/reset-password', element: <Lazy><ResetPasswordPage /></Lazy> },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'appointments', element: <RequirePermission any={['appointments.view']}><CalendarPage /></RequirePermission> },
      { path: 'patients', element: <RequirePermission any={['patients.view']}><PatientsPage /></RequirePermission> },
      { path: 'patients/:patientId', element: <RequirePermission any={['patients.view']}><PatientPage /></RequirePermission> },
      { path: 'enquiries', element: <RequirePermission any={['enquiries.manage']}><EnquiriesPage /></RequirePermission> },
      { path: 'treatment-plans', element: <RequirePermission any={['clinical.view']}><TreatmentPlansPage /></RequirePermission> },
      { path: 'treatment-plans/:planId', element: <RequirePermission any={['clinical.view']}><TreatmentPlanPage /></RequirePermission> },
      { path: 'exercises', element: <RequirePermission any={['clinical.view', 'exercises.manage']}><ExercisesPage /></RequirePermission> },
      { path: 'billing', element: <RequirePermission any={['billing.view']}><BillingPage /></RequirePermission> },
      { path: 'billing/invoices/:invoiceId', element: <RequirePermission any={['billing.view']}><InvoicePage /></RequirePermission> },
      { path: 'reports', element: <RequirePermission any={['reports.view']}><ReportsPage /></RequirePermission> },
      { path: 'staff', element: <RequirePermission any={['staff.manage']}><StaffPage /></RequirePermission> },
      { path: 'settings', element: <RequirePermission any={['settings.manage']}><SettingsPage /></RequirePermission> },
      { path: 'audit', element: <RequirePermission any={['audit.view']}><AuditPage /></RequirePermission> },
      { path: 'consultations', element: <RequirePermission any={['clinical.view']}><ConsultationsPage /></RequirePermission> },
      { path: 'prescriptions', element: <RequirePermission any={['clinical.view']}><PrescriptionsPage /></RequirePermission> },
      { path: 'packages', element: <RequirePermission any={['billing.view']}><PackagesPage /></RequirePermission> },
      { path: 'payment-reminders', element: <RequirePermission any={['messages.send']}><PaymentRemindersPage /></RequirePermission> },
      { path: 'messages', element: <RequirePermission any={['messages.send']}><MessagesPage /></RequirePermission> },
      // Self-service for every staff member; manager views unlock by permission inside the pages.
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'leave', element: <LeavePage /> },
      { path: 'payroll', element: <PayrollPage /> },
      { path: 'payroll/:runId', element: <RequirePermission any={['payroll.manage']}><PayrollRunPage /></RequirePermission> },
      { path: 'support', element: <SupportPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  const { i18n } = useTranslation();
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton dir={i18n.dir()} toastOptions={{ duration: 4000 }} />
    </QueryClientProvider>
  );
}
