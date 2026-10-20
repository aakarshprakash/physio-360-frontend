import { api, unwrap, type ProgressEntry } from '@physio/api';
import { Card, EmptyState, PageHeader, Skeleton } from '@physio/ui';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '../lib/session';
import { PainReport } from './ExercisesPage';

/** Lightweight inline SVG chart (keeps the PWA bundle small; no chart library). */
function PainChart({ points }: { points: { date: string; pain: number }[] }) {
  const f = useFormat();
  const W = 320;
  const H = 160;
  const pad = { l: 24, r: 8, t: 8, b: 22 };
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / 10) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.pain)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={points.map((p) => `${p.date}: ${p.pain}/10`).join(', ')}>
      {[0, 5, 10].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" />
          <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--fg-subtle)">{v}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.pain)} r={4} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2}>
          <title>{`${f.local(p.date, 'd MMM')}: ${p.pain}/10`}</title>
        </circle>
      ))}
      {[0, points.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--fg-subtle)">{f.local(points[i].date, 'd MMM')}</text>
      ))}
    </svg>
  );
}

export function ProgressPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['my', 'progress'],
    queryFn: async () => (await unwrap(api.GET('/patient/progress')) as unknown as { data: ProgressEntry[] }).data,
  });
  const points = Object.values(
    (data ?? []).reduce<Record<string, { date: string; pain: number }>>((acc, e) => {
      if (e.pain_score != null) acc[e.recorded_on] = { date: e.recorded_on, pain: e.pain_score };
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-5">
      <PageHeader title={t('progress.title')} />
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">{t('progress.pain')}</h2>
        {isLoading ? <Skeleton className="h-40" /> : points.length ? <PainChart points={points} /> : <EmptyState icon={<LineChart />} title={t('progress.none')} />}
      </Card>
      <PainReport />
    </div>
  );
}
