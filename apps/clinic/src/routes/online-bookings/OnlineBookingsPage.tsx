import { api, unwrap } from '@physio/api';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pagination,
  Segmented,
  Select,
  Skeleton,
  Textarea,
  toast,
  type BadgeTone,
} from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarDays, Check, Globe, MessageCircle, Phone, Share2, Stethoscope, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useStaff } from '../../lib/catalog';
import { errorMessage, toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';
import { BookingShareKit, bookingUrl } from '../settings/OnlineBookingSettings';

type Status = 'pending' | 'confirmed' | 'declined' | 'cancelled';

export interface OnlineBookingRow {
  id: number;
  reference: string;
  status: Status;
  source: string;
  starts_at: string;
  local_start: string;
  duration_minutes: number;
  name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  age: number | null;
  message: string | null;
  branch: { id: number; name: string };
  service: { id: number; name: string } | null;
  practitioner: { id: number; name: string; color: string } | null;
  patient: { id: number; full_name: string; mrn: string } | null;
  appointment_id: number | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

interface Page {
  data: OnlineBookingRow[];
  meta: { current_page: number; last_page: number; total: number; counts: Record<Status, number> };
}

const STATUS_TONE: Record<Status, BadgeTone> = { pending: 'warning', confirmed: 'success', declined: 'neutral', cancelled: 'neutral' };

function whatsApp(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export function OnlineBookingsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useUrlState('status', 'pending');
  const [page, setPage] = useUrlState('page', '1');
  const [sharing, setSharing] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['online-bookings', status, page],
    queryFn: async () => (await unwrap(api.GET('/online-bookings', { params: { query: { status, page: Number(page) } as never } }))) as unknown as Page,
    refetchInterval: 60_000,
  });
  const counts = data?.meta.counts;

  return (
    <div>
      <PageHeader
        title={t('onlineBooking.title')}
        description={t('onlineBooking.subtitle')}
        actions={<Button variant="outline" onClick={() => setSharing(true)}><Share2 />{t('onlineBooking.shareLink')}</Button>}
      />
      <div className="mb-4">
        <Segmented<string>
          label={t('onlineBooking.title')}
          value={status}
          onChange={setStatus}
          options={(['pending', 'confirmed', 'declined', 'all'] as const).map((s) => ({
            value: s,
            label: <span className="inline-flex items-center gap-1.5">{t(`onlineBooking.tabs.${s}`)}{s !== 'all' && counts && counts[s] > 0 && <span className="rounded-full bg-surface-3 px-1.5 text-[11px] tabular">{counts[s]}</span>}</span>,
          }))}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : !data?.data.length ? (
        <Card>
          <EmptyState
            icon={<Globe />}
            title={status === 'pending' ? t('onlineBooking.emptyPending') : t('onlineBooking.empty')}
            action={status === 'pending' ? <Button onClick={() => setSharing(true)}><Share2 />{t('onlineBooking.shareLink')}</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.data.map((b) => <RequestCard key={b.id} booking={b} />)}
          <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={(p) => setPage(String(p))} />
        </div>
      )}

      {sharing && (
        <Dialog open onOpenChange={(o) => !o && setSharing(false)}>
          <DialogContent size="lg" title={t('onlineBooking.share.title')}><BookingShareKit /></DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function RequestCard({ booking: b }: { booking: OnlineBookingRow }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { session } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);
  const when = f.local(b.local_start, 'EEE d MMM, h:mm a');

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={b.name} size={44} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold">{b.name}</p>
            <Badge tone={STATUS_TONE[b.status]}>{t(`onlineBooking.tabs.${b.status}`, { defaultValue: b.status })}</Badge>
            <Badge tone="info">{t(`onlineBooking.sources.${b.source}`, { defaultValue: b.source })}</Badge>
            <span className="text-xs text-fg-subtle">{b.reference}</span>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium"><CalendarDays className="size-4 text-primary" />{when}</span>
            {b.service && <span className="inline-flex items-center gap-1.5 text-fg-muted"><Stethoscope className="size-4" />{b.service.name} · {b.duration_minutes} min</span>}
            <span className="inline-flex items-center gap-1.5 text-fg-muted"><UserRound className="size-4" />{b.practitioner?.name ?? t('onlineBooking.anyTherapist')}</span>
            {session.branches.length > 1 && <span className="text-fg-muted">{b.branch.name}</span>}
          </p>
          <p className="text-[13px] text-fg-muted">
            {b.phone}{b.email && ` · ${b.email}`}{b.age && ` · ${t('onlineBooking.ageGender', { age: b.age })}`}{b.gender && ` · ${t(`staff.genders.${b.gender}`, { defaultValue: b.gender })}`}
          </p>
          {b.message && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">“{b.message}”</p>}
          <p className="text-xs text-fg-subtle">
            {t('onlineBooking.requested', { when: f.instant(b.created_at, 'd MMM, h:mm a') })}
            {b.decided_at && ` · ${t('onlineBooking.decidedBy', { status: t(`onlineBooking.tabs.${b.status}`), name: b.decided_by ?? 'Online', when: f.instant(b.decided_at, 'd MMM, h:mm a') })}`}
            {b.decision_note && ` · ${b.decision_note}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon-sm" asChild aria-label={`${t('staff.phone')} ${b.name}`}><a href={`tel:${b.phone}`}><Phone /></a></Button>
          <Button variant="ghost" size="icon-sm" asChild aria-label={`WhatsApp ${b.name}`}><a href={whatsApp(b.phone, '')} target="_blank" rel="noreferrer"><MessageCircle /></a></Button>
          {b.status === 'pending' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setDeclining(true)}><X />{t('onlineBooking.decline')}</Button>
              <Button size="sm" onClick={() => setConfirming(true)}><Check />{t('onlineBooking.confirm')}</Button>
            </>
          )}
          {b.status === 'confirmed' && b.patient && (
            <>
              <Button variant="outline" size="sm" asChild><Link to={`/patients/${b.patient.id}`}>{t('onlineBooking.viewPatient')}</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to={`/appointments?date=${b.local_start.slice(0, 10)}`}><CalendarCheck />{t('onlineBooking.viewCalendar')}</Link></Button>
            </>
          )}
        </div>
      </div>
      {confirming && <ConfirmDialog booking={b} onClose={() => setConfirming(false)} />}
      {declining && <DeclineDialog booking={b} onClose={() => setDeclining(false)} />}
    </Card>
  );
}

function ConfirmDialog({ booking: b, onClose }: { booking: OnlineBookingRow; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: practitioners } = useStaff({ practitionersOnly: true });
  const { data: matches } = useQuery({
    queryKey: ['online-bookings', b.id, 'matches'],
    queryFn: async () => ((await unwrap(api.GET('/online-bookings/{booking}/matches', { params: { path: { booking: b.id } } }))) as unknown as { data: { id: number; full_name: string; mrn: string }[] }).data,
  });
  const [choice, setPatientId] = useState<string>('auto');
  const patientId = choice === 'auto' && matches?.length ? String(matches[0]!.id) : choice;
  const [practitionerId, setPractitionerId] = useState(String(b.practitioner?.id ?? ''));
  const [localStart, setLocalStart] = useState(b.local_start);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<OnlineBookingRow | null>(null);

  const confirm = useMutation({
    mutationFn: () => unwrap(api.POST('/online-bookings/{booking}/confirm', {
      params: { path: { booking: b.id } },
      body: {
        patient_id: patientId === 'auto' || patientId === 'new' ? null : Number(patientId),
        new_patient: patientId === 'new',
        practitioner_id: practitionerId ? Number(practitionerId) : null,
        local_start: localStart !== b.local_start ? localStart : null,
      } as never,
    })),
    onSuccess: (r) => {
      toast.success(t('onlineBooking.confirmed', { name: b.name }));
      setDone((r as unknown as { data: OnlineBookingRow }).data);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  // Refresh the inbox only when the dialog closes, so the card (and this dialog) stay mounted.
  const close = () => {
    if (done) {
      void queryClient.invalidateQueries({ queryKey: ['online-bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
    onClose();
  };

  const confirmedText = done && t('onlineBooking.confirmationText', {
    name: b.name.split(' ')[0], clinic: session.tenant.name, when: f.local(done.local_start, 'EEE d MMM, h:mm a'), service: done.service?.name ?? '', ref: done.reference,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent
        title={t('onlineBooking.confirmTitle', { name: b.name })}
        footer={done ? (
          <>
            <Button variant="outline" asChild><a href={whatsApp(b.phone, confirmedText!)} target="_blank" rel="noreferrer"><MessageCircle />{t('onlineBooking.notifyWhatsApp')}</a></Button>
            <Button onClick={close}>{t('common:actions.done')}</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={close}>{t('common:actions.cancel')}</Button>
            <Button loading={confirm.isPending} onClick={() => confirm.mutate()}><Check />{t('onlineBooking.confirm')}</Button>
          </>
        )}
      >
        {done ? (
          <Alert tone="success" title={t('onlineBooking.confirmed', { name: done.patient?.full_name ?? b.name })}>{f.local(done.local_start, 'EEEE d MMMM, h:mm a')} · {done.practitioner?.name}</Alert>
        ) : (
          <div className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            {matches && matches.length > 0 && <Alert tone="info">{t('onlineBooking.matchesFound')}</Alert>}
            <Field label={t('onlineBooking.patientChoice')}>
              <Select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                {matches?.length ? null : <option value="auto">{t('onlineBooking.newPatient')}</option>}
                {matches?.map((m) => <option key={m.id} value={m.id}>{t('onlineBooking.existingPatient', { name: m.full_name, mrn: m.mrn })}</option>)}
                {matches?.length ? <option value="new">{t('onlineBooking.newPatient')}</option> : null}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onlineBooking.practitioner')}>
                <Select value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)}>
                  {practitioners?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label={t('onlineBooking.time')}><Input type="datetime-local" step={900} value={localStart} onChange={(e) => setLocalStart(e.target.value)} /></Field>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeclineDialog({ booking: b, onClose }: { booking: OnlineBookingRow; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const decline = useMutation({
    mutationFn: () => unwrap(api.POST('/online-bookings/{booking}/decline', { params: { path: { booking: b.id } }, body: { note: note || null } as never })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['online-bookings'] });
      toast.success(t('onlineBooking.declined'));
      onClose();
    },
    onError: toastError,
  });
  const text = t('onlineBooking.declineText', { name: b.name.split(' ')[0], clinic: session.tenant.name, when: f.local(b.local_start, 'EEE d MMM, h:mm a'), url: bookingUrl(session.tenant.slug, 'whatsapp') });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t('onlineBooking.declineTitle', { name: b.name })}
        footer={
          <>
            <Button variant="outline" asChild><a href={whatsApp(b.phone, text)} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></Button>
            <Button variant="danger" loading={decline.isPending} onClick={() => decline.mutate()}>{t('onlineBooking.decline')}</Button>
          </>
        }
      >
        <Field label={t('onlineBooking.declineNote')}><Textarea rows={3} maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </DialogContent>
    </Dialog>
  );
}
