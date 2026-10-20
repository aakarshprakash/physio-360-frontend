import { api, unwrap, type Patient } from '@physio/api';
import { Avatar, Button, Card, ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, ErrorState, PageLoader, Tabs, TabsContent, TabsList, TabsTrigger, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowLeft, CalendarPlus, Mail, MoreHorizontal, Pencil, Phone, ReceiptText } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { StatusBadge } from '../../components/common';
import { toastError } from '../../lib/errors';
import { useSession } from '../../lib/session';
import { AppointmentDialog } from '../appointments/AppointmentDialog';
import { useCalendarResources } from '../../lib/appointments';
import { PatientFormDialog } from './PatientFormDialog';
import { OverviewTab } from './tabs/OverviewTab';

const AppointmentsTab = lazy(() => import('./tabs/AppointmentsTab').then((m) => ({ default: m.AppointmentsTab })));
const AssessmentsTab = lazy(() => import('./tabs/AssessmentsTab').then((m) => ({ default: m.AssessmentsTab })));
const NotesTab = lazy(() => import('./tabs/NotesTab').then((m) => ({ default: m.NotesTab })));
const PlansTab = lazy(() => import('./tabs/PlansTab').then((m) => ({ default: m.PlansTab })));
const ProgressTab = lazy(() => import('./tabs/ProgressTab').then((m) => ({ default: m.ProgressTab })));
const DocumentsTab = lazy(() => import('./tabs/DocumentsTab').then((m) => ({ default: m.DocumentsTab })));
const BillingTab = lazy(() => import('./tabs/BillingTab').then((m) => ({ default: m.BillingTab })));
const TimelineTab = lazy(() => import('./tabs/TimelineTab').then((m) => ({ default: m.TimelineTab })));
const PrescriptionsTab = lazy(() => import('./tabs/PrescriptionsTab').then((m) => ({ default: m.PrescriptionsTab })));

export function usePatient(id: number) {
  return useQuery({
    queryKey: ['patient', id],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}', { params: { path: { patient: id } } }))).data as Patient,
  });
}

export function PatientPage() {
  const { t } = useTranslation();
  const { patientId } = useParams();
  const id = Number(patientId);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { can, session } = useSession();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(params.get('book') === '1');
  const { data: patient, isLoading, error } = usePatient(id);
  const { data: resources } = useCalendarResources(patient?.primary_branch_id ?? 0);

  const archive = useMutation({
    mutationFn: () => unwrap(api.DELETE('/patients/{patient}', { params: { path: { patient: id } } })),
    onSuccess: () => {
      toast.success(t('patients.archived'));
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      navigate('/patients');
    },
    onError: toastError,
  });

  if (isLoading) return <PageLoader />;
  if (error || !patient) {
    return <ErrorState title={t('common:errors.notFound')} action={<Button asChild variant="outline"><Link to="/patients">{t('common:actions.back')}</Link></Button>} />;
  }

  const tabs = [
    { key: 'overview', show: true },
    { key: 'timeline', show: true },
    { key: 'appointments', show: can('appointments.view') },
    { key: 'assessments', show: can('clinical.view') },
    { key: 'notes', show: can('clinical.view') },
    { key: 'plans', show: can('clinical.view') },
    { key: 'prescriptions', show: can('clinical.view') },
    { key: 'progress', show: can('clinical.view') },
    { key: 'documents', show: can('clinical.view') },
    { key: 'billing', show: can('billing.view') },
  ].filter((x) => x.show);
  const tab = tabs.some((x) => x.key === params.get('tab')) ? params.get('tab')! : 'overview';

  return (
    <div className="space-y-5">
      <Link to="/patients" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t('patients.title')}
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={patient.full_name} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{patient.full_name}</h1>
              <StatusBadge status={patient.status} />
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              <span className="tabular font-medium">#{patient.mrn}</span>
              {patient.age != null && <> · {t('patients.years', { count: patient.age })}</>}
              {patient.gender && <> · {t(`common:gender.${patient.gender}`)}</>}
              {patient.primary_practitioner && <> · {patient.primary_practitioner.name}</>}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <a href={`tel:${patient.phone}`} className="inline-flex items-center gap-1.5 text-fg hover:text-primary">
                <Phone className="size-4 text-fg-subtle" />
                <span dir="ltr" className="tabular">{patient.phone}</span>
              </a>
              {patient.email && (
                <a href={`mailto:${patient.email}`} className="inline-flex items-center gap-1.5 text-fg hover:text-primary">
                  <Mail className="size-4 text-fg-subtle" />
                  {patient.email}
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('appointments.manage') && (
              <Button onClick={() => setBooking(true)}>
                <CalendarPlus />
                {t('dashboard.newAppointment')}
              </Button>
            )}
            {can('patients.manage') && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                {t('common:actions.edit')}
              </Button>
            )}
            {(can('billing.manage') || can('patients.delete')) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label={t('common:actions.more')}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {can('billing.manage') && (
                    <DropdownMenuItem onSelect={() => navigate(`/billing?new=1&patient=${patient.id}`)}>
                      <ReceiptText />
                      {t('billing.newInvoice')}
                    </DropdownMenuItem>
                  )}
                  {can('patients.delete') && (
                    <ConfirmDialog
                      tone="danger"
                      title={t('patients.archive')}
                      description={t('patients.archiveConfirm')}
                      confirmLabel={t('patients.archive')}
                      cancelLabel={t('common:actions.cancel')}
                      onConfirm={() => archive.mutateAsync()}
                      trigger={
                        <DropdownMenuItem tone="danger" onSelect={(e) => e.preventDefault()}>
                          <Archive />
                          {t('patients.archive')}
                        </DropdownMenuItem>
                      }
                    />
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </Card>

      <Tabs
        value={tab}
        onValueChange={(v) =>
          setParams((p) => {
            p.set('tab', v);
            return p;
          }, { replace: true })
        }
      >
        <TabsList aria-label={patient.full_name}>
          {tabs.map((x) => (
            <TabsTrigger key={x.key} value={x.key}>
              {t(`patients.tabs.${x.key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="pt-5">
          <Suspense fallback={<PageLoader />}>
            <TabsContent value="overview">
              <OverviewTab patient={patient} />
            </TabsContent>
            <TabsContent value="timeline">{tab === 'timeline' && <TimelineTab patient={patient} />}</TabsContent>
            <TabsContent value="appointments">{tab === 'appointments' && <AppointmentsTab patient={patient} />}</TabsContent>
            <TabsContent value="assessments">{tab === 'assessments' && <AssessmentsTab patient={patient} />}</TabsContent>
            <TabsContent value="notes">{tab === 'notes' && <NotesTab patient={patient} appointmentId={params.get('appointment')} />}</TabsContent>
            <TabsContent value="plans">{tab === 'plans' && <PlansTab patient={patient} />}</TabsContent>
            <TabsContent value="prescriptions">{tab === 'prescriptions' && <PrescriptionsTab patient={patient} />}</TabsContent>
            <TabsContent value="progress">{tab === 'progress' && <ProgressTab patient={patient} />}</TabsContent>
            <TabsContent value="documents">{tab === 'documents' && <DocumentsTab patient={patient} />}</TabsContent>
            <TabsContent value="billing">{tab === 'billing' && <BillingTab patient={patient} />}</TabsContent>
          </Suspense>
        </div>
      </Tabs>

      {editing && <PatientFormDialog patient={patient} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {booking && (
        <AppointmentDialog
          open
          branchId={session.branches.some((b) => b.id === patient.primary_branch_id) ? patient.primary_branch_id : (session.branches[0]?.id ?? 0)}
          draft={{ patient: { id: patient.id, full_name: patient.full_name, mrn: patient.mrn }, practitionerId: patient.primary_practitioner?.id }}
          resources={resources}
          onClose={() => setBooking(false)}
          onBooked={() => {
            setBooking(false);
            void queryClient.invalidateQueries({ queryKey: ['appointments'] });
          }}
        />
      )}
    </div>
  );
}
