import { api, unwrap, type Branch, type ConsentTemplate, type InsurancePayer, type LeaveType, type PackagePlan, type Service, type Tenant } from '@physio/api';
import { SUPPORTED_LANGUAGES } from '@physio/core';
import { Alert, Badge, Button, Card, CardContent, CardHeader, Checkbox, cn, Dialog, DialogContent, Field, Input, Label, PageHeader, Select, Switch, Table, Td, Textarea, Th, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarOff, CreditCard, FileSignature, FileText, Globe, Layers, LocateFixed, MapPin, MessageCircle, Package, Plus, ShieldCheck, Smartphone, Stethoscope, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { MoneyInput } from '../../components/common';
import { usePackagePlans, usePayers, useServices } from '../../lib/catalog';
import { errorMessage, toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';
import { InvoiceSection } from './InvoiceSettings';
import { OnlineBookingSection } from './OnlineBookingSettings';

const SECTIONS = [
  { key: 'clinic', icon: Building2 },
  { key: 'branches', icon: Layers },
  { key: 'services', icon: Stethoscope },
  { key: 'booking', icon: Globe },
  { key: 'invoice', icon: FileText },
  { key: 'packages', icon: Package },
  { key: 'payers', icon: ShieldCheck },
  { key: 'consents', icon: FileSignature },
  { key: 'payments', icon: CreditCard },
  { key: 'messaging', icon: MessageCircle },
  { key: 'hr', icon: CalendarOff },
  { key: 'portal', icon: Smartphone },
] as const;

const SECTION_COMPONENTS: Record<string, () => ReactNode> = {
  branches: () => <BranchesSection />,
  services: () => <ServicesSection />,
  booking: () => <OnlineBookingSection />,
  invoice: () => <InvoiceSection />,
  packages: () => <PackagesSection />,
  payers: () => <PayersSection />,
  consents: () => <ConsentsSection />,
  payments: () => <PaymentsSection />,
  messaging: () => <MessagingSection />,
  hr: () => <HrSection />,
  portal: () => <PortalSection />,
};

export function SettingsPage() {
  const { t } = useTranslation();
  const [section, setSection] = useUrlState('section', 'clinic');

  return (
    <div>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <nav aria-label={t('settings.title')} className="flex gap-1 overflow-x-auto lg:flex-col">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-current={section === s.key ? 'page' : undefined}
              onClick={() => setSection(s.key)}
              className={cn('flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm font-medium', section === s.key ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:bg-surface-3 hover:text-fg')}
            >
              <s.icon className="size-4" />
              {t(`settings.${s.key}`)}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {(SECTION_COMPONENTS[section] ?? (() => <ClinicSection />))()}
        </div>
      </div>
    </div>
  );
}

function useClinic() {
  return useQuery({ queryKey: ['clinic'], queryFn: async () => (await unwrap(api.GET('/settings/clinic'))).data as Tenant });
}

function useSaveClinic() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { refresh } = useSession();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => unwrap(api.PUT('/settings/clinic', { body: body as never })),
    onSuccess: (r) => {
      queryClient.setQueryData(['clinic'], (r as unknown as { data: Tenant }).data);
      void refresh();
      toast.success(t('settings.saved'));
    },
    onError: toastError,
  });
}

function ClinicSection() {
  const { t } = useTranslation();
  const { data: clinic } = useClinic();
  const save = useSaveClinic();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const values = form ?? (clinic ? { name: clinic.name, legal_name: clinic.legal_name ?? '', email: clinic.email ?? '', phone: clinic.phone ?? '', tax_number: clinic.tax_number ?? '', address: clinic.address ?? '', timezone: clinic.timezone, locale: clinic.locale } : null);
  if (!values || !clinic) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...values, [k]: e.target.value });

  return (
    <Card>
      <CardHeader title={t('settings.clinic')} />
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label={t('settings.clinicName')} required><Input value={values.name} onChange={set('name')} /></Field>
        <Field label={t('settings.legalName')}><Input value={values.legal_name} onChange={set('legal_name')} /></Field>
        <Field label={t('patients.email')}><Input type="email" value={values.email} onChange={set('email')} /></Field>
        <Field label={t('patients.phone')}><Input value={values.phone} onChange={set('phone')} /></Field>
        <Field label={t('settings.taxNumber')}><Input value={values.tax_number} onChange={set('tax_number')} /></Field>
        <Field label={t('settings.currency')}><Input value={`${clinic.currency.code} (${clinic.currency.exponent} decimals)`} disabled /></Field>
        <Field label={t('settings.timezone')}>
          <Select value={values.timezone} onChange={set('timezone')}>
            {['Asia/Kolkata', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Bahrain', 'Asia/Muscat', 'UTC'].map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </Select>
        </Field>
        <Field label={t('settings.defaultLanguage')}>
          <Select value={values.locale} onChange={set('locale')}>{SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</Select>
        </Field>
        <Field label={t('settings.address')} className="sm:col-span-2"><Textarea rows={2} value={values.address} onChange={set('address')} /></Field>
        <div className="flex justify-end sm:col-span-2">
          <Button loading={save.isPending} onClick={() => save.mutate(values)}>{t('common:actions.saveChanges')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** A small reusable "table + add/edit dialog" for catalog entities. */
function CatalogSection<T extends { id: number; is_active?: boolean }>({
  title, rows, columns, renderForm, onSave, initial, addLabel,
}: {
  title: string;
  rows: T[] | undefined;
  columns: { label: string; render: (row: T) => ReactNode; className?: string }[];
  renderForm: (value: Record<string, unknown>, set: (patch: Record<string, unknown>) => void) => ReactNode;
  onSave: (value: Record<string, unknown>, existing?: T) => Promise<unknown>;
  initial: (row?: T) => Record<string, unknown>;
  addLabel: string;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<{ row?: T; value: Record<string, unknown> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title={title} action={<Button size="sm" onClick={() => setEditing({ value: initial() })}><Plus />{addLabel}</Button>} />
      <Table>
        <thead><tr>{columns.map((c) => <Th key={c.label} className={c.className}>{c.label}</Th>)}<Th /></tr></thead>
        <tbody>
          {rows?.map((row) => (
            <tr key={row.id} className={row.is_active === false ? 'opacity-55' : ''}>
              {columns.map((c) => <Td key={c.label} className={c.className}>{c.render(row)}</Td>)}
              <Td className="text-end"><Button size="sm" variant="ghost" onClick={() => setEditing({ row, value: initial(row) })}>{t('common:actions.edit')}</Button></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent
            title={editing.row ? t('common:actions.edit') : addLabel}
            footer={
              <>
                <Button variant="outline" onClick={() => setEditing(null)}>{t('common:actions.cancel')}</Button>
                <Button
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await onSave(editing.value, editing.row);
                      toast.success(t('settings.saved'));
                      setEditing(null);
                    } catch (e) {
                      setError(errorMessage(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t('common:actions.save')}
                </Button>
              </>
            }
          >
            {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">{renderForm(editing.value, (patch) => setEditing({ ...editing, value: { ...editing.value, ...patch } }))}</div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

/** Branch location for geofenced clock-in: type coordinates or use this device's location. */
function GeoFields({ value: v, set }: { value: Record<string, unknown>; set: (p: Record<string, unknown>) => void }) {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) return void toast.error(t('settings.noGeolocation'));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); set({ latitude: pos.coords.latitude.toFixed(7), longitude: pos.coords.longitude.toFixed(7) }); },
      () => { setLocating(false); toast.error(t('settings.noGeolocation')); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  const has = v.latitude !== '' && v.longitude !== '';
  return (
    <fieldset className="grid gap-3 rounded-lg border border-border p-3 sm:col-span-2 sm:grid-cols-3">
      <legend className="px-1 text-[13px] font-medium">{t('settings.geofence')}</legend>
      <p className="text-xs text-fg-muted sm:col-span-3">{t('settings.geofenceBranchHelp')}</p>
      <Field label={t('settings.latitude')}><Input inputMode="decimal" value={v.latitude as string} onChange={(e) => set({ latitude: e.target.value })} placeholder="9.9658" /></Field>
      <Field label={t('settings.longitude')}><Input inputMode="decimal" value={v.longitude as string} onChange={(e) => set({ longitude: e.target.value })} placeholder="76.2875" /></Field>
      <Field label={t('settings.radius')}><Input type="number" min={25} max={5000} step={25} value={v.geofence_radius_m as number} onChange={(e) => set({ geofence_radius_m: Number(e.target.value) })} /></Field>
      <div className="flex flex-wrap gap-2 sm:col-span-3">
        <Button size="sm" variant="outline" loading={locating} onClick={locate}><LocateFixed />{t('settings.useMyLocation')}</Button>
        {has && <Button size="sm" variant="ghost" asChild><a href={`https://www.google.com/maps?q=${String(v.latitude)},${String(v.longitude)}`} target="_blank" rel="noreferrer"><MapPin />{t('settings.viewOnMap')}</a></Button>}
      </div>
    </fieldset>
  );
}

const ActiveSwitch = ({ value, set }: { value: Record<string, unknown>; set: (p: Record<string, unknown>) => void }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 sm:col-span-2">
      <Switch id="active" checked={value.is_active as boolean} onCheckedChange={(v) => set({ is_active: v })} />
      <Label htmlFor="active">{t('settings.active')}</Label>
    </div>
  );
};

function BranchesSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { refresh } = useSession();
  const { data } = useQuery({ queryKey: ['branches'], queryFn: async () => (await unwrap(api.GET('/settings/branches'))).data as Branch[] });

  return (
    <CatalogSection<Branch>
      title={t('settings.branches')}
      addLabel={t('settings.addBranch')}
      rows={data}
      columns={[
        { label: t('settings.branchName'), render: (b) => <span className="font-medium">{b.name}</span> },
        { label: 'Code', render: (b) => <Badge>{b.code}</Badge> },
        { label: t('settings.city'), render: (b) => b.city ?? '—' },
        { label: t('patients.phone'), render: (b) => b.phone ?? '—' },
        { label: t('settings.geofence'), render: (b) => (b.latitude != null ? <Badge tone="success"><MapPin className="size-3" />{b.geofence_radius_m} m</Badge> : <span className="text-xs text-fg-subtle">{t('settings.noLocation')}</span>) },
      ]}
      initial={(b) => ({ name: b?.name ?? '', code: b?.code ?? '', city: b?.city ?? '', phone: b?.phone ?? '', address: b?.address ?? '', is_active: b?.is_active ?? true, latitude: b?.latitude != null ? String(b.latitude) : '', longitude: b?.longitude != null ? String(b.longitude) : '', geofence_radius_m: b?.geofence_radius_m ?? 150 })}
      renderForm={(v, set) => (
        <>
          <Field label={t('settings.branchName')} required><Input value={v.name as string} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label={t('settings.branchCode')} required><Input maxLength={12} value={v.code as string} onChange={(e) => set({ code: e.target.value.toUpperCase() })} /></Field>
          <Field label={t('settings.city')}><Input value={v.city as string} onChange={(e) => set({ city: e.target.value })} /></Field>
          <Field label={t('patients.phone')}><Input value={v.phone as string} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label={t('settings.address')} className="sm:col-span-2"><Input value={v.address as string} onChange={(e) => set({ address: e.target.value })} /></Field>
          <GeoFields value={v} set={set} />
          <ActiveSwitch value={v} set={set} />
        </>
      )}
      onSave={async (v, b) => {
        const body = { ...v, city: v.city || null, phone: v.phone || null, address: v.address || null, latitude: v.latitude === '' ? null : Number(v.latitude), longitude: v.longitude === '' ? null : Number(v.longitude), geofence_radius_m: Number(v.geofence_radius_m) || 150 };
        await (b ? unwrap(api.PUT('/settings/branches/{branch}', { params: { path: { branch: b.id } }, body: body as never })) : unwrap(api.POST('/settings/branches', { body: body as never })));
        void queryClient.invalidateQueries({ queryKey: ['branches'] });
        void refresh();
      }}
    />
  );
}

function ServicesSection() {
  const { t } = useTranslation();
  const f = useFormat();
  const queryClient = useQueryClient();
  const { data } = useServices(true);
  return (
    <CatalogSection<Service>
      title={t('settings.services')}
      addLabel={t('settings.addService')}
      rows={data}
      columns={[
        { label: t('settings.serviceName'), render: (s) => <span className="flex items-center gap-2 font-medium"><span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color ?? '#3E8E76' }} />{s.name}</span> },
        { label: t('settings.duration'), render: (s) => `${s.duration_minutes} min` },
        { label: t('settings.price'), render: (s) => <span className="tabular">{f.money(s.price_minor)}</span>, className: 'text-end' },
        { label: t('settings.taxRate'), render: (s) => (s.tax_rate_bp ? `${s.tax_rate_bp / 100}%` : '—'), className: 'text-end' },
        { label: t('settings.online'), render: (s) => (s.online_bookable ? <Badge tone="success">{t('settings.onlineYes')}</Badge> : <span className="text-xs text-fg-subtle">—</span>) },
      ]}
      initial={(s) => ({ name: s?.name ?? '', category: s?.category ?? '', duration_minutes: s?.duration_minutes ?? 45, price_minor: s?.price_minor ?? null, tax: s ? String(s.tax_rate_bp / 100) : '0', color: s?.color ?? '#3E8E76', is_active: s?.is_active ?? true, description: s?.description ?? '', online_bookable: s?.online_bookable ?? true })}
      renderForm={(v, set) => (
        <>
          <Field label={t('settings.serviceName')} required className="sm:col-span-2"><Input value={v.name as string} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label={t('settings.category')}><Input value={v.category as string} onChange={(e) => set({ category: e.target.value })} /></Field>
          <Field label={t('settings.duration')}><Input type="number" min={10} step={5} value={v.duration_minutes as number} onChange={(e) => set({ duration_minutes: Number(e.target.value) })} /></Field>
          <Field label={t('settings.price')} required><MoneyInput value={v.price_minor as number | null} onChange={(m) => set({ price_minor: m })} /></Field>
          <Field label={t('settings.taxRate')}><Input inputMode="decimal" value={v.tax as string} onChange={(e) => set({ tax: e.target.value })} /></Field>
          <Field label={t('settings.colour')}><Input type="color" className="h-10 w-20 p-1" value={v.color as string} onChange={(e) => set({ color: e.target.value })} /></Field>
          <Field label={t('settings.serviceDescription')} className="sm:col-span-2" hint={t('settings.serviceDescriptionHint')}><Textarea rows={2} maxLength={500} value={v.description as string} onChange={(e) => set({ description: e.target.value })} /></Field>
          <div className="flex items-center gap-3 sm:col-span-2"><Switch id="svc-online" checked={v.online_bookable as boolean} onCheckedChange={(x) => set({ online_bookable: x })} /><Label htmlFor="svc-online">{t('settings.onlineBookable')}</Label></div>
          <ActiveSwitch value={v} set={set} />
        </>
      )}
      onSave={async (v, s) => {
        const body = { name: v.name, category: v.category || null, duration_minutes: v.duration_minutes, price_minor: v.price_minor ?? 0, tax_rate_bp: Math.round(Number(v.tax || 0) * 100), color: v.color, is_active: v.is_active, description: v.description || null, online_bookable: v.online_bookable };
        await (s ? unwrap(api.PUT('/settings/services/{service}', { params: { path: { service: s.id } }, body: body as never })) : unwrap(api.POST('/settings/services', { body: body as never })));
        void queryClient.invalidateQueries({ queryKey: ['services'] });
      }}
    />
  );
}

function PackagesSection() {
  const { t } = useTranslation();
  const f = useFormat();
  const queryClient = useQueryClient();
  const { data } = usePackagePlans(true);
  const { data: services } = useServices();
  return (
    <CatalogSection<PackagePlan>
      title={t('settings.packages')}
      addLabel={t('settings.addPackage')}
      rows={data}
      columns={[
        { label: t('settings.packageName'), render: (p) => <span className="font-medium">{p.name}</span> },
        { label: t('settings.sessions'), render: (p) => p.sessions_count, className: 'text-end' },
        { label: t('settings.validity'), render: (p) => p.validity_days, className: 'text-end' },
        { label: t('settings.price'), render: (p) => <span className="tabular">{f.money(p.price_minor)}</span>, className: 'text-end' },
      ]}
      initial={(p) => ({ name: p?.name ?? '', service_id: p?.service_id ?? '', sessions_count: p?.sessions_count ?? 10, price_minor: p?.price_minor ?? null, validity_days: p?.validity_days ?? 90, is_active: p?.is_active ?? true })}
      renderForm={(v, set) => (
        <>
          <Field label={t('settings.packageName')} required className="sm:col-span-2"><Input value={v.name as string} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label={t('settings.forService')}>
            <Select value={v.service_id as string} onChange={(e) => set({ service_id: e.target.value })}>
              <option value="">{t('settings.anyService')}</option>
              {services?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label={t('settings.sessions')}><Input type="number" min={1} value={v.sessions_count as number} onChange={(e) => set({ sessions_count: Number(e.target.value) })} /></Field>
          <Field label={t('settings.price')} required><MoneyInput value={v.price_minor as number | null} onChange={(m) => set({ price_minor: m })} /></Field>
          <Field label={t('settings.validity')}><Input type="number" min={1} value={v.validity_days as number} onChange={(e) => set({ validity_days: Number(e.target.value) })} /></Field>
          <ActiveSwitch value={v} set={set} />
        </>
      )}
      onSave={async (v, p) => {
        const body = { ...v, service_id: v.service_id ? Number(v.service_id) : null, price_minor: v.price_minor ?? 0 };
        await (p ? unwrap(api.PUT('/settings/package-plans/{plan}', { params: { path: { plan: p.id } }, body: body as never })) : unwrap(api.POST('/settings/package-plans', { body: body as never })));
        void queryClient.invalidateQueries({ queryKey: ['package-plans'] });
      }}
    />
  );
}

function PayersSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = usePayers();
  return (
    <CatalogSection<InsurancePayer>
      title={t('settings.payers')}
      addLabel={t('settings.addPayer')}
      rows={data}
      columns={[
        { label: t('settings.payerName'), render: (p) => <span className="font-medium">{p.name}</span> },
        { label: t('settings.payerType'), render: (p) => t(`settings.payerTypes.${p.type}`) },
        { label: t('patients.email'), render: (p) => p.contact_email ?? '—' },
      ]}
      initial={(p) => ({ name: p?.name ?? '', type: p?.type ?? 'insurer', code: p?.code ?? '', contact_email: p?.contact_email ?? '', contact_phone: p?.contact_phone ?? '', is_active: p?.is_active ?? true })}
      renderForm={(v, set) => (
        <>
          <Field label={t('settings.payerName')} required><Input value={v.name as string} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label={t('settings.payerType')}><Select value={v.type as string} onChange={(e) => set({ type: e.target.value })}>{['insurer', 'tpa', 'corporate'].map((x) => <option key={x} value={x}>{t(`settings.payerTypes.${x}`)}</option>)}</Select></Field>
          <Field label={t('patients.email')}><Input type="email" value={v.contact_email as string} onChange={(e) => set({ contact_email: e.target.value })} /></Field>
          <Field label={t('patients.phone')}><Input value={v.contact_phone as string} onChange={(e) => set({ contact_phone: e.target.value })} /></Field>
          <ActiveSwitch value={v} set={set} />
        </>
      )}
      onSave={async (v, p) => {
        const body = { ...v, code: v.code || null, contact_email: v.contact_email || null, contact_phone: v.contact_phone || null };
        await (p ? unwrap(api.PUT('/settings/insurance-payers/{payer}', { params: { path: { payer: p.id } }, body: body as never })) : unwrap(api.POST('/settings/insurance-payers', { body: body as never })));
        void queryClient.invalidateQueries({ queryKey: ['payers'] });
      }}
    />
  );
}

function ConsentsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['consent-templates'], queryFn: async () => (await unwrap(api.GET('/settings/consent-templates'))).data as ConsentTemplate[] });
  return (
    <div className="space-y-3">
      <Alert tone="info">{t('settings.versionNote')}</Alert>
      <CatalogSection<ConsentTemplate>
        title={t('settings.consents')}
        addLabel={t('settings.addConsent')}
        rows={data}
        columns={[
          { label: t('settings.consentTitle'), render: (c) => <span className="font-medium">{c.title}</span> },
          { label: t('common:language'), render: (c) => c.locale.toUpperCase() },
          { label: 'Version', render: (c) => <Badge>{t('settings.version', { version: c.version })}</Badge> },
          { label: t('settings.required'), render: (c) => (c.is_required ? '✓' : '—') },
        ]}
        initial={(c) => ({ title: c?.title ?? '', body: c?.body ?? '', locale: c?.locale ?? 'en', is_required: c?.is_required ?? false, is_active: c?.is_active ?? true })}
        renderForm={(v, set) => (
          <>
            <Field label={t('settings.consentTitle')} required><Input value={v.title as string} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label={t('common:language')}><Select value={v.locale as string} onChange={(e) => set({ locale: e.target.value })}>{SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}<option value="hi">हिन्दी</option></Select></Field>
            <Field label={t('settings.consentBody')} required className="sm:col-span-2"><Textarea rows={8} dir={v.locale === 'ar' ? 'rtl' : 'ltr'} value={v.body as string} onChange={(e) => set({ body: e.target.value })} /></Field>
            <div className="flex items-center gap-3"><Switch id="req" checked={v.is_required as boolean} onCheckedChange={(x) => set({ is_required: x })} /><Label htmlFor="req">{t('settings.required')}</Label></div>
            <ActiveSwitch value={v} set={set} />
          </>
        )}
        onSave={async (v, c) => {
          await (c ? unwrap(api.PUT('/settings/consent-templates/{template}', { params: { path: { template: c.id } }, body: v as never })) : unwrap(api.POST('/settings/consent-templates', { body: v as never })));
          void queryClient.invalidateQueries({ queryKey: ['consent-templates'] });
        }}
      />
    </div>
  );
}

function PaymentsSection() {
  const { t } = useTranslation();
  const { data: clinic } = useClinic();
  const save = useSaveClinic();
  const [keys, setKeys] = useState({ key_id: '', key_secret: '', webhook_secret: '' });
  const webhook = `${window.location.origin}/api/webhooks/razorpay/${clinic?.slug ?? ''}`;

  return (
    <Card>
      <CardHeader title={t('settings.razorpay')} description={t('settings.razorpayHelp')} action={<Badge tone={clinic?.online_payments_enabled ? 'success' : 'neutral'}>{clinic?.online_payments_enabled ? t('settings.connected') : t('settings.notConnected')}</Badge>} />
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label={t('settings.keyId')}><Input autoComplete="off" value={keys.key_id} onChange={(e) => setKeys({ ...keys, key_id: e.target.value })} placeholder="rzp_live_…" /></Field>
        <Field label={t('settings.keySecret')}><Input type="password" autoComplete="new-password" value={keys.key_secret} onChange={(e) => setKeys({ ...keys, key_secret: e.target.value })} /></Field>
        <Field label={t('settings.webhookSecret')}><Input type="password" autoComplete="new-password" value={keys.webhook_secret} onChange={(e) => setKeys({ ...keys, webhook_secret: e.target.value })} /></Field>
        <Field label={t('settings.webhookUrl')}><Input readOnly value={webhook} onFocus={(e) => e.currentTarget.select()} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          {clinic?.online_payments_enabled && <Button variant="danger-ghost" onClick={() => save.mutate({ razorpay: null })}>{t('common:actions.delete')}</Button>}
          <Button disabled={!keys.key_id || !keys.key_secret || !keys.webhook_secret} loading={save.isPending} onClick={() => save.mutate({ razorpay: keys }, { onSuccess: () => setKeys({ key_id: '', key_secret: '', webhook_secret: '' }) })}>
            {t('common:actions.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MessagingSection() {
  const { t } = useTranslation();
  const { data: clinic } = useClinic();
  const save = useSaveClinic();
  const [keys, setKeys] = useState({ account_sid: '', auth_token: '', sms_from: '', whatsapp_from: '' });
  const connected = !!(clinic?.messaging.sms || clinic?.messaging.whatsapp);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={t('settings.twilio')}
          description={t('settings.twilioHelp')}
          action={<Badge tone={connected ? 'success' : 'neutral'}>{connected ? t('settings.connected') : t('settings.notConnected')}</Badge>}
        />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['whatsapp', 'sms', 'email'] as const).map((c) => (
              <Badge key={c} tone={clinic?.messaging[c] ? 'success' : 'neutral'} dot>{t(`settings.channelStatus.${c}`)}</Badge>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.accountSid')}><Input autoComplete="off" dir="ltr" placeholder="AC…" value={keys.account_sid} onChange={(e) => setKeys({ ...keys, account_sid: e.target.value.trim() })} /></Field>
            <Field label={t('settings.authToken')}><Input type="password" autoComplete="new-password" value={keys.auth_token} onChange={(e) => setKeys({ ...keys, auth_token: e.target.value })} /></Field>
            <Field label={t('settings.smsFrom')}><Input dir="ltr" placeholder="+14155550100" value={keys.sms_from} onChange={(e) => setKeys({ ...keys, sms_from: e.target.value.trim() })} /></Field>
            <Field label={t('settings.whatsappFrom')}><Input dir="ltr" placeholder="+14155550101" value={keys.whatsapp_from} onChange={(e) => setKeys({ ...keys, whatsapp_from: e.target.value.trim() })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            {connected && <Button variant="danger-ghost" onClick={() => save.mutate({ twilio: null })}>{t('settings.disconnect')}</Button>}
            <Button
              disabled={!keys.account_sid || !keys.auth_token || (!keys.sms_from && !keys.whatsapp_from)}
              loading={save.isPending}
              onClick={() => save.mutate({ twilio: { ...keys, sms_from: keys.sms_from || null, whatsapp_from: keys.whatsapp_from || null } }, { onSuccess: () => setKeys({ account_sid: '', auth_token: '', sms_from: '', whatsapp_from: '' }) })}
            >
              {t('common:actions.save')}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={t('settings.templates')} action={<Button asChild size="sm" variant="outline"><Link to="/messages?tab=templates">{t('messages.templates')}</Link></Button>} />
      </Card>
    </div>
  );
}

function HrSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: clinic } = useClinic();
  const save = useSaveClinic();
  const [draft, setDraft] = useState<{ weekly_off_days: number[]; holidays: { date: string; name: string }[]; attendance_grace_minutes: number; attendance_geofence: boolean } | null>(null);
  const { data: types } = useQuery({ queryKey: ['leave-types'], queryFn: async () => (await unwrap(api.GET('/leave-types'))).data as unknown as LeaveType[] });
  if (!clinic) return null;
  const v = draft ?? { weekly_off_days: clinic.settings.weekly_off_days as number[], holidays: clinic.settings.holidays, attendance_grace_minutes: clinic.settings.attendance_grace_minutes, attendance_geofence: Boolean((clinic.settings as { attendance_geofence?: boolean }).attendance_geofence) };
  const weekdays = t('staff.weekdays', { returnObjects: true }) as string[];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t('settings.hr')} description={t('settings.hrHelp')} />
        <CardContent className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">{t('settings.weeklyOff')}</legend>
            <div className="flex flex-wrap gap-3">
              {weekdays.map((day, i) => (
                <label key={day} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={v.weekly_off_days.includes(i)} onCheckedChange={(c) => setDraft({ ...v, weekly_off_days: c ? [...v.weekly_off_days, i].sort() : v.weekly_off_days.filter((x) => x !== i) })} />
                  {day}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="geofence" className="flex items-center gap-2"><MapPin className="size-4" />{t('settings.geofenceRequired')}</Label>
              <p className="mt-1 text-xs text-fg-muted">{t('settings.geofenceHelp')} <Link to="/settings?section=branches" className="text-primary underline underline-offset-2">{t('settings.setBranchLocations')}</Link></p>
            </div>
            <Switch id="geofence" checked={v.attendance_geofence} onCheckedChange={(x) => setDraft({ ...v, attendance_geofence: x })} />
          </div>
          <Field label={t('settings.graceMinutes')} className="max-w-xs">
            <Input type="number" min={0} max={120} value={v.attendance_grace_minutes} onChange={(e) => setDraft({ ...v, attendance_grace_minutes: Number(e.target.value) })} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">{t('settings.holidays')}</legend>
            <div className="space-y-2">
              {!v.holidays.length && <p className="text-sm text-fg-muted">{t('settings.noHolidays')}</p>}
              {v.holidays.map((h, i) => (
                <div key={i} className="grid grid-cols-[160px_1fr_auto] gap-2">
                  <Input type="date" aria-label={`${t('settings.holidayName')} ${i + 1}`} value={h.date} onChange={(e) => setDraft({ ...v, holidays: v.holidays.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} />
                  <Input aria-label={t('settings.holidayName')} placeholder={t('settings.holidayName')} value={h.name} onChange={(e) => setDraft({ ...v, holidays: v.holidays.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <Button variant="ghost" size="icon" aria-label={t('payroll.remove')} onClick={() => setDraft({ ...v, holidays: v.holidays.filter((_, j) => j !== i) })}><Trash2 /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setDraft({ ...v, holidays: [...v.holidays, { date: '', name: '' }] })}><Plus />{t('settings.addHoliday')}</Button>
            </div>
          </fieldset>
          <div className="flex justify-end">
            <Button
              loading={save.isPending}
              onClick={() => save.mutate({ settings: { ...v, holidays: v.holidays.filter((h) => h.date && h.name.trim()).sort((a, b) => a.date.localeCompare(b.date)) } }, { onSuccess: () => setDraft(null) })}
            >
              {t('common:actions.saveChanges')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <CatalogSection<LeaveType>
        title={t('settings.leaveTypes')}
        addLabel={t('leave.addType')}
        rows={types}
        columns={[
          { label: t('leave.typeName'), render: (x) => <span className="inline-flex items-center gap-2 font-medium"><span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: x.color }} />{x.name}</span> },
          { label: t('leave.code'), render: (x) => <code className="text-xs">{x.code}</code> },
          { label: t('leave.quota'), render: (x) => (x.annual_quota > 0 ? x.annual_quota : t('leave.unlimited')), className: 'tabular' },
          { label: t('leave.paid'), render: (x) => (x.is_paid ? '✓' : t('leave.unpaid')) },
        ]}
        initial={(x) => ({ name: x?.name ?? '', code: x?.code ?? '', annual_quota: x?.annual_quota ?? 12, is_paid: x?.is_paid ?? true, color: x?.color ?? '#3E8E76', is_active: x?.is_active ?? true })}
        renderForm={(val, set) => (
          <>
            <Field label={t('leave.typeName')} required><Input value={val.name as string} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label={t('leave.code')} required><Input value={val.code as string} maxLength={12} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></Field>
            <Field label={t('leave.annualQuota')}><Input type="number" min={0} max={365} step={0.5} value={val.annual_quota as number} onChange={(e) => set({ annual_quota: Number(e.target.value) })} /></Field>
            <Field label={t('settings.colour')}><Input type="color" className="h-10 p-1" value={val.color as string} onChange={(e) => set({ color: e.target.value })} /></Field>
            <div className="flex items-center gap-3"><Switch id="lt-paid" checked={val.is_paid as boolean} onCheckedChange={(x) => set({ is_paid: x })} /><Label htmlFor="lt-paid">{t('leave.paid')}</Label></div>
            <ActiveSwitch value={val} set={set} />
          </>
        )}
        onSave={async (val, x) => {
          await (x ? unwrap(api.PUT('/leave-types/{leaveType}', { params: { path: { leaveType: x.id } }, body: val as never })) : unwrap(api.POST('/leave-types', { body: val as never })));
          void queryClient.invalidateQueries({ queryKey: ['leave-types'] });
        }}
      />
    </div>
  );
}

function PortalSection() {
  const { t } = useTranslation();
  const { data: clinic } = useClinic();
  const save = useSaveClinic();
  const [s, setS] = useState<Tenant['settings'] | null>(null);
  const v = s ?? clinic?.settings;
  if (!v || !clinic) return null;
  const origin = window.location.origin;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t('settings.portal')} />
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <Label htmlFor="pb">{t('settings.portalBooking')}</Label>
            <Switch id="pb" checked={v.portal_booking_enabled} onCheckedChange={(x) => setS({ ...v, portal_booking_enabled: x })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('settings.leadTime')}><Input type="number" min={0} value={v.portal_min_lead_minutes} onChange={(e) => setS({ ...v, portal_min_lead_minutes: Number(e.target.value) })} /></Field>
            <Field label={t('settings.cancelWindow')}><Input type="number" min={0} value={v.portal_cancellation_hours} onChange={(e) => setS({ ...v, portal_cancellation_hours: Number(e.target.value) })} /></Field>
            <Field label={t('settings.reminderHours')}><Input type="number" min={1} value={v.reminder_hours_before} onChange={(e) => setS({ ...v, reminder_hours_before: Number(e.target.value) })} /></Field>
          </div>
          <div className="flex justify-end"><Button loading={save.isPending} onClick={() => save.mutate({ settings: v })}>{t('common:actions.saveChanges')}</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={t('enquiries.websiteForm')} description={t('enquiries.websiteFormHelp')} />
        <CardContent className="space-y-2 text-sm">
          <code dir="ltr" className="block overflow-x-auto rounded-lg bg-surface-3 p-3 text-xs">POST {origin}/api/public/clinics/{clinic.slug}/enquiries</code>
          <p className="text-fg-muted">Patient app: <a className="text-primary hover:underline" href={`${origin}/my/?clinic=${clinic.slug}`}>{origin}/my/?clinic={clinic.slug}</a></p>
        </CardContent>
      </Card>
    </div>
  );
}
