import { api, unwrap, type Invoice } from '@physio/api';
import { taxFor } from '@physio/core';
import { Alert, Button, Dialog, DialogContent, Field, Input, Segmented, Select, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Stethoscope, Trash2, Type } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { MoneyInput, PatientPicker } from '../../components/common';
import { usePackagePlans, useServices } from '../../lib/catalog';
import { errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useDefaultBranchId, useSession } from '../../lib/session';

interface Line {
  key: string;
  service_id?: number | null;
  package_plan_id?: number | null;
  appointment_id?: number | null;
  description: string;
  quantity: number;
  unit_price_minor: number | null;
  discount_minor: number | null;
  tax_percent: string; // e.g. "18" or "5"
}

let seq = 0;
const newKey = () => `l${++seq}`;

interface Props {
  invoice?: Invoice; // edit an existing draft
  patientId?: number;
  onClose: () => void;
}

export function InvoiceEditor({ invoice, patientId, onClose }: Props) {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const defaultBranch = useDefaultBranchId();
  const { data: services } = useServices();
  const { data: plans } = usePackagePlans();

  const preset = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}', { params: { path: { patient: patientId! } } }))).data,
    enabled: !!patientId && !invoice,
  });

  const [patient, setPatient] = useState<{ id: number; full_name: string; mrn?: string } | null>(invoice?.patient ?? null);
  const effectivePatient = patient ?? (preset.data ? { id: preset.data.id, full_name: preset.data.full_name, mrn: preset.data.mrn } : null);
  const [branchId, setBranchId] = useState(invoice?.branch_id ?? defaultBranch);
  const [payerType, setPayerType] = useState<'self' | 'insurance'>((invoice?.payer_type as 'self' | 'insurance') ?? 'self');
  const [policyId, setPolicyId] = useState<number | ''>(invoice?.insurance_policy_id ?? '');
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? '');
  const [notes, setNotes] = useState(invoice?.notes ?? '');
  const [lines, setLines] = useState<Line[]>(
    invoice?.items?.map((i) => ({
      key: newKey(),
      service_id: i.service_id,
      package_plan_id: i.package_plan_id,
      appointment_id: i.appointment_id,
      description: i.description,
      quantity: i.quantity,
      unit_price_minor: i.unit_price_minor,
      discount_minor: i.discount_minor,
      tax_percent: String(i.tax_rate_bp / 100),
    })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  const { data: policies } = useQuery({
    queryKey: ['patient', effectivePatient?.id, 'insurance'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/insurance-policies', { params: { path: { patient: effectivePatient!.id } } })) as unknown as { data: { id: number; payer: { name: string }; policy_number: string }[] }).data,
    enabled: !!effectivePatient && payerType === 'insurance',
  });

  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addService = (id: number) => {
    const s = services?.find((x) => x.id === id);
    if (s) setLines((ls) => [...ls, { key: newKey(), service_id: s.id, description: s.name, quantity: 1, unit_price_minor: s.price_minor, discount_minor: 0, tax_percent: String(s.tax_rate_bp / 100) }]);
  };
  const addPlan = (id: number) => {
    const p = plans?.find((x) => x.id === id);
    if (p) setLines((ls) => [...ls, { key: newKey(), package_plan_id: p.id, description: p.name, quantity: 1, unit_price_minor: p.price_minor, discount_minor: 0, tax_percent: '0' }]);
  };

  const computed = lines.map((l) => {
    const gross = (l.unit_price_minor ?? 0) * (l.quantity || 0);
    const net = gross - (l.discount_minor ?? 0);
    const bp = Math.round(Number(l.tax_percent || 0) * 100);
    const tax = taxFor(Math.max(net, 0), bp);
    return { gross, discount: l.discount_minor ?? 0, tax, total: net + tax, bp };
  });
  const totals = computed.reduce((a, c) => ({ subtotal: a.subtotal + c.gross, discount: a.discount + c.discount, tax: a.tax + c.tax, total: a.total + c.total }), { subtotal: 0, discount: 0, tax: 0, total: 0 });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        patient_id: effectivePatient?.id,
        branch_id: branchId,
        payer_type: payerType,
        insurance_policy_id: payerType === 'insurance' && policyId ? Number(policyId) : null,
        due_date: dueDate || null,
        notes: notes || null,
        items: lines.map((l, i) => ({
          service_id: l.service_id ?? null,
          package_plan_id: l.package_plan_id ?? null,
          appointment_id: l.appointment_id ?? null,
          description: l.description,
          quantity: l.quantity,
          unit_price_minor: l.unit_price_minor ?? 0,
          discount_minor: l.discount_minor ?? 0,
          tax_rate_bp: computed[i].bp,
        })),
      };
      return invoice
        ? unwrap(api.PUT('/invoices/{invoice}', { params: { path: { invoice: invoice.id } }, body: body as never }))
        : unwrap(api.POST('/invoices', { body: body as never }));
    },
    onSuccess: (r) => {
      const saved = (r as unknown as { data: Invoice }).data;
      toast.success(t('billing.saveDraft'));
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.setQueryData(['invoice', saved.id], saved);
      onClose();
      navigate(`/billing/invoices/${saved.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const canSave = !!effectivePatient && lines.length > 0 && lines.every((l) => l.description.trim() && l.unit_price_minor !== null && l.quantity > 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="xl"
        title={invoice ? t('billing.editInvoice') : t('billing.newInvoice')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button disabled={!canSave} loading={save.isPending} onClick={() => save.mutate()}>{t('billing.saveDraft')}</Button>
          </>
        }
      >
        <div className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <Field label={t('billing.patient')} required>
              <PatientPicker value={effectivePatient} onChange={(p) => setPatient(p)} />
            </Field>
            <div className="grid gap-4">
              {session.branches.length > 1 && (
                <Field label={t('nav.branch')}>
                  <Select value={branchId} onChange={(e) => setBranchId(Number(e.target.value))}>
                    {session.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                </Field>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-medium">{t('billing.payer')}</span>
                <Segmented<'self' | 'insurance'> label={t('billing.payer')} value={payerType} onChange={setPayerType} options={[{ value: 'self', label: t('billing.payerSelf') }, { value: 'insurance', label: t('billing.payerInsurance') }]} />
              </div>
              {payerType === 'insurance' && (
                <Field label={t('billing.policy')} required>
                  <Select value={policyId} onChange={(e) => setPolicyId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">—</option>
                    {policies?.map((p) => <option key={p.id} value={p.id}>{p.payer.name} · {p.policy_number}</option>)}
                  </Select>
                </Field>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{t('billing.items')}</h3>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Stethoscope aria-hidden className="pointer-events-none absolute start-2.5 top-1/2 z-[1] size-4 -translate-y-1/2 text-fg-subtle" />
                  <Select aria-label={t('billing.addService')} className="h-9 w-48 ps-8 text-[13px]" value="" onChange={(e) => e.target.value && addService(Number(e.target.value))}>
                    <option value="">{t('billing.addService')}</option>
                    {services?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
                <div className="relative">
                  <Package aria-hidden className="pointer-events-none absolute start-2.5 top-1/2 z-[1] size-4 -translate-y-1/2 text-fg-subtle" />
                  <Select aria-label={t('billing.addPackage')} className="h-9 w-48 ps-8 text-[13px]" value="" onChange={(e) => e.target.value && addPlan(Number(e.target.value))}>
                    <option value="">{t('billing.addPackage')}</option>
                    {plans?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </div>
                <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { key: newKey(), description: '', quantity: 1, unit_price_minor: null, discount_minor: 0, tax_percent: '0' }])}>
                  <Type />
                  {t('billing.addCustom')}
                </Button>
              </div>
            </div>

            {lines.length === 0 ? (
              <button type="button" onClick={() => services?.[0] && addService(services[0].id)} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong py-8 text-sm text-fg-muted hover:border-primary hover:text-primary">
                <Plus className="size-4" />
                {t('billing.addService')}
              </button>
            ) : (
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={l.key} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-border bg-surface-2 p-3 md:grid-cols-[2fr_70px_1fr_1fr_80px_1fr_auto]">
                    <Field label={t('billing.description')} className="col-span-2 md:col-span-1">
                      <Input value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} />
                    </Field>
                    <Field label={t('billing.qty')}>
                      <Input type="number" min={1} value={l.quantity} onChange={(e) => update(l.key, { quantity: Number(e.target.value) })} />
                    </Field>
                    <Field label={t('billing.unitPrice')}>
                      <MoneyInput value={l.unit_price_minor} onChange={(v) => update(l.key, { unit_price_minor: v })} />
                    </Field>
                    <Field label={t('billing.discount')}>
                      <MoneyInput value={l.discount_minor} onChange={(v) => update(l.key, { discount_minor: v })} />
                    </Field>
                    <Field label={t('billing.tax')}>
                      <Input inputMode="decimal" value={l.tax_percent} onChange={(e) => /^\d{0,3}(\.\d{0,2})?$/.test(e.target.value) && update(l.key, { tax_percent: e.target.value })} />
                    </Field>
                    <div className="pb-2.5 text-end">
                      <span className="block text-[11px] text-fg-subtle">{t('billing.amount')}</span>
                      <span className="tabular text-sm font-semibold">{f.money(computed[i].total)}</span>
                    </div>
                    <Button variant="ghost" size="icon" aria-label={t('common:actions.delete')} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-[1fr_300px]">
            <div className="grid gap-4">
              <Field label={t('billing.dueDate')} className="max-w-52">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              <Field label={t('billing.notes')}>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            <dl className="space-y-1.5 rounded-xl bg-surface-2 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-fg-muted">{t('billing.subtotal')}</dt><dd className="tabular">{f.money(totals.subtotal)}</dd></div>
              {totals.discount > 0 && <div className="flex justify-between"><dt className="text-fg-muted">{t('billing.discount')}</dt><dd className="tabular">− {f.money(totals.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-fg-muted">{t('billing.taxTotal')}</dt><dd className="tabular">{f.money(totals.tax)}</dd></div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><dt>{t('billing.grandTotal')}</dt><dd className="tabular">{f.money(totals.total)}</dd></div>
            </dl>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
