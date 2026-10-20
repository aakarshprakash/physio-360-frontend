import { api, openFile, unwrap, type PlanExercise } from '@physio/api';
import { Button, Card, cn, EmptyState, PageHeader, ProgressBar, Skeleton, toast } from '@physio/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Download, Dumbbell } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMyPlans } from '../lib/data';
import { errorText } from './util';

export function ExercisesPage() {
  const { t } = useTranslation();
  const { data: plans, isLoading } = useMyPlans();

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (!plans?.length) return <><PageHeader title={t('exercises.title')} /><Card><EmptyState icon={<Dumbbell />} title={t('exercises.none')} /></Card></>;

  return (
    <div className="space-y-6">
      <PageHeader title={t('exercises.title')} />
      {plans.map((plan) => {
        const done = plan.exercises?.filter((e) => e.done_today).length ?? 0;
        const total = plan.exercises?.length ?? 0;
        return (
          <section key={plan.id} aria-labelledby={`plan-${plan.id}`} className="space-y-3">
            <Card className="p-4">
              <h2 id={`plan-${plan.id}`} className="font-semibold">{plan.title}</h2>
              <p className="text-sm text-fg-muted">{plan.practitioner?.name} · {t('exercises.week', { current: Math.max(1, plan.current_week), total: plan.duration_weeks })}</p>
              <ProgressBar className="mt-3" value={total ? (done / total) * 100 : 0} label={`${done}/${total}`} />
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-fg-muted">{done}/{total} · {t('exercises.done')}</span>
                <Button size="sm" variant="ghost" onClick={() => openFile(`/patient/treatment-plans/${plan.id}/pdf`).catch((e) => toast.error(errorText(e)))}>
                  <Download />{t('exercises.pdf')}
                </Button>
              </div>
            </Card>
            {plan.exercises?.map((row) => <ExerciseRow key={row.id} row={row} />)}
          </section>
        );
      })}
      <PainReport />
    </div>
  );
}

function ExerciseRow({ row }: { row: PlanExercise }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const done = !!row.done_today;
  const toggle = useMutation({
    mutationFn: () => unwrap(api.POST('/patient/exercise-logs', { body: { treatment_plan_exercise_id: row.id, done: !done } as never })),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['my', 'plans'] }),
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Card className={cn('p-4 transition-colors', done && 'border-primary/40 bg-primary-soft/40')}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{row.exercise?.name}</h3>
          <p className="mt-0.5 text-sm font-medium text-primary">
            {t('common:units.sets', { count: row.sets })}
            {row.reps ? ` × ${t('common:units.reps', { count: row.reps })}` : ''}
            {row.hold_seconds ? ` · ${t('common:units.hold', { count: row.hold_seconds })}` : ''} · {row.frequency}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{row.exercise?.instructions}</p>
          {row.notes && <p className="mt-1 text-sm italic">{row.notes}</p>}
          <p className="mt-2 text-xs text-fg-subtle">{t('exercises.streak', { count: row.completed_days ?? 0 })}</p>
        </div>
        <button
          type="button"
          aria-pressed={done}
          aria-label={done ? t('exercises.done') : t('exercises.markDone')}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate()}
          className="cursor-pointer rounded-full p-1 text-primary disabled:opacity-50"
        >
          {done ? <CheckCircle2 className="size-9 fill-primary text-primary-fg" /> : <Circle className="size-9 text-border-strong" />}
        </button>
      </div>
    </Card>
  );
}

export function PainReport() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [pain, setPain] = useState(3);
  const save = useMutation({
    mutationFn: () => unwrap(api.POST('/patient/progress', { body: { pain_score: pain } })),
    onSuccess: () => {
      toast.success(t('exercises.saved'));
      void client.invalidateQueries({ queryKey: ['my', 'progress'] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Card className="p-4">
      <h2 className="font-semibold">{t('exercises.howFeel')}</h2>
      <label className="mt-3 block text-sm text-fg-muted" htmlFor="pain">{t('exercises.painLabel')}</label>
      <div className="mt-2 flex items-center gap-3">
        <input id="pain" type="range" min={0} max={10} value={pain} onChange={(e) => setPain(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" />
        <output htmlFor="pain" className="tabular w-8 text-center text-xl font-bold">{pain}</output>
      </div>
      <Button className="mt-3 w-full" loading={save.isPending} onClick={() => save.mutate()}>{t('exercises.save')}</Button>
    </Card>
  );
}
