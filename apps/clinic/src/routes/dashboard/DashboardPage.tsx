import { api, unwrap, type Appointment, type Enquiry } from '@physio/api';
import { greetingKey, todayInZone } from '@physio/core';
import { Avatar, Button, Card, CardContent, CardHeader, EmptyState, ErrorState, Skeleton, StatCard } from '@physio/ui';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus, CreditCard, Inbox, ReceiptText, TrendingUp, UserPlus, Users, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, useAxisProps } from '../../components/charts';
import { StatusBadge } from '../../components/common';
import { useFormat } from '../../lib/format';
import { useSession } from '../../lib/session';
import { MyDayCard } from '../attendance/MyDayCard';

interface Kpi {
  value: number;
  change_pct: number | null;
}

interface DashboardData {
  kpis: {
    today_appointments: Kpi;
    active_patients: Kpi;
    revenue_month_minor?: Kpi;
    pending_payments?: { count: number; amount_minor: number };
    patient_progress: { weeks: { week: number; label: string; improved: number }[]; improved: number; tracked: number };
  };
  today: Appointment[];
  revenue_trend?: { date: string; collected_minor: number }[];
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { session, branchId, can } = useSession();
  const f = useFormat();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', branchId],
    queryFn: async () => (await unwrap(api.GET('/dashboard', { params: { query: branchId ? ({ branch_id: branchId } as never) : undefined } }))) as unknown as { data: DashboardData },
    refetchInterval: 60_000,
    select: (r) => r.data,
  });

  const firstName = session.user.name.replace(/^Dr\.?\s+/i, 'Dr. ').split(' ').slice(0, 2).join(' ');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[26px]">{t(`dashboard.greeting.${greetingKey(f.tz)}`, { name: firstName })}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-fg-muted">
            <CalendarDays className="size-4 text-primary" />
            {f.local(todayInZone(f.tz), 'EEE, d MMM yyyy')}
          </span>
          {can('appointments.manage') && (
            <Button asChild size="sm">
              <Link to="/appointments?new=1">
                <CalendarPlus />
                {t('dashboard.newAppointment')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <MyDayCard />

      {isError ? (
        <Card>
          <ErrorState title={t('common:errors.generic')} action={<Button variant="outline" onClick={() => refetch()}>{t('common:actions.retry')}</Button>} />
        </Card>
      ) : (
        <>
          <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading || !data ? (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-xl" />)
            ) : (
              <>
                <StatCard
                  label={t('dashboard.todayAppointments')}
                  value={f.number(data.kpis.today_appointments.value)}
                  icon={<CalendarDays />}
                  tone="info"
                  change={data.kpis.today_appointments.change_pct}
                  changeLabel={t('dashboard.fromYesterday')}
                />
                <StatCard
                  label={t('dashboard.activePatients')}
                  value={f.number(data.kpis.active_patients.value)}
                  icon={<Users />}
                  tone="primary"
                  change={data.kpis.active_patients.change_pct}
                  changeLabel={t('dashboard.vsLastMonth')}
                />
                {data.kpis.revenue_month_minor ? (
                  <StatCard
                    label={`${t('dashboard.revenue')} · ${t('dashboard.thisMonth')}`}
                    value={f.moneyCompact(data.kpis.revenue_month_minor.value)}
                    icon={<Wallet />}
                    tone="primary"
                    change={data.kpis.revenue_month_minor.change_pct}
                    changeLabel={t('dashboard.vsLastMonth')}
                  />
                ) : (
                  <StatCard label={t('dashboard.patientsImproved')} value={f.number(data.kpis.patient_progress.improved)} icon={<TrendingUp />} />
                )}
                {data.kpis.pending_payments ? (
                  <StatCard
                    label={t('dashboard.pendingPayments')}
                    value={f.number(data.kpis.pending_payments.count)}
                    icon={<CreditCard />}
                    tone="violet"
                    footer={
                      <Link to="/billing?payment_status=outstanding" className="font-medium text-primary hover:underline">
                        {f.money(data.kpis.pending_payments.amount_minor)} · {t('dashboard.viewDetails')}
                      </Link>
                    }
                  />
                ) : (
                  <StatCard label={t('dashboard.patientProgress')} value={`${data.kpis.patient_progress.tracked}`} icon={<Users />} tone="violet" />
                )}
              </>
            )}
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
            <TodaySchedule appointments={data?.today} loading={isLoading} />
            <ProgressCard data={data?.kpis.patient_progress} loading={isLoading} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
            {data?.revenue_trend && <RevenueTrend series={data.revenue_trend} />}
            <div className="space-y-6">
              {can('enquiries.manage') && <EnquiriesDue />}
              <QuickActions />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TodaySchedule({ appointments, loading }: { appointments?: Appointment[]; loading: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <Card>
      <CardHeader
        title={t('dashboard.upcoming')}
        action={
          <Link to="/appointments" className="text-[13px] font-medium text-primary hover:underline">
            {t('common:actions.viewAll')}
          </Link>
        }
      />
      <CardContent className="px-2 pb-2">
        {loading ? (
          <div className="space-y-2 px-3 pb-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !appointments?.length ? (
          <EmptyState icon={<CalendarDays />} title={t('dashboard.noAppointmentsToday')} />
        ) : (
          <ul className="divide-y divide-border">
            {appointments.map((a) => (
              <li key={a.id}>
                <Link to={`/appointments?date=${a.local_start.slice(0, 10)}&open=${a.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2">
                  <span className="tabular w-[72px] shrink-0 text-[13px] font-semibold text-fg-muted">{f.local(a.local_start, 'h:mm a')}</span>
                  <Avatar name={a.patient?.full_name ?? '?'} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.patient?.full_name}</span>
                    <span className="block truncate text-xs text-fg-muted">
                      {a.service?.name ?? t(`common:appointmentType.${a.type}`)} · {a.practitioner?.name}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressCard({ data, loading }: { data?: DashboardData['kpis']['patient_progress']; loading: boolean }) {
  const { t } = useTranslation();
  const { palette, axis } = useAxisProps();
  return (
    <Card>
      <CardHeader title={t('dashboard.patientProgress')} description={t('dashboard.improvedHint')} />
      <CardContent>
        {loading || !data ? (
          <Skeleton className="h-56" />
        ) : (
          <>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="tabular text-3xl font-bold">{data.improved}</span>
              <span className="text-sm text-fg-muted">{t('dashboard.patientsImproved')}</span>
            </div>
            <div className="h-48" role="img" aria-label={`${t('dashboard.patientsImproved')}: ${data.weeks.map((w) => `${w.label} ${w.improved}`).join(', ')}`}>
              <ResponsiveContainer>
                <AreaChart data={data.weeks.map((w) => ({ ...w, label: t('dashboard.week', { n: w.week }) }))} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={palette.series[0]} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={palette.series[0]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={palette.grid} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis allowDecimals={false} {...axis} width={44} />
                  <Tooltip cursor={{ stroke: palette.cursor }} content={(p) => <ChartTooltip {...p} formatValue={(v) => v} />} />
                  <Area type="monotone" dataKey="improved" name={t('dashboard.patientsImproved')} stroke={palette.series[0]} strokeWidth={2} fill="url(#progressFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: palette.surface }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RevenueTrend({ series }: { series: { date: string; collected_minor: number }[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { palette, axis } = useAxisProps();
  return (
    <Card>
      <CardHeader title={t('dashboard.revenueTrend')} />
      <CardContent>
        <div className="h-64" role="img" aria-label={t('dashboard.revenueTrend')}>
          <ResponsiveContainer>
            <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={6}>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              <XAxis dataKey="date" {...axis} tickFormatter={(d) => f.local(d, 'd MMM')} interval="preserveStartEnd" minTickGap={18} />
              <YAxis {...axis} width={64} tickFormatter={(v) => f.moneyCompact(v)} />
              <Tooltip cursor={{ fill: palette.grid, opacity: 0.5 }} content={(p) => <ChartTooltip {...p} formatValue={(v) => f.money(v)} formatLabel={(l) => f.local(l, 'EEE, d MMM')} />} />
              <Bar dataKey="collected_minor" name={t('reports.collected')} fill={palette.series[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function EnquiriesDue() {
  const { t } = useTranslation();
  const f = useFormat();
  const { data } = useQuery({
    queryKey: ['enquiries', 'due-widget'],
    queryFn: () => unwrap(api.GET('/enquiries', { params: { query: { status: 'due', per_page: 5 } } })),
  });
  const rows = (data?.data ?? []) as Enquiry[];
  const due = (data as unknown as { summary?: { due_today: number } })?.summary?.due_today ?? 0;

  return (
    <Card>
      <CardHeader
        title={`${t('dashboard.followUpsDue')} (${due})`}
        action={
          <Link to="/enquiries?status=due" className="text-[13px] font-medium text-primary hover:underline">
            {t('common:actions.viewAll')}
          </Link>
        }
      />
      <CardContent className="px-2 pb-2">
        {rows.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-fg-muted">{t('enquiries.empty')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((e) => (
              <li key={e.id}>
                <Link to={`/enquiries?open=${e.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warning-soft text-warning-soft-fg">
                    <Inbox className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{e.name}</span>
                    <span className="block truncate text-xs text-fg-muted">{e.interest ?? e.phone}</span>
                  </span>
                  <span className={e.is_overdue ? 'text-xs font-semibold text-danger' : 'text-xs text-fg-muted'}>{f.instant(e.next_follow_up_at, 'd MMM, h:mm a')}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  const { t } = useTranslation();
  const { can } = useSession();
  const actions = [
    { to: '/appointments?new=1', label: t('dashboard.newAppointment'), icon: CalendarPlus, show: can('appointments.manage') },
    { to: '/patients?new=1', label: t('dashboard.newPatient'), icon: UserPlus, show: can('patients.manage') },
    { to: '/enquiries?new=1', label: t('dashboard.newEnquiry'), icon: Inbox, show: can('enquiries.manage') },
    { to: '/billing?new=1', label: t('dashboard.newInvoice'), icon: ReceiptText, show: can('billing.manage') },
  ].filter((a) => a.show);

  if (actions.length === 0) return null;
  return (
    <Card>
      <CardHeader title={t('dashboard.quickActions')} />
      <CardContent className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <Link key={a.to} to={a.to} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-2 p-4 text-center text-[13px] font-medium transition-colors hover:border-primary hover:bg-primary-soft">
            <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-soft-fg">
              <a.icon className="size-5" />
            </span>
            {a.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
