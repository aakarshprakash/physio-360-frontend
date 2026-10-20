import { api, unwrap, type Patient } from '@physio/api';
import { Alert, Badge, Button, Card, CardContent, CardHeader, ConfirmDialog, DetailList, Dialog, DialogContent, Field, Input, Select, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, ShieldCheck, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePayers } from '../../../lib/catalog';
import { handleFormError, toastError } from '../../../lib/errors';
import { useFormat } from '../../../lib/format';
import { useSession } from '../../../lib/session';

interface Policy {
  id: number;
  payer: { id: number; name: string; type: string };
  policy_number: string;
  member_id: string | null;
  valid_to: string | null;
  coverage_percent: number;
  is_primary: boolean;
}

export function OverviewTab({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { can, session } = useSession();
  const branch = session.branches.find((b) => b.id === patient.primary_branch_id);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
      <div className="space-y-5">
        <Card>
          <CardHeader title={t('patients.sections.personal')} />
          <CardContent>
            <DetailList
              items={[
                { label: t('patients.dob'), value: patient.date_of_birth ? f.local(patient.date_of_birth, 'd MMM yyyy') : '—' },
                { label: t('patients.gender'), value: patient.gender ? t(`common:gender.${patient.gender}`) : '—' },
                { label: t('patients.phone'), value: <span dir="ltr">{patient.phone}</span> },
                { label: t('patients.email'), value: patient.email || '—' },
                { label: t('patients.address'), value: (patient.city && patient.address && !patient.address.includes(patient.city) ? `${patient.address}, ${patient.city}` : (patient.address ?? patient.city)) || '—' },
                { label: t('patients.occupation'), value: patient.occupation || '—' },
                { label: t('patients.referredBy'), value: patient.referred_by || '—' },
                { label: t('patients.emergencyName'), value: [patient.emergency_contact_name, patient.emergency_contact_phone].filter(Boolean).join(' · ') || '—' },
                { label: t('patients.branch'), value: branch?.name ?? '—' },
                { label: t('patients.primaryPractitioner'), value: patient.primary_practitioner?.name ?? '—' },
                { label: t('patients.created'), value: f.instant(patient.created_at, 'd MMM yyyy') },
              ]}
            />
          </CardContent>
        </Card>

        {can('clinical.view') && (
          <Card>
            <CardHeader title={t('patients.sections.clinical')} />
            <CardContent>
              <DetailList
                items={[
                  { label: t('patients.medicalHistory'), value: <span className="whitespace-pre-line">{(patient.medical_history as string) || '—'}</span> },
                  { label: t('patients.allergies'), value: (patient.allergies as string) || '—' },
                  { label: t('patients.notes'), value: patient.notes || '—' },
                ]}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-5">
        <PortalCard patient={patient} />
        <InsuranceCard patient={patient} />
      </div>
    </div>
  );
}

function PortalCard({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const [link, setLink] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () => unwrap(api.POST('/patients/{patient}/portal-invite', { params: { path: { patient: patient.id } } })),
    onSuccess: (r) => {
      setLink((r as unknown as { data: { activation_url: string } }).data.activation_url);
      void queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
    },
    onError: toastError,
  });

  const disable = useMutation({
    mutationFn: () => unwrap(api.POST('/patients/{patient}/portal-disable', { params: { path: { patient: patient.id } } })),
    onSuccess: () => {
      setLink(null);
      void queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
    },
    onError: toastError,
  });

  return (
    <Card>
      <CardHeader title={t('patients.portal.title')} />
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-soft-fg">
            <Smartphone className="size-5" />
          </span>
          <p className="text-sm">{patient.portal_enabled ? t('patients.portal.enabled') : t('patients.portal.disabled')}</p>
        </div>
        {link && (
          <Alert tone="success" title={t('patients.portal.linkReady')}>
            <div className="mt-2 flex gap-2">
              <Input readOnly value={link} className="h-9 text-xs" aria-label={t('patients.portal.linkReady')} onFocus={(e) => e.currentTarget.select()} />
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  toast.success(t('patients.portal.copied'));
                }}
              >
                <Copy />
                {t('patients.portal.copy')}
              </Button>
            </div>
          </Alert>
        )}
        {can('patients.manage') && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={patient.portal_enabled ? 'outline' : 'primary'} loading={invite.isPending} onClick={() => invite.mutate()}>
              {patient.portal_enabled ? t('patients.portal.reinvite') : t('patients.portal.invite')}
            </Button>
            {patient.portal_enabled && (
              <ConfirmDialog
                tone="danger"
                title={t('patients.portal.disable')}
                confirmLabel={t('patients.portal.disable')}
                cancelLabel={t('common:actions.cancel')}
                onConfirm={() => disable.mutateAsync()}
                trigger={
                  <Button size="sm" variant="danger-ghost">
                    {t('patients.portal.disable')}
                  </Button>
                }
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsuranceCard({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useSession();
  const [adding, setAdding] = useState(false);

  const { data: policies } = useQuery({
    queryKey: ['patient', patient.id, 'insurance'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/insurance-policies', { params: { path: { patient: patient.id } } })) as unknown as { data: Policy[] }).data,
  });

  return (
    <Card>
      <CardHeader
        title={t('patients.insurance.title')}
        action={
          can('patients.manage') && (
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
              <Plus />
              {t('patients.insurance.add')}
            </Button>
          )
        }
      />
      <CardContent>
        {!policies?.length ? (
          <p className="text-sm text-fg-muted">{t('patients.insurance.none')}</p>
        ) : (
          <ul className="space-y-3">
            {policies.map((p) => (
              <li key={p.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">
                    {p.payer.name} {p.is_primary && <Badge tone="primary">Primary</Badge>}
                  </p>
                  <p className="text-fg-muted">
                    {p.policy_number}
                    {p.member_id && ` · ${p.member_id}`} · {p.coverage_percent}%
                  </p>
                  {p.valid_to && <p className="text-xs text-fg-subtle">{t('patients.insurance.validTo')}: {f.local(p.valid_to)}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {adding && <PolicyDialog patientId={patient.id} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function PolicyDialog({ patientId, onClose }: { patientId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: payers } = usePayers();
  const [form, setForm] = useState({ insurance_payer_id: '', policy_number: '', member_id: '', valid_to: '', coverage_percent: 100 });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/patients/{patient}/insurance-policies', {
          params: { path: { patient: patientId } },
          body: { ...form, insurance_payer_id: Number(form.insurance_payer_id), valid_to: form.valid_to || null, member_id: form.member_id || null } as never,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient', patientId, 'insurance'] });
      onClose();
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t('patients.insurance.add')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common:actions.save')}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('patients.insurance.payer')} required error={errors.insurance_payer_id} className="sm:col-span-2">
            <Select value={form.insurance_payer_id} onChange={(e) => setForm({ ...form, insurance_payer_id: e.target.value })}>
              <option value="">—</option>
              {payers?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('patients.insurance.policy')} required error={errors.policy_number}>
            <Input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} />
          </Field>
          <Field label={t('patients.insurance.member')}>
            <Input value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} />
          </Field>
          <Field label={t('patients.insurance.coverage')}>
            <Input type="number" min={0} max={100} value={form.coverage_percent} onChange={(e) => setForm({ ...form, coverage_percent: Number(e.target.value) })} />
          </Field>
          <Field label={t('patients.insurance.validTo')}>
            <Input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
