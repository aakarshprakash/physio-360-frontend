import { api, unwrap } from '@physio/api';
import { Card, CardContent, CardHeader, PageHeader, Skeleton, StatCard } from '@physio/ui';
import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarCheck, Sparkles, Stethoscope, Users } from 'lucide-react';

interface Metrics {
  tenants_total: number;
  tenants_active: number;
  tenants_new_30d: number;
  staff_total: number;
  patients_total: number;
  appointments_30d: number;
  by_plan: Record<string, number>;
  by_country: Record<string, number>;
}

const COUNTRY: Record<string, string> = { IN: 'India', AE: 'UAE', SA: 'Saudi Arabia', KW: 'Kuwait', BH: 'Bahrain', OM: 'Oman', QA: 'Qatar' };

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: async () => (await unwrap(api.GET('/platform/metrics')) as unknown as { data: Metrics }).data,
  });

  const nf = new Intl.NumberFormat('en-IN');

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="Aggregate figures across all Physio360 clinics. No patient-identifiable data is shown here." />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Key figures">
        {isLoading || !data ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        ) : (
          <>
            <StatCard label="Clinics" value={nf.format(data.tenants_total)} icon={<Building2 />} footer={<span className="text-fg-muted">{data.tenants_active} active</span>} />
            <StatCard label="New clinics (30d)" value={nf.format(data.tenants_new_30d)} icon={<Sparkles />} tone="violet" />
            <StatCard label="Active staff" value={nf.format(data.staff_total)} icon={<Stethoscope />} tone="info" />
            <StatCard label="Patients" value={nf.format(data.patients_total)} icon={<Users />} />
            <StatCard label="Appointments (30d)" value={nf.format(data.appointments_30d)} icon={<CalendarCheck />} tone="warning" />
          </>
        )}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <Breakdown title="Clinics by plan" rows={Object.entries(data?.by_plan ?? {}).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v])} />
        <Breakdown title="Clinics by country" rows={Object.entries(data?.by_country ?? {}).map(([k, v]) => [COUNTRY[k] ?? k, v])} />
      </div>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <Card>
      <CardHeader title={title} />
      <CardContent>
        <ul className="space-y-3">
          {rows.map(([label, value]) => (
            <li key={label}>
              <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{label}</span><span className="tabular">{value}</span></div>
              <div aria-hidden className="h-2 rounded-full bg-surface-3"><div className="h-full rounded-full bg-primary" style={{ width: `${(value / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
