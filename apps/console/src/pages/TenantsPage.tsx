import { api, ApiError, unwrap } from '@physio/api';
import { Alert, Badge, Button, Card, Dialog, DialogContent, EmptyState, Field, Input, PageHeader, Pagination, SearchInput, Select, Skeleton, Table, Td, Th, toast, Tr } from '@physio/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

export interface TenantRow {
  id: number;
  name: string;
  slug: string;
  email: string | null;
  country_code: string;
  currency_code: string;
  timezone: string;
  status: 'active' | 'suspended';
  plan: string;
  trial_ends_at: string | null;
  users_count: number | null;
  patients_count: number | null;
  branches_count: number | null;
  created_at: string;
}

export function TenantsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', debounced, status, page],
    queryFn: () => unwrap(api.GET('/platform/tenants', { params: { query: { search: debounced || undefined, status: (status || undefined) as never, page } as never } })) as unknown as Promise<{ data: TenantRow[]; meta: { current_page: number; last_page: number; total: number } }>,
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader title="Clinics" description="Provision, monitor and suspend clinic tenants." actions={<Button onClick={() => setCreating(true)}><Plus />New clinic</Button>} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <SearchInput className="min-w-60 flex-1" placeholder="Name, code or email" aria-label="Search clinics" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Status" className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-60" /></div>
        ) : !data?.data.length ? (
          <EmptyState icon={<Building2 />} title="No clinics found" />
        ) : (
          <>
            <Table>
              <thead>
                <tr><Th>Clinic</Th><Th>Region</Th><Th>Plan</Th><Th className="text-end">Branches</Th><Th className="text-end">Staff</Th><Th className="text-end">Patients</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {data.data.map((t) => (
                  <Tr key={t.id} interactive onClick={() => navigate(`/tenants/${t.id}`)}>
                    <Td><p className="font-semibold">{t.name}</p><p className="text-xs text-fg-muted">{t.slug} · {t.email}</p></Td>
                    <Td className="whitespace-nowrap">{t.country_code} · {t.currency_code}</Td>
                    <Td className="capitalize">{t.plan}</Td>
                    <Td className="tabular text-end">{t.branches_count}</Td>
                    <Td className="tabular text-end">{t.users_count}</Td>
                    <Td className="tabular text-end">{t.patients_count}</Td>
                    <Td><Badge tone={t.status === 'active' ? 'success' : 'danger'}>{t.status}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />
          </>
        )}
      </Card>
      {creating && <CreateTenantDialog onClose={() => setCreating(false)} onCreated={(id) => navigate(`/tenants/${id}`)} />}
    </div>
  );
}

const REGIONS: Record<string, { currency: string; timezone: string }> = {
  IN: { currency: 'INR', timezone: 'Asia/Kolkata' },
  AE: { currency: 'AED', timezone: 'Asia/Dubai' },
  SA: { currency: 'SAR', timezone: 'Asia/Riyadh' },
  KW: { currency: 'KWD', timezone: 'Asia/Kuwait' },
  BH: { currency: 'BHD', timezone: 'Asia/Bahrain' },
  OM: { currency: 'OMR', timezone: 'Asia/Muscat' },
  QA: { currency: 'QAR', timezone: 'Asia/Qatar' },
};

function CreateTenantDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const client = useQueryClient();
  const [form, setForm] = useState({
    name: '', slug: '', country_code: 'IN', currency_code: 'INR', timezone: 'Asia/Kolkata', plan: 'trial',
    email: '', phone: '', branch_name: 'Main Clinic', branch_code: 'MAIN', city: '',
    owner_name: '', owner_email: '', owner_password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => unwrap(api.POST('/platform/tenants', { body: Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])) as never })),
    onSuccess: (r) => {
      toast.success('Clinic provisioned');
      void client.invalidateQueries({ queryKey: ['tenants'] });
      onCreated((r as unknown as { data: TenantRow }).data.id);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.isValidation) setErrors(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])));
      else setError(e instanceof Error ? e.message : 'Failed');
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" title="Provision a new clinic" description="Creates the clinic, its first branch, the owner account and a starter catalog." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={create.isPending} onClick={() => create.mutate()}>Create clinic</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
          <Field label="Clinic name" required error={errors.name}><Input autoFocus value={form.name} onChange={set('name')} /></Field>
          <Field label="Clinic code (URL)" hint="Used by patients to sign in. Leave blank to generate." error={errors.slug}><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} /></Field>
          <Field label="Country" required>
            <Select value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value, currency_code: REGIONS[e.target.value].currency, timezone: REGIONS[e.target.value].timezone })}>
              {Object.keys(REGIONS).map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Plan" required><Select value={form.plan} onChange={set('plan')}><option value="trial">Trial</option><option value="standard">Standard</option><option value="premium">Premium</option></Select></Field>
          <Field label="Currency"><Input value={form.currency_code} readOnly /></Field>
          <Field label="Timezone"><Input value={form.timezone} onChange={set('timezone')} /></Field>
          <Field label="First branch" required error={errors.branch_name}><Input value={form.branch_name} onChange={set('branch_name')} /></Field>
          <Field label="Branch code" required error={errors.branch_code}><Input value={form.branch_code} onChange={(e) => setForm({ ...form, branch_code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Owner name" required error={errors.owner_name}><Input value={form.owner_name} onChange={set('owner_name')} /></Field>
          <Field label="Owner email" required error={errors.owner_email}><Input type="email" value={form.owner_email} onChange={set('owner_email')} /></Field>
          <Field label="Owner initial password" required error={errors.owner_password} hint="Share securely; the owner should change it on first sign-in."><Input type="password" autoComplete="new-password" value={form.owner_password} onChange={set('owner_password')} /></Field>
          <Field label="Clinic email"><Input type="email" value={form.email} onChange={set('email')} /></Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
