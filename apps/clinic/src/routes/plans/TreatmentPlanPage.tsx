import { api, unwrap, type Exercise, type PlanExercise, type TreatmentPlan } from '@physio/api';
import { addDays, todayInZone } from '@physio/core';
import { Badge, Button, Card, CardContent, CardHeader, ConfirmDialog, Dialog, DialogContent, EmptyState, ErrorState, Input, PageLoader, ProgressBar, SearchInput, Select, toast, Tooltip } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Dumbbell, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { PdfButton } from '../../components/PdfButton';
import { toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useSession } from '../../lib/session';
import { RegionIcon } from '../exercises/ExercisesPage';

export function TreatmentPlanPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { planId } = useParams();
  const id = Number(planId);
  const { can } = useSession();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: plan, isLoading, error } = useQuery({
    queryKey: ['treatment-plan', id],
    queryFn: async () => (await unwrap(api.GET('/treatment-plans/{plan}', { params: { path: { plan: id } } }))).data as TreatmentPlan,
  });

  const { data: adherence } = useQuery({
    queryKey: ['treatment-plan', id, 'adherence'],
    queryFn: async () => (await unwrap(api.GET('/treatment-plans/{plan}/adherence', { params: { path: { plan: id }, query: { days: 28 } as never } })) as unknown as { data: { days: number; exercise_count: number; logs: { plan_exercise_id: number; date: string }[] } }).data,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => unwrap(api.PUT('/treatment-plans/{plan}', { params: { path: { plan: id } }, body: { status } as never })),
    onSuccess: () => {
      toast.success(t('plans.saved'));
      void queryClient.invalidateQueries({ queryKey: ['treatment-plan', id] });
    },
    onError: toastError,
  });

  const remove = useMutation({
    mutationFn: (rowId: number) => unwrap(api.DELETE('/treatment-plans/{plan}/exercises/{row}', { params: { path: { plan: id, row: rowId } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['treatment-plan', id] }),
    onError: toastError,
  });

  if (isLoading) return <PageLoader />;
  if (error || !plan) return <ErrorState title={t('common:errors.notFound')} />;

  const editable = can('clinical.write');
  const today = todayInZone(f.tz);
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27));
  const doneByDay = new Map<string, number>();
  adherence?.logs.forEach((l) => doneByDay.set(l.date, (doneByDay.get(l.date) ?? 0) + 1));

  return (
    <div className="space-y-5">
      <Link to={`/patients/${plan.patient?.id}?tab=plans`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {plan.patient?.full_name}
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{plan.title}</h1>
              <Badge tone={plan.status === 'active' ? 'success' : 'neutral'}>{t(`plans.statuses.${plan.status}`)}</Badge>
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {plan.patient?.full_name} · {plan.practitioner?.name} · {t('plans.startDate')}: {f.local(plan.start_date)} · {t('plans.weeks', { count: plan.duration_weeks })} · {plan.frequency_per_week}×/wk
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PdfButton path={`/treatment-plans/${id}/pdf`} label={t('plans.printHep')} />
            {editable && (
              <Select aria-label={t('plans.status')} className="h-10 w-40" value={plan.status} onChange={(e) => updateStatus.mutate(e.target.value)}>
                {['draft', 'active', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{t(`plans.statuses.${s}`)}</option>)}
              </Select>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="shrink-0 whitespace-nowrap text-[13px] font-medium text-primary">{t('plans.weekOf', { current: plan.current_week, total: plan.duration_weeks })}</span>
          <ProgressBar value={(plan.current_week / plan.duration_weeks) * 100} label={t('plans.weekOf', { current: plan.current_week, total: plan.duration_weeks })} />
          <span className="tabular text-[13px] font-semibold">{Math.round((plan.current_week / plan.duration_weeks) * 100)}%</span>
        </div>
        {(plan.diagnosis || plan.goals) && (
          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            {plan.diagnosis && <div><p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t('plans.diagnosis')}</p><p className="mt-1">{plan.diagnosis}</p></div>}
            {plan.goals && <div><p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t('plans.goals')}</p><p className="mt-1">{plan.goals}</p></div>}
          </div>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title={t('plans.exercises', { count: plan.exercises?.length ?? 0 })}
            action={editable && <Button size="sm" onClick={() => setAdding(true)}><Plus />{t('plans.addExercise')}</Button>}
          />
          <CardContent className="px-3">
            {!plan.exercises?.length ? (
              <EmptyState icon={<Dumbbell />} title={t('plans.noExercises')} />
            ) : (
              <ul className="divide-y divide-border">
                {plan.exercises.map((row) => (
                  <PlanRow key={row.id} planId={id} row={row} editable={editable} onRemove={() => remove.mutateAsync(row.id)} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={t('plans.adherence')} description={t('plans.adherenceHint')} />
          <CardContent>
            <div className="grid grid-cols-7 gap-1.5" role="list" aria-label={t('plans.adherence')}>
              {days.map((d) => {
                const done = doneByDay.get(d) ?? 0;
                const ratio = adherence?.exercise_count ? done / adherence.exercise_count : 0;
                return (
                  <Tooltip key={d} content={`${f.local(d, 'EEE d MMM')}: ${done}/${adherence?.exercise_count ?? 0}`}>
                    <span
                      role="listitem"
                      tabIndex={0}
                      aria-label={`${f.local(d, 'd MMM')}: ${done}/${adherence?.exercise_count ?? 0}`}
                      className="aspect-square rounded-md border border-border"
                      style={{ background: ratio === 0 ? 'var(--surface-3)' : `color-mix(in oklab, var(--primary) ${Math.round(25 + ratio * 75)}%, var(--surface))` }}
                    />
                  </Tooltip>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-fg-muted">
              {doneByDay.size}/{days.length} {t('reports.days')}
            </p>
          </CardContent>
        </Card>
      </div>

      {adding && <AddExerciseDialog planId={id} existing={plan.exercises?.map((e) => e.exercise?.id ?? 0) ?? []} onClose={() => setAdding(false)} />}
    </div>
  );
}

function PlanRow({ planId, row, editable, onRemove }: { planId: number; row: PlanExercise; editable: boolean; onRemove: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({ sets: row.sets, reps: row.reps ?? '', hold_seconds: row.hold_seconds ?? '', frequency: row.frequency });
  const dirty = values.sets !== row.sets || values.reps !== (row.reps ?? '') || values.hold_seconds !== (row.hold_seconds ?? '') || values.frequency !== row.frequency;

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PUT('/treatment-plans/{plan}/exercises/{row}', {
          params: { path: { plan: planId, row: row.id } },
          body: { sets: Number(values.sets), reps: values.reps === '' ? null : Number(values.reps), hold_seconds: values.hold_seconds === '' ? null : Number(values.hold_seconds), frequency: values.frequency } as never,
        }),
      ),
    onSuccess: () => {
      toast.success(t('plans.saved'));
      void queryClient.invalidateQueries({ queryKey: ['treatment-plan', planId] });
    },
    onError: toastError,
  });

  return (
    <li className="flex flex-wrap items-center gap-3 px-2 py-3">
      <RegionIcon region={row.exercise?.body_region ?? 'general'} />
      <div className="min-w-40 flex-1">
        <p className="text-sm font-semibold">{row.exercise?.name}</p>
        <p className="line-clamp-1 text-xs text-fg-muted">{row.exercise?.description}</p>
      </div>
      {editable ? (
        <div className="flex flex-wrap items-end gap-2">
          <MiniField label={t('plans.sets')}>
            <Input type="number" min={1} className="h-9 w-16" value={values.sets} onChange={(e) => setValues({ ...values, sets: Number(e.target.value) })} />
          </MiniField>
          <MiniField label={t('plans.reps')}>
            <Input type="number" min={1} placeholder="—" className="h-9 w-16" value={values.reps} onChange={(e) => setValues({ ...values, reps: e.target.value === '' ? '' : Number(e.target.value) })} />
          </MiniField>
          <MiniField label={t('plans.hold')}>
            <Input type="number" min={1} placeholder="—" className="h-9 w-16" value={values.hold_seconds} onChange={(e) => setValues({ ...values, hold_seconds: e.target.value === '' ? '' : Number(e.target.value) })} />
          </MiniField>
          <MiniField label={t('plans.frequencyLabel')}>
            <Input className="h-9 w-28" value={values.frequency} onChange={(e) => setValues({ ...values, frequency: e.target.value })} />
          </MiniField>
          {dirty && <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>{t('common:actions.save')}</Button>}
          <ConfirmDialog
            tone="danger"
            title={t('plans.remove')}
            description={row.exercise?.name}
            confirmLabel={t('plans.remove')}
            cancelLabel={t('common:actions.cancel')}
            onConfirm={onRemove}
            trigger={<Button variant="ghost" size="icon-sm" aria-label={`${t('plans.remove')} ${row.exercise?.name}`}><Trash2 /></Button>}
          />
        </div>
      ) : (
        <span className="text-sm text-fg-muted">
          {t('common:units.sets', { count: row.sets })}
          {row.reps && ` × ${t('common:units.reps', { count: row.reps })}`}
          {row.hold_seconds && ` · ${t('common:units.hold', { count: row.hold_seconds })}`} · {row.frequency}
        </span>
      )}
    </li>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px] font-medium text-fg-subtle">
      {label}
      {children}
    </label>
  );
}

function AddExerciseDialog({ planId, existing, onClose }: { planId: number; existing: number[]; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');

  const { data } = useQuery({
    queryKey: ['exercises', { search, region }],
    queryFn: async () => (await unwrap(api.GET('/exercises', { params: { query: { search: search || undefined, body_region: (region || undefined) as never } } }))).data as Exercise[],
  });

  const add = useMutation({
    mutationFn: (exerciseId: number) => unwrap(api.POST('/treatment-plans/{plan}/exercises', { params: { path: { plan: planId } }, body: { exercise_id: exerciseId, frequency: '2x daily' } as never })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['treatment-plan', planId] });
      toast.success(t('plans.saved'));
    },
    onError: toastError,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" title={t('plans.addExercise')} footer={<Button onClick={onClose}>{t('common:actions.close')}</Button>}>
        <div className="mb-3 flex gap-2">
          <SearchInput className="flex-1" autoFocus placeholder={t('exercises.name')} aria-label={t('common:actions.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label={t('exercises.region')} className="w-40" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{t('exercises.allRegions')}</option>
            {Object.keys(t('exercises.regions', { returnObjects: true }) as object).map((r) => <option key={r} value={r}>{t(`exercises.regions.${r}`)}</option>)}
          </Select>
        </div>
        <ul className="divide-y divide-border">
          {data?.map((ex) => {
            const added = existing.includes(ex.id);
            return (
              <li key={ex.id} className="flex items-center gap-3 py-2.5">
                <RegionIcon region={ex.body_region} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{ex.name}</p>
                  <p className="text-xs text-fg-muted">{t(`exercises.regions.${ex.body_region}`)} · {t(`exercises.categories.${ex.category}`)}</p>
                </div>
                <Button size="sm" variant={added ? 'ghost' : 'secondary'} disabled={added} loading={add.isPending && add.variables === ex.id} onClick={() => add.mutate(ex.id)}>
                  {added ? '✓' : t('common:actions.add')}
                </Button>
              </li>
            );
          })}
        </ul>
        {data?.length === 0 && <EmptyState title={t('exercises.empty')} />}
      </DialogContent>
    </Dialog>
  );
}

