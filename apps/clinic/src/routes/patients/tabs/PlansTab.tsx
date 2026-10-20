import { api, unwrap, type Patient, type TreatmentPlan } from '@physio/api';
import { todayInZone } from '@physio/core';
import { Badge, Button, Card, Dialog, DialogContent, EmptyState, Field, Input, ProgressBar, Skeleton, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, ClipboardList, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { handleFormError } from '../../../lib/errors';
import { useFormat } from '../../../lib/format';
import { useSession } from '../../../lib/session';

export function PlansTab({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useSession();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['patient', patient.id, 'plans'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/treatment-plans', { params: { path: { patient: patient.id } } }))).data as TreatmentPlan[],
  });

  return (
    <div className="space-y-5">
      {can('clinical.write') && (
        <Button onClick={() => setCreating(true)}>
          <Plus />
          {t('plans.new')}
        </Button>
      )}
      {isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<ClipboardList />} title={t('plans.noPlans')} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((plan) => (
            <Link key={plan.id} to={`/treatment-plans/${plan.id}`} className="group rounded-xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-primary">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold group-hover:text-primary">{plan.title}</p>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {plan.practitioner?.name} · {f.local(plan.start_date)} · {t('plans.weeks', { count: plan.duration_weeks })}
                  </p>
                </div>
                <Badge tone={plan.status === 'active' ? 'success' : 'neutral'}>{t(`plans.statuses.${plan.status}`)}</Badge>
              </div>
              {plan.diagnosis && <p className="mt-3 line-clamp-2 text-sm text-fg-muted">{plan.diagnosis}</p>}
              <div className="mt-4 flex items-center gap-3">
                <ProgressBar value={(plan.current_week / plan.duration_weeks) * 100} label={t('plans.weekOf', { current: plan.current_week, total: plan.duration_weeks })} />
                <span className="shrink-0 text-xs font-medium text-fg-muted">{t('plans.weekOf', { current: plan.current_week, total: plan.duration_weeks })}</span>
              </div>
              <p className="mt-3 flex items-center gap-1 text-[13px] font-medium text-primary">
                {t('plans.exercises', { count: plan.exercises?.length ?? 0 })}
                <ChevronRight className="size-4 rtl:rotate-180" />
              </p>
            </Link>
          ))}
        </div>
      )}
      {creating && <PlanDialog patientId={patient.id} onClose={() => setCreating(false)} />}
    </div>
  );
}

export function PlanDialog({ patientId, onClose }: { patientId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', diagnosis: '', goals: '', start_date: todayInZone(f.tz), duration_weeks: 6, frequency_per_week: 2 });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => unwrap(api.POST('/patients/{patient}/treatment-plans', { params: { path: { patient: patientId } }, body: form as never })),
    onSuccess: (r) => {
      toast.success(t('plans.created'));
      void queryClient.invalidateQueries({ queryKey: ['patient', patientId, 'plans'] });
      navigate(`/treatment-plans/${(r as unknown as { data: TreatmentPlan }).data.id}`);
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t('plans.new')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common:actions.create')}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('plans.planTitle')} required error={errors.title} className="sm:col-span-3">
            <Input autoFocus placeholder="Knee Rehabilitation Program" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label={t('plans.startDate')} required error={errors.start_date}>
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label={t('plans.durationWeeks')}>
            <Input type="number" min={1} max={52} value={form.duration_weeks} onChange={(e) => setForm({ ...form, duration_weeks: Number(e.target.value) })} />
          </Field>
          <Field label={t('plans.frequency')}>
            <Input type="number" min={1} max={7} value={form.frequency_per_week} onChange={(e) => setForm({ ...form, frequency_per_week: Number(e.target.value) })} />
          </Field>
          <Field label={t('plans.diagnosis')} className="sm:col-span-3">
            <Textarea rows={2} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
          </Field>
          <Field label={t('plans.goals')} className="sm:col-span-3">
            <Textarea rows={2} value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
