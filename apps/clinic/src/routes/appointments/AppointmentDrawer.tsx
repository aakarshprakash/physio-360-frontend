import { api, unwrap, type Appointment, type AppointmentStatus } from '@physio/api';
import { Avatar, Button, ConfirmDialog, DetailList, Dialog, Field, PageLoader, SheetContent, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, FileText, Home, NotebookPen, ReceiptText, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { StatusBadge } from '../../components/common';
import { STATUS_ACTIONS } from '../../lib/appointments';
import { toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useSession } from '../../lib/session';

interface Props {
  appointmentId: number | null;
  onClose: () => void;
  onReschedule: (appointment: Appointment) => void;
}

export function AppointmentDrawer({ appointmentId, onClose, onReschedule }: Props) {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const { data: appointment, isLoading } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => (await unwrap(api.GET('/appointments/{appointment}', { params: { path: { appointment: appointmentId! } } }))).data as Appointment,
    enabled: appointmentId !== null,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    void queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const transition = useMutation({
    mutationFn: (vars: { status: AppointmentStatus; reason?: string }) =>
      unwrap(api.POST('/appointments/{appointment}/status', { params: { path: { appointment: appointmentId! } }, body: vars as never })),
    onSuccess: () => {
      toast.success(t('appointments.statusUpdated'));
      setReason('');
      refresh();
    },
    onError: toastError,
  });

  const invoice = useMutation({
    mutationFn: () => unwrap(api.POST('/appointments/{appointment}/invoice', { params: { path: { appointment: appointmentId! } } })),
    onSuccess: (r) => {
      toast.success(t('billing.invoiceCreated'));
      navigate(`/billing/invoices/${(r as unknown as { data: { id: number } }).data.id}`);
    },
    onError: toastError,
  });

  const allowed = new Set(appointment?.allowed_transitions ?? []);
  const manage = can('appointments.manage');

  return (
    <Dialog open={appointmentId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={t('appointments.details')}
        description={appointment ? f.local(appointment.local_start, 'EEEE, d MMMM yyyy · h:mm a') : undefined}
        footer={
          appointment && manage && appointment.allowed_transitions.length > 0 ? (
            <div className="flex w-full flex-wrap justify-end gap-2">
              {STATUS_ACTIONS.filter((a) => allowed.has(a.to)).map((action) =>
                action.to === 'cancelled' ? (
                  <ConfirmDialog
                    key={action.to}
                    tone="danger"
                    title={t('appointments.cancelConfirm')}
                    confirmLabel={t('appointments.actions.cancel')}
                    cancelLabel={t('common:actions.back')}
                    trigger={<Button variant={action.variant}>{t(`appointments.actions.${action.key}`)}</Button>}
                    onConfirm={() => transition.mutateAsync({ status: 'cancelled', reason: reason || 'Cancelled by clinic' })}
                  >
                    <Field label={t('appointments.cancelReason')}>
                      <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Field>
                  </ConfirmDialog>
                ) : action.to === 'no_show' ? (
                  <ConfirmDialog
                    key={action.to}
                    tone="danger"
                    title={t('appointments.noShowConfirm')}
                    confirmLabel={t('appointments.actions.noShow')}
                    cancelLabel={t('common:actions.back')}
                    trigger={<Button variant={action.variant}>{t(`appointments.actions.${action.key}`)}</Button>}
                    onConfirm={() => transition.mutateAsync({ status: 'no_show' })}
                  />
                ) : (
                  <Button key={action.to} variant={action.variant} loading={transition.isPending && transition.variables?.status === action.to} onClick={() => transition.mutate({ status: action.to })}>
                    {t(`appointments.actions.${action.key}`)}
                  </Button>
                ),
              )}
            </div>
          ) : undefined
        }
      >
        {isLoading || !appointment ? (
          <PageLoader />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Avatar name={appointment.patient?.full_name ?? '?'} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{appointment.patient?.full_name}</p>
                <p className="text-[13px] text-fg-muted">{appointment.patient?.mrn}</p>
              </div>
              <StatusBadge status={appointment.status} />
            </div>

            <DetailList
              items={[
                { label: t('appointments.time'), value: `${f.local(appointment.local_start, 'h:mm a')} – ${f.local(appointment.local_end, 'h:mm a')} (${appointment.duration_minutes} min)` },
                { label: t('appointments.practitioner'), value: appointment.practitioner?.name },
                { label: t('appointments.service'), value: appointment.service?.name ?? '—' },
                {
                  label: t('appointments.type'),
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      {appointment.type === 'home_visit' && <Home className="size-4 text-primary" />}
                      {t(`common:appointmentType.${appointment.type}`)}
                    </span>
                  ),
                },
                ...(appointment.type === 'home_visit'
                  ? [
                      { label: t('appointments.homeAddress'), value: appointment.home_visit_address },
                      { label: t('appointments.travelBuffer'), value: `${appointment.travel_buffer_minutes} min` },
                    ]
                  : [{ label: t('appointments.room'), value: appointment.room?.name ?? t('appointments.noRoom') }]),
                { label: t('appointments.notes'), value: appointment.notes || '—' },
                ...(appointment.cancellation_reason ? [{ label: t('appointments.cancelReason'), value: appointment.cancellation_reason }] : []),
                { label: '', value: <span className="text-xs text-fg-subtle">{t(`appointments.bookedVia.${appointment.booked_via}`)}</span> },
              ]}
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => navigate(`/patients/${appointment.patient?.id}`)}>
                <UserRound />
                {t('appointments.actions.openPatient')}
              </Button>
              {can('clinical.write') && ['checked_in', 'in_progress', 'completed'].includes(appointment.status) && (
                <Button variant="outline" onClick={() => navigate(`/patients/${appointment.patient?.id}?tab=notes&appointment=${appointment.id}`)}>
                  <NotebookPen />
                  {t('appointments.actions.writeNote')}
                </Button>
              )}
              {manage && ['scheduled', 'confirmed'].includes(appointment.status) && (
                <Button variant="outline" onClick={() => onReschedule(appointment)}>
                  <CalendarClock />
                  {t('appointments.reschedule')}
                </Button>
              )}
              {can('billing.manage') && appointment.status === 'completed' && (
                <Button variant="secondary" loading={invoice.isPending} onClick={() => invoice.mutate()}>
                  <ReceiptText />
                  {t('appointments.actions.invoice')}
                </Button>
              )}
              {can('clinical.view') && (
                <Button variant="ghost" onClick={() => navigate(`/patients/${appointment.patient?.id}?tab=plans`)}>
                  <FileText />
                  {t('patients.tabs.plans')}
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Dialog>
  );
}
