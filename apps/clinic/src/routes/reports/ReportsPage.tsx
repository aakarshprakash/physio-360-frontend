import { api, openFile, unwrap, type Feedback } from '@physio/api';
import { addDays, todayInZone } from '@physio/core';
import { Avatar, Button, Card, CardContent, CardHeader, EmptyState, PageHeader, Segmented, Skeleton, StatCard, Table, Td, Th } from '@physio/ui';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CalendarCheck, CalendarX2, Download, IndianRupee, Star, UserPlus, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, Legend, useAxisProps } from '../../components/charts';
import { toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useSession } from '../../lib/session';

type Range = '7' | '30' | '90' | '365';

interface Summary {
  totals: Record<string, number>;
  series: { date: string; invoiced_minor: number; collected_minor: number; appointments_total: number }[];
  breakdown: {
    by_service: { label: string; amount_minor: number; quantity: number }[];
    by_practitioner: { id: number; name: string; color: string; appointments: number; completed: number; cancelled: number; no_show: number; delivered_minutes: number; revenue_minor: number; avg_rating: number | null; feedback_count: number }[];
  };
  aging: { bucket: string; amount_minor: number }[];
}

export function ReportsPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { branchId } = useSession();
  const { palette, axis } = useAxisProps();
  const [range, setRange] = useState<Range>('30');
  const to = todayInZone(f.tz);
  const from = addDays(to, -(Number(range) - 1));

  const { data, isLoading } = useQuery({
    queryKey: ['reports', from, to, branchId],
    queryFn: async () => (await unwrap(api.GET('/reports/summary', { params: { query: { from, to, branch_id: branchId ?? undefined } as never } })) as unknown as { data: Summary }).data,
  });

  const feedback = useQuery({
    queryKey: ['feedback'],
    queryFn: async () => (await unwrap(api.GET('/feedback'))).data as Feedback[],
  });

  // Monthly buckets for the 12-month view keep the chart readable.
  const series =
    range === '365' && data
      ? Object.values(
          data.series.reduce<Record<string, { date: string; invoiced_minor: number; collected_minor: number }>>((acc, d) => {
            const key = d.date.slice(0, 7);
            acc[key] ??= { date: `${key}-01`, invoiced_minor: 0, collected_minor: 0 };
            acc[key].invoiced_minor += d.invoiced_minor;
            acc[key].collected_minor += d.collected_minor;
            return acc;
          }, {}),
        )
      : (data?.series ?? []);

  const totals = data?.totals ?? {};
  const maxService = Math.max(1, ...(data?.breakdown.by_service.map((s) => s.amount_minor) ?? [1]));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('reports.title')}
        description={t('reports.subtitle')}
        actions={
          <>
            <Segmented<Range> label={t('reports.title')} value={range} onChange={setRange} options={(['7', '30', '90', '365'] as Range[]).map((r) => ({ value: r, label: t(`reports.range.${r}`) }))} />
            <Button variant="outline" onClick={() => openFile(`/reports/export?from=${from}&to=${to}${branchId ? `&branch_id=${branchId}` : ''}`, `report-${from}-${to}.csv`).catch(toastError)}>
              <Download />
              {t('reports.export')}
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" aria-label={t('reports.title')}>
        {isLoading ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        ) : (
          <>
            <StatCard label={t('reports.invoiced')} value={f.moneyCompact(totals.invoiced_minor ?? 0)} icon={f.currency.code === 'INR' ? <IndianRupee /> : <Wallet />} />
            <StatCard label={t('reports.collected')} value={f.moneyCompact(totals.collected_minor ?? 0)} icon={<Wallet />} tone="info" />
            <StatCard label={t('reports.appointments')} value={f.number(totals.appointments_total ?? 0)} icon={<BarChart3 />} tone="violet" />
            <StatCard label={t('reports.completed')} value={f.number(totals.appointments_completed ?? 0)} icon={<CalendarCheck />} />
            <StatCard label={t('reports.noShowRate')} value={`${totals.no_show_rate ?? 0}%`} icon={<CalendarX2 />} tone="warning" />
            <StatCard label={t('reports.newPatients')} value={f.number(totals.new_patients ?? 0)} icon={<UserPlus />} tone="info" />
          </>
        )}
      </section>

      <Card>
        <CardHeader
          title={t('reports.revenueOverTime')}
          action={<Legend items={[{ label: t('reports.invoiced'), color: palette.series[0] }, { label: t('reports.collected'), color: palette.series[1] }]} />}
        />
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-72" />
          ) : (
            <div className="h-72" role="img" aria-label={t('reports.revenueOverTime')}>
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={palette.grid} />
                  <XAxis dataKey="date" {...axis} tickFormatter={(d) => f.local(d, range === '365' ? 'MMM' : 'd MMM')} minTickGap={20} />
                  <YAxis {...axis} width={68} tickFormatter={(v) => f.moneyCompact(v)} />
                  <Tooltip cursor={{ stroke: palette.cursor }} content={(p) => <ChartTooltip {...p} formatValue={(v) => f.money(v)} formatLabel={(l) => f.local(l, range === '365' ? 'MMMM yyyy' : 'EEE d MMM')} />} />
                  <Line type="monotone" dataKey="invoiced_minor" name={t('reports.invoiced')} stroke={palette.series[0]} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: palette.surface, strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="collected_minor" name={t('reports.collected')} stroke={palette.series[1]} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: palette.surface, strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title={t('reports.byService')} />
          <CardContent>
            {!data?.breakdown.by_service.length ? (
              <EmptyState title={t('reports.noData')} className="py-8" />
            ) : (
              <ul className="space-y-3">
                {data.breakdown.by_service.slice(0, 8).map((s) => (
                  <li key={s.label}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{s.label} <span className="text-xs font-normal text-fg-subtle">× {s.quantity}</span></span>
                      <span className="tabular font-semibold">{f.money(s.amount_minor)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-3" aria-hidden>
                      <div className="h-full rounded-full" style={{ width: `${(s.amount_minor / maxService) * 100}%`, background: palette.series[0] }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t('reports.aging')} />
          <CardContent>
            <div className="h-60" role="img" aria-label={`${t('reports.aging')}: ${data?.aging.map((a) => `${a.bucket} ${f.money(a.amount_minor)}`).join(', ')}`}>
              <ResponsiveContainer>
                <BarChart data={data?.aging ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={palette.grid} />
                  <XAxis dataKey="bucket" {...axis} tickFormatter={(b) => `${b} ${t('reports.days')}`} />
                  <YAxis {...axis} width={68} tickFormatter={(v) => f.moneyCompact(v)} />
                  <Tooltip cursor={{ fill: palette.grid, opacity: 0.5 }} content={(p) => <ChartTooltip {...p} formatValue={(v) => f.money(v)} formatLabel={(l) => `${l} ${t('reports.days')}`} />} />
                  <Bar dataKey="amount_minor" name={t('billing.outstanding')} fill={palette.series[0]} radius={[4, 4, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title={t('reports.byPractitioner')} />
        {!data?.breakdown.by_practitioner.length ? (
          <EmptyState title={t('reports.noData')} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('appointments.practitioner')}</Th>
                <Th className="text-end">{t('reports.appointments')}</Th>
                <Th className="text-end">{t('reports.completed')}</Th>
                <Th className="text-end">{t('reports.cancelled')}</Th>
                <Th className="text-end">{t('reports.noShows')}</Th>
                <Th className="text-end">{t('reports.delivered')}</Th>
                <Th className="text-end">{t('reports.invoiced')}</Th>
                <Th className="text-end">{t('reports.rating')}</Th>
              </tr>
            </thead>
            <tbody>
              {data.breakdown.by_practitioner.map((p) => (
                <tr key={p.id}>
                  <Td><span className="flex items-center gap-2.5"><Avatar name={p.name} color={p.color} size={28} />{p.name}</span></Td>
                  <Td className="tabular text-end">{p.appointments}</Td>
                  <Td className="tabular text-end">{p.completed}</Td>
                  <Td className="tabular text-end">{p.cancelled}</Td>
                  <Td className="tabular text-end">{p.no_show}</Td>
                  <Td className="tabular text-end">{(p.delivered_minutes / 60).toFixed(1)}</Td>
                  <Td className="tabular text-end font-medium">{f.money(p.revenue_minor)}</Td>
                  <Td className="tabular text-end">{p.avg_rating ? <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-current text-warning" />{p.avg_rating} <span className="text-fg-subtle">({p.feedback_count})</span></span> : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title={t('reports.feedback')} />
        <CardContent>
          {!feedback.data?.length ? (
            <p className="text-sm text-fg-muted">{t('reports.noData')}</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {feedback.data.slice(0, 6).map((fb) => (
                <li key={fb.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{fb.patient?.full_name}</span>
                    <span className="flex" aria-label={`${fb.rating}/5`}>
                      {Array.from({ length: 5 }, (_, i) => <Star key={i} aria-hidden className={`size-4 ${i < fb.rating ? 'fill-current text-warning' : 'text-border-strong'}`} />)}
                    </span>
                  </div>
                  {fb.comment && <p className="mt-1 text-fg-muted">“{fb.comment}”</p>}
                  <p className="mt-1 text-xs text-fg-subtle">{fb.practitioner?.name} · {f.instant(fb.created_at, 'd MMM yyyy')}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
