import { api, unwrap } from '@physio/api';
import { Badge, Button, Card, CardContent, CardHeader, ConfirmDialog, DetailList, PageLoader, Select, StatCard, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, CalendarCheck, Stethoscope, Users } from 'lucide-react';
import { Link, useParams } from 'react-router';
import type { TenantRow } from './TenantsPage';

interface TenantDetail extends TenantRow {
  phone: string | null;
  stats: { users: number; patients: number; branches: number; appointments_30d: number; last_staff_login: string | null };
  owner: { name: string; email: string } | null;
}

export function TenantPage() {
  const { tenantId } = useParams();
  const id = Number(tenantId);
  const client = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: async () => (await unwrap(api.GET('/platform/tenants/{tenant}', { params: { path: { tenant: id } } })) as unknown as { data: TenantDetail }).data,
  });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => unwrap(api.PUT('/platform/tenants/{tenant}', { params: { path: { tenant: id } }, body: body as never })),
    onSuccess: () => {
      toast.success('Saved');
      void client.invalidateQueries({ queryKey: ['tenant', id] });
      void client.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  if (isLoading || !tenant) return <PageLoader />;
  const suspended = tenant.status === 'suspended';

  return (
    <div className="space-y-5">
      <Link to="/tenants" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg"><ArrowLeft className="size-4 rtl:rotate-180" />Clinics</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1><Badge tone={suspended ? 'danger' : 'success'}>{tenant.status}</Badge></div>
          <p className="mt-1 text-sm text-fg-muted">{tenant.slug} · {tenant.country_code} · {tenant.currency_code} · {tenant.timezone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Plan" className="w-40" value={tenant.plan} onChange={(e) => update.mutate({ plan: e.target.value })}>
            <option value="trial">Trial</option><option value="standard">Standard</option><option value="premium">Premium</option>
          </Select>
          <ConfirmDialog
            tone={suspended ? 'primary' : 'danger'}
            title={suspended ? 'Reactivate this clinic?' : 'Suspend this clinic?'}
            description={suspended ? 'Staff and patients will be able to sign in again.' : 'All staff and patients of this clinic are signed out and blocked until reactivated. Data is kept.'}
            confirmLabel={suspended ? 'Reactivate' : 'Suspend'}
            onConfirm={() => update.mutateAsync({ status: suspended ? 'active' : 'suspended' })}
            trigger={<Button variant={suspended ? 'primary' : 'danger'}>{suspended ? 'Reactivate' : 'Suspend'}</Button>}
          />
        </div>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Usage">
        <StatCard label="Branches" value={tenant.stats.branches} icon={<Building2 />} />
        <StatCard label="Staff" value={tenant.stats.users} icon={<Stethoscope />} tone="info" />
        <StatCard label="Patients" value={tenant.stats.patients} icon={<Users />} tone="violet" />
        <StatCard label="Appointments (30d)" value={tenant.stats.appointments_30d} icon={<CalendarCheck />} tone="warning" />
      </section>
      <Card>
        <CardHeader title="Account" />
        <CardContent>
          <DetailList
            items={[
              { label: 'Owner', value: tenant.owner ? `${tenant.owner.name} · ${tenant.owner.email}` : '—' },
              { label: 'Clinic email', value: tenant.email ?? '—' },
              { label: 'Phone', value: tenant.phone ?? '—' },
              { label: 'Trial ends', value: tenant.trial_ends_at ?? '—' },
              { label: 'Last staff sign-in', value: tenant.stats.last_staff_login ? new Date(`${tenant.stats.last_staff_login}Z`).toLocaleString() : 'Never' },
              { label: 'Created', value: new Date(tenant.created_at).toLocaleDateString() },
              { label: 'Patient app', value: <code className="text-xs">/my/?clinic={tenant.slug}</code> },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
