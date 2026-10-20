import { api, unwrap, type Exercise } from '@physio/api';
import { Badge, Button, Card, Dialog, DialogContent, EmptyState, Field, Input, PageHeader, SearchInput, Select, Skeleton, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Accessibility, Activity, Bone, Dumbbell, Footprints, Hand, PersonStanding, Plus, Video } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { handleFormError } from '../../lib/errors';
import { useDebounced } from '../../lib/hooks';
import { useSession } from '../../lib/session';

const REGIONS = ['knee', 'shoulder', 'neck', 'back', 'hip', 'ankle', 'wrist', 'elbow', 'core', 'general'] as const;
const CATEGORIES = ['strengthening', 'flexibility', 'mobility', 'stability', 'balance', 'posture', 'cardio', 'functional'] as const;

const REGION_ICONS: Record<string, typeof Bone> = {
  knee: Bone, shoulder: Accessibility, neck: PersonStanding, back: Activity, hip: PersonStanding,
  ankle: Footprints, wrist: Hand, elbow: Hand, core: Dumbbell, general: Dumbbell,
};

/** Illustrative tile per body region (the library ships without media). */
export function RegionIcon({ region }: { region: string }) {
  const Icon = REGION_ICONS[region] ?? Dumbbell;
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-fg">
      <Icon className="size-5" />
    </span>
  );
}

export function ExercisesPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [text, setText] = useState('');
  const search = useDebounced(text, 250);
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['exercises', { search, region, category, all: true }],
    queryFn: async () =>
      (await unwrap(api.GET('/exercises', { params: { query: { search: search || undefined, body_region: (region || undefined) as never, category: (category || undefined) as never, include_inactive: can('exercises.manage') } } }))).data as Exercise[],
  });

  return (
    <div>
      <PageHeader
        title={t('exercises.title')}
        description={t('exercises.subtitle')}
        actions={can('exercises.manage') && <Button onClick={() => setEditing('new')}><Plus />{t('exercises.new')}</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput className="min-w-60 flex-1" placeholder={t('exercises.name')} aria-label={t('common:actions.search')} value={text} onChange={(e) => setText(e.target.value)} />
        <Select aria-label={t('exercises.region')} className="w-44" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">{t('exercises.allRegions')}</option>
          {REGIONS.map((r) => <option key={r} value={r}>{t(`exercises.regions.${r}`)}</option>)}
        </Select>
        <Select aria-label={t('exercises.category')} className="w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('exercises.allCategories')}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{t(`exercises.categories.${c}`)}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <Card><EmptyState icon={<Dumbbell />} title={t('exercises.empty')} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((ex) => (
            <article key={ex.id} className={`flex flex-col rounded-xl border border-border bg-surface p-4 shadow-card ${ex.is_active ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <RegionIcon region={ex.body_region} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold leading-snug">{ex.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="primary">{t(`exercises.regions.${ex.body_region}`)}</Badge>
                    <Badge>{t(`exercises.categories.${ex.category}`)}</Badge>
                    <Badge tone={ex.difficulty === 'advanced' ? 'warning' : ex.difficulty === 'intermediate' ? 'info' : 'neutral'}>{t(`exercises.difficulties.${ex.difficulty}`)}</Badge>
                  </div>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 flex-1 text-[13px] leading-relaxed text-fg-muted">{ex.instructions}</p>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-fg-muted">
                <span>
                  {t('common:units.sets', { count: ex.default_sets })}
                  {ex.default_reps && ` × ${t('common:units.reps', { count: ex.default_reps })}`}
                  {ex.default_hold_seconds && ` · ${t('common:units.hold', { count: ex.default_hold_seconds })}`}
                </span>
                <span className="flex items-center gap-1">
                  {ex.video_url && (
                    <a href={ex.video_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Video className="size-3.5" /> Video
                    </a>
                  )}
                  {can('exercises.manage') && <Button size="sm" variant="ghost" onClick={() => setEditing(ex)}>{t('common:actions.edit')}</Button>}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && <ExerciseDialog exercise={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ExerciseDialog({ exercise, onClose }: { exercise?: Exercise; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: exercise?.name ?? '',
    body_region: exercise?.body_region ?? 'knee',
    category: exercise?.category ?? 'strengthening',
    difficulty: exercise?.difficulty ?? 'beginner',
    description: exercise?.description ?? '',
    instructions: exercise?.instructions ?? '',
    default_sets: exercise?.default_sets ?? 3,
    default_reps: exercise?.default_reps ?? '',
    default_hold_seconds: exercise?.default_hold_seconds ?? '',
    video_url: exercise?.video_url ?? '',
    is_active: exercise?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, default_reps: form.default_reps === '' ? null : Number(form.default_reps), default_hold_seconds: form.default_hold_seconds === '' ? null : Number(form.default_hold_seconds), video_url: form.video_url || null, description: form.description || null };
      return exercise
        ? unwrap(api.PUT('/exercises/{exercise}', { params: { path: { exercise: exercise.id } }, body: body as never }))
        : unwrap(api.POST('/exercises', { body: body as never }));
    },
    onSuccess: () => {
      toast.success(t('exercises.saved'));
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
      onClose();
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" title={exercise ? t('exercises.edit') : t('exercises.new')} footer={<><Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button><Button loading={save.isPending} onClick={() => save.mutate()}>{t('common:actions.save')}</Button></>}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('exercises.name')} required error={errors.name} className="sm:col-span-3"><Input autoFocus value={form.name} onChange={set('name')} /></Field>
          <Field label={t('exercises.region')}><Select value={form.body_region} onChange={set('body_region')}>{REGIONS.map((r) => <option key={r} value={r}>{t(`exercises.regions.${r}`)}</option>)}</Select></Field>
          <Field label={t('exercises.category')}><Select value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(`exercises.categories.${c}`)}</option>)}</Select></Field>
          <Field label={t('exercises.difficulty')}><Select value={form.difficulty} onChange={set('difficulty')}>{['beginner', 'intermediate', 'advanced'].map((d) => <option key={d} value={d}>{t(`exercises.difficulties.${d}`)}</option>)}</Select></Field>
          <Field label={t('exercises.description')} className="sm:col-span-3"><Input value={form.description} onChange={set('description')} /></Field>
          <Field label={t('exercises.instructions')} className="sm:col-span-3"><Textarea rows={4} value={form.instructions} onChange={set('instructions')} /></Field>
          <Field label={t('plans.sets')}><Input type="number" min={1} value={form.default_sets} onChange={set('default_sets')} /></Field>
          <Field label={t('plans.reps')}><Input type="number" min={1} value={form.default_reps} onChange={set('default_reps')} /></Field>
          <Field label={t('plans.hold')}><Input type="number" min={1} value={form.default_hold_seconds} onChange={set('default_hold_seconds')} /></Field>
          <Field label={t('exercises.videoUrl')} error={errors.video_url} className="sm:col-span-3"><Input type="url" placeholder="https://" value={form.video_url} onChange={set('video_url')} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> {t('settings.active')}
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
