import { api, unwrap, type Patient, type ProgressEntry } from '@physio/api';
import { todayInZone } from '@physio/core';
import { Button, Card, CardContent, CardHeader, Dialog, DialogContent, EmptyState, Field, Input, Skeleton, Table, Td, Th, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart as LineIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, useAxisProps } from '../../../components/charts';
import { handleFormError } from '../../../lib/errors';
import { useFormat } from '../../../lib/format';
import { useSession } from '../../../lib/session';

export function ProgressTab({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useSession();
  const { palette, axis } = useAxisProps();
  const [recording, setRecording] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['patient', patient.id, 'progress'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/progress', { params: { path: { patient: patient.id } } }))).data as ProgressEntry[],
  });

  // One point per day: the last pain score recorded that day.
  const pain = Object.values(
    (data ?? []).filter((e) => e.pain_score != null).reduce<Record<string, { date: string; pain: number }>>((acc, e) => {
      acc[e.recorded_on] = { date: e.recorded_on, pain: e.pain_score! };
      return acc;
    }, {}),
  );
  const fn = (data ?? []).filter((e) => e.function_score != null).map((e) => ({ date: e.recorded_on, score: e.function_score! }));

  if (isLoading) return <Skeleton className="h-72 rounded-xl" />;

  return (
    <div className="space-y-5">
      {can('clinical.write') && (
        <Button onClick={() => setRecording(true)}>
          <Plus />
          {t('clinical.recordProgress')}
        </Button>
      )}
      {!data?.length ? (
        <Card>
          <EmptyState icon={<LineIcon />} title={t('clinical.noProgress')} />
        </Card>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            {/* Two measures on different scales -> two charts, never a dual axis. */}
            <Card>
              <CardHeader title={t('clinical.painScore')} description="NPRS · 0 = no pain" />
              <CardContent>
                <div className="h-60" role="img" aria-label={`${t('clinical.painScore')}: ${pain.map((p) => `${p.date} ${p.pain}`).join(', ')}`}>
                  <ResponsiveContainer>
                    <LineChart data={pain} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke={palette.grid} />
                      <XAxis dataKey="date" {...axis} tickFormatter={(d) => f.local(d, 'd MMM')} minTickGap={16} />
                      <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} {...axis} width={36} />
                      <Tooltip cursor={{ stroke: palette.cursor }} content={(p) => <ChartTooltip {...p} formatValue={(v) => `${v}/10`} formatLabel={(l) => f.local(l, 'd MMM yyyy')} />} />
                      <Line type="monotone" dataKey="pain" name={t('clinical.painScore')} stroke={palette.series[0]} strokeWidth={2} dot={{ r: 4, fill: palette.series[0], stroke: palette.surface, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            {fn.length > 0 && (
              <Card>
                <CardHeader title={t('clinical.functionScore')} />
                <CardContent>
                  <div className="h-60" role="img" aria-label={t('clinical.functionScore')}>
                    <ResponsiveContainer>
                      <LineChart data={fn} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} stroke={palette.grid} />
                        <XAxis dataKey="date" {...axis} tickFormatter={(d) => f.local(d, 'd MMM')} minTickGap={16} />
                        <YAxis domain={[0, 100]} {...axis} width={36} />
                        <Tooltip cursor={{ stroke: palette.cursor }} content={(p) => <ChartTooltip {...p} formatValue={(v) => `${v}`} formatLabel={(l) => f.local(l, 'd MMM yyyy')} />} />
                        <Line type="monotone" dataKey="score" name={t('clinical.functionScore')} stroke={palette.series[1]} strokeWidth={2} dot={{ r: 4, fill: palette.series[1], stroke: palette.surface, strokeWidth: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>{t('appointments.date')}</Th>
                  <Th>{t('clinical.painScore')}</Th>
                  <Th>{t('clinical.functionScore')}</Th>
                  <Th>{t('clinical.measure')}</Th>
                  <Th>{t('patients.notes')}</Th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((e) => (
                  <tr key={e.id}>
                    <Td className="tabular whitespace-nowrap">{f.local(e.recorded_on)}</Td>
                    <Td className="tabular">{e.pain_score ?? '—'}</Td>
                    <Td className="tabular">{e.function_score ?? '—'}</Td>
                    <Td>{e.measure ? `${e.measure}${e.value != null ? `: ${e.value}${e.unit ?? ''}` : ''}` : '—'}</Td>
                    <Td className="text-fg-muted">{e.notes ?? '—'}{e.recorded_by && <span className="block text-xs text-fg-subtle">{e.recorded_by}</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
      {recording && <RecordDialog patientId={patient.id} onClose={() => setRecording(false)} />}
    </div>
  );
}

function RecordDialog({ patientId, onClose }: { patientId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ recorded_on: todayInZone(f.tz), pain_score: '', function_score: '', measure: '', value: '', unit: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/patients/{patient}/progress', {
          params: { path: { patient: patientId } },
          body: Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : ['pain_score', 'function_score', 'value'].includes(k) ? Number(v) : v])) as never,
        }),
      ),
    onSuccess: () => {
      toast.success(t('common:actions.save'));
      void queryClient.invalidateQueries({ queryKey: ['patient', patientId, 'progress'] });
      onClose();
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t('clinical.recordProgress')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common:actions.save')}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('appointments.date')} error={errors.recorded_on}>
            <Input type="date" value={form.recorded_on} onChange={set('recorded_on')} />
          </Field>
          <Field label={t('clinical.painScore')} error={errors.pain_score}>
            <Input type="number" min={0} max={10} value={form.pain_score} onChange={set('pain_score')} />
          </Field>
          <Field label={t('clinical.functionScore')} error={errors.function_score}>
            <Input type="number" min={0} max={100} value={form.function_score} onChange={set('function_score')} />
          </Field>
          <Field label={t('clinical.measure')}>
            <Input placeholder="Knee flexion ROM" value={form.measure} onChange={set('measure')} />
          </Field>
          <Field label={t('clinical.value')}>
            <Input type="number" value={form.value} onChange={set('value')} />
          </Field>
          <Field label={t('clinical.unit')}>
            <Input placeholder="°" value={form.unit} onChange={set('unit')} />
          </Field>
          <Field label={t('patients.notes')} className="sm:col-span-3">
            <Input value={form.notes} onChange={set('notes')} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
