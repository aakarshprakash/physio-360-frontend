import { api, unwrap, type Enquiry, type PatientSummary } from '@physio/api';
import { Alert, Avatar, Badge, Button, ConfirmDialog, DetailList, Dialog, DialogContent, Field, Input, PageLoader, Segmented, SheetContent, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, CheckCircle2, Mail, MessageCircle, NotebookPen, Pencil, Phone, RotateCcw, UserCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { StatusBadge } from '../../components/common';
import { errorMessage, toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { EnquiryFormDialog } from './EnquiryFormDialog';

type ActivityType = 'call' | 'whatsapp' | 'email' | 'note';
const ICONS = { call: Phone, whatsapp: MessageCircle, email: Mail, note: NotebookPen, sms: MessageCircle, visit: UserCheck, status_change: RotateCcw, follow_up: CalendarPlus, converted: CheckCircle2 } as const;

export function EnquiryDrawer({ enquiryId, onClose }: { enquiryId: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [type, setType] = useState<ActivityType>('call');
  const [body, setBody] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [lostReason, setLostReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['enquiry', enquiryId],
    queryFn: async () => (await unwrap(api.GET('/enquiries/{enquiry}', { params: { path: { enquiry: enquiryId! } } }))) as unknown as { data: Enquiry; matching_patients: PatientSummary[] },
    enabled: enquiryId !== null,
  });
  const enquiry = data?.data;
  const open = enquiry && ['new', 'contacted', 'follow_up'].includes(enquiry.status);

  const refresh = (e?: Enquiry) => {
    if (e) queryClient.setQueryData(['enquiry', enquiryId], (old: typeof data) => (old ? { ...old, data: e } : old));
    void queryClient.invalidateQueries({ queryKey: ['enquiries'] });
    void queryClient.invalidateQueries({ queryKey: ['enquiry', enquiryId] });
  };

  const log = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/enquiries/{enquiry}/activities', {
          params: { path: { enquiry: enquiryId! } },
          body: { type, body: body || null, next_follow_up_at: followUp ? new Date(followUp).toISOString() : null } as never,
        }),
      ),
    onSuccess: (r) => {
      toast.success(t('enquiries.logged'));
      setBody('');
      setFollowUp('');
      refresh((r as unknown as { data: Enquiry }).data);
    },
    onError: toastError,
  });

  const transition = useMutation({
    mutationFn: (vars: { status: string; reason?: string }) => unwrap(api.POST('/enquiries/{enquiry}/status', { params: { path: { enquiry: enquiryId! } }, body: vars as never })),
    onSuccess: (r) => refresh((r as unknown as { data: Enquiry }).data),
    onError: toastError,
  });

  return (
    <Dialog open={enquiryId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={enquiry?.name ?? t('enquiries.title')} description={enquiry ? `${t(`enquiries.sources.${enquiry.source}`)} · ${f.instant(enquiry.created_at)}` : undefined} className="max-w-xl">
        {isLoading || !enquiry ? (
          <PageLoader />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={enquiry.name} size={44} />
              <div className="min-w-0 flex-1">
                <a href={`tel:${enquiry.phone}`} dir="ltr" className="tabular block font-semibold hover:text-primary">{enquiry.phone}</a>
                {enquiry.email && <a href={`mailto:${enquiry.email}`} className="block text-sm text-fg-muted hover:text-primary">{enquiry.email}</a>}
              </div>
              <StatusBadge status={enquiry.status} />
              {enquiry.status !== 'converted' && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={t('common:actions.edit')}>
                  <Pencil />
                </Button>
              )}
            </div>

            {open && (data?.matching_patients?.length ?? 0) > 0 && (
              <Alert tone="warning" title={t('enquiries.duplicateWarning')}>
                {data!.matching_patients.map((p) => `${p.full_name} (${p.mrn})`).join(', ')}
              </Alert>
            )}

            {enquiry.status === 'converted' && enquiry.converted_patient && (
              <Alert tone="success" title={t('enquiries.converted')}>
                <ConvertedActions patientId={enquiry.converted_patient.id} name={enquiry.converted_patient.full_name} mrn={enquiry.converted_patient.mrn} />
              </Alert>
            )}

            <DetailList
              items={[
                { label: t('enquiries.interest'), value: enquiry.interest ?? '—' },
                { label: t('enquiries.service'), value: enquiry.service?.name ?? '—' },
                { label: t('enquiries.message'), value: enquiry.message ? <span className="whitespace-pre-line">{enquiry.message}</span> : '—' },
                { label: t('enquiries.preferredTime'), value: enquiry.preferred_contact_time ?? '—' },
                { label: t('enquiries.assignedTo'), value: enquiry.assignee?.name ?? t('enquiries.unassigned') },
                {
                  label: t('enquiries.nextFollowUp'),
                  value: enquiry.next_follow_up_at ? <span className={enquiry.is_overdue ? 'font-semibold text-danger' : ''}>{f.instant(enquiry.next_follow_up_at)}</span> : '—',
                },
                { label: t('enquiries.lastContacted'), value: f.instant(enquiry.last_contacted_at) },
                ...(enquiry.lost_reason ? [{ label: t('enquiries.lostReason'), value: enquiry.lost_reason }] : []),
              ]}
            />

            {open && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setConverting(true)}>
                  <UserCheck />
                  {t('enquiries.convert')}
                </Button>
                <ConfirmDialog
                  tone="danger"
                  title={t('enquiries.markLost')}
                  confirmLabel={t('enquiries.markLost')}
                  cancelLabel={t('common:actions.cancel')}
                  onConfirm={() => transition.mutateAsync({ status: 'lost', reason: lostReason || 'Not interested' })}
                  trigger={<Button variant="danger-ghost"><XCircle />{t('enquiries.markLost')}</Button>}
                >
                  <Field label={t('enquiries.lostReason')}>
                    <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
                  </Field>
                </ConfirmDialog>
              </div>
            )}
            {enquiry.status === 'lost' && (
              <Button variant="outline" loading={transition.isPending} onClick={() => transition.mutate({ status: 'new' })}>
                <RotateCcw />
                {t('enquiries.reopen')}
              </Button>
            )}

            {open && (
              <section className="space-y-3 rounded-xl border border-border bg-surface-2 p-4">
                <h3 className="text-sm font-semibold">{t('enquiries.logTitle')}</h3>
                <Segmented<ActivityType>
                  label={t('enquiries.logTitle')}
                  value={type}
                  onChange={setType}
                  options={(['call', 'whatsapp', 'email', 'note'] as const).map((x) => ({ value: x, label: t(`enquiries.activityTypes.${x}`) }))}
                />
                <Textarea rows={2} aria-label={t('enquiries.outcome')} placeholder={t('enquiries.outcome')} value={body} onChange={(e) => setBody(e.target.value)} />
                <Field label={t('enquiries.scheduleFollowUp')}>
                  <Input type="datetime-local" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
                </Field>
                <div className="flex justify-end">
                  <Button size="sm" loading={log.isPending} disabled={type === 'note' && !body.trim()} onClick={() => log.mutate()}>
                    {t('enquiries.log')}
                  </Button>
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-3 text-sm font-semibold">{t('enquiries.timeline')}</h3>
              <ol className="relative space-y-4 border-s border-border ps-5">
                {enquiry.activities?.map((a) => {
                  const Icon = ICONS[a.type as keyof typeof ICONS] ?? NotebookPen;
                  const meta = (a.meta ?? {}) as { from?: string; to?: string; at?: string };
                  return (
                    <li key={a.id} className="relative">
                      <span className="absolute -start-[31px] top-0 grid size-6 place-items-center rounded-full border border-border bg-surface text-fg-muted">
                        <Icon className="size-3.5" />
                      </span>
                      <p className="text-sm">
                        <span className="font-medium">{t(`enquiries.activityTypes.${a.type}`, { defaultValue: a.type })}</span>
                        {a.type === 'status_change' && meta.to && (
                          <> · <Badge className="ms-1">{t(`common:status.${meta.to}`, { defaultValue: meta.to })}</Badge></>
                        )}
                        {a.type === 'follow_up' && meta.at && <span className="text-fg-muted"> · {f.instant(meta.at)}</span>}
                      </p>
                      {a.body && a.type !== 'follow_up' && <p className="mt-0.5 whitespace-pre-line text-sm text-fg-muted">{a.body}</p>}
                      <p className="mt-0.5 text-xs text-fg-subtle">{a.user ?? t('enquiries.websiteForm')} · {f.instant(a.created_at)}</p>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
        )}
      </SheetContent>
      {editing && enquiry && <EnquiryFormDialog enquiry={enquiry} onClose={() => setEditing(false)} onSaved={(e) => { setEditing(false); refresh(e); }} />}
      {converting && enquiry && (
        <ConvertDialog
          enquiry={enquiry}
          matches={data?.matching_patients ?? []}
          onClose={() => setConverting(false)}
          onDone={(e) => {
            setConverting(false);
            refresh(e);
          }}
        />
      )}
    </Dialog>
  );
}

function ConvertedActions({ patientId, name, mrn }: { patientId: number; name: string; mrn: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="me-auto">{name} · {mrn}</span>
      <Button size="sm" variant="outline" onClick={() => navigate(`/patients/${patientId}`)}>{t('enquiries.viewPatient')}</Button>
      <Button size="sm" onClick={() => navigate(`/patients/${patientId}?book=1`)}>
        <CalendarPlus />
        {t('enquiries.bookFirst')}
      </Button>
    </div>
  );
}

function ConvertDialog({ enquiry, matches, onClose, onDone }: { enquiry: Enquiry; matches: PatientSummary[]; onClose: () => void; onDone: (e: Enquiry) => void }) {
  const { t } = useTranslation();
  const [first, ...rest] = enquiry.name.split(' ');
  const [form, setForm] = useState({ first_name: first, last_name: rest.join(' '), date_of_birth: '', gender: '' });
  const [existing, setExisting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const convert = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/enquiries/{enquiry}/convert', {
          params: { path: { enquiry: enquiry.id } },
          body: (existing ? { existing_patient_id: existing } : { ...form, date_of_birth: form.date_of_birth || null, gender: form.gender || null }) as never,
        }),
      ),
    onSuccess: (r) => {
      toast.success(t('enquiries.converted'));
      onDone((r as unknown as { data: Enquiry }).data);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t('enquiries.convertTitle')}
        description={t('enquiries.convertHelp')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={convert.isPending} onClick={() => convert.mutate()}>{t('enquiries.convert')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          {matches.length > 0 && (
            <fieldset className="space-y-2 rounded-lg border border-warning/40 bg-warning-soft/40 p-3">
              <legend className="px-1 text-[13px] font-semibold">{t('enquiries.convertExisting')}</legend>
              {matches.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" name="existing" checked={existing === m.id} onChange={() => setExisting(m.id)} />
                  {m.full_name} · {m.mrn}
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="existing" checked={existing === null} onChange={() => setExisting(null)} />
                {t('patients.new')}
              </label>
            </fieldset>
          )}
          {existing === null && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('patients.firstName')} required>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </Field>
              <Field label={t('patients.lastName')}>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </Field>
              <Field label={t('patients.dob')}>
                <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
              </Field>
              <Field label={t('patients.gender')}>
                <select className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">—</option>
                  {['male', 'female', 'other', 'undisclosed'].map((g) => <option key={g} value={g}>{t(`common:gender.${g}`)}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
