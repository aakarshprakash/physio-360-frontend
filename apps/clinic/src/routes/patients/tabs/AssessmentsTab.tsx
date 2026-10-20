import { api, unwrap, type Assessment, type Patient } from '@physio/api';
import { Badge, Button, Card, CardContent, ConfirmDialog, Dialog, DialogContent, EmptyState, Field, Input, Select, Skeleton, Table, Td, Textarea, Th, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Lock, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { handleFormError, toastError } from '../../../lib/errors';
import { useFormat } from '../../../lib/format';
import { useSession } from '../../../lib/session';

interface Findings {
  rom?: { joint: string; movement: string; degrees: number | null }[];
  strength?: { muscle: string; grade: string }[];
  special_tests?: { name: string; result: 'positive' | 'negative' | 'inconclusive' }[];
  observations?: string;
}

export function AssessmentsTab({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { can, session } = useSession();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['patient', patient.id, 'assessments'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/assessments', { params: { path: { patient: patient.id } } }))).data as Assessment[],
  });

  const sign = useMutation({
    mutationFn: (id: number) => unwrap(api.POST('/assessments/{assessment}/sign', { params: { path: { assessment: id } } })),
    onSuccess: () => {
      toast.success(t('clinical.noteSigned'));
      void queryClient.invalidateQueries({ queryKey: ['patient', patient.id, 'assessments'] });
    },
    onError: toastError,
  });

  return (
    <div className="space-y-5">
      {can('clinical.write') && (
        <Button onClick={() => setCreating(true)}>
          <Plus />
          {t('clinical.newAssessment')}
        </Button>
      )}
      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<ClipboardCheck />} title={t('clinical.noAssessments')} />
        </Card>
      ) : (
        data.map((a) => {
          const findings = (a.findings ?? {}) as Findings;
          return (
            <Card key={a.id}>
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.chief_complaint}</p>
                  <p className="text-xs text-fg-muted">
                    {f.instant(a.assessed_at)} · {a.practitioner?.name}
                  </p>
                </div>
                {a.pain_score != null && <Badge tone="warning">{t('clinical.painScore')}: {a.pain_score}</Badge>}
                {a.status === 'signed' ? (
                  <Badge tone="success">
                    <Lock className="size-3" />
                    {t('common:status.signed')}
                  </Badge>
                ) : (
                  <>
                    <Badge>{t('clinical.draft')}</Badge>
                    {a.practitioner?.id === session.user.id && (
                      <ConfirmDialog
                        title={t('clinical.sign')}
                        description={t('clinical.signConfirm')}
                        confirmLabel={t('clinical.sign')}
                        cancelLabel={t('common:actions.cancel')}
                        onConfirm={() => sign.mutateAsync(a.id)}
                        trigger={<Button size="sm" variant="outline"><Lock />{t('clinical.sign')}</Button>}
                      />
                    )}
                  </>
                )}
              </div>
              <CardContent className="space-y-4 pt-4 text-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  {a.history && <Block title={t('clinical.history')}>{a.history}</Block>}
                  {a.pain_location && <Block title={t('clinical.painLocation')}>{a.pain_location}</Block>}
                  {a.diagnosis && <Block title={t('clinical.diagnosis')}>{a.diagnosis}</Block>}
                  {a.goals && <Block title={t('clinical.goals')}>{a.goals}</Block>}
                  {findings.observations && <Block title={t('clinical.observations')}>{findings.observations}</Block>}
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {!!findings.rom?.length && (
                    <MiniTable title={t('clinical.rom')} head={[t('clinical.joint'), t('clinical.movement'), t('clinical.degrees')]} rows={findings.rom.map((r) => [r.joint, r.movement, r.degrees != null ? `${r.degrees}°` : '—'])} />
                  )}
                  {!!findings.strength?.length && (
                    <MiniTable title={t('clinical.strength')} head={[t('clinical.muscle'), t('clinical.grade')]} rows={findings.strength.map((r) => [r.muscle, r.grade])} />
                  )}
                  {!!findings.special_tests?.length && (
                    <MiniTable title={t('clinical.specialTests')} head={[t('clinical.testName'), t('clinical.result')]} rows={findings.special_tests.map((r) => [r.name, t(`clinical.results.${r.result}`)])} />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
      {creating && <AssessmentDialog patientId={patient.id} onClose={() => setCreating(false)} />}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</h4>
      <p className="mt-1 whitespace-pre-line leading-relaxed">{children}</p>
    </div>
  );
}

function MiniTable({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <p className="bg-surface-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{title}</p>
      <Table>
        <thead>
          <tr>{head.map((h) => <Th key={h} className="bg-surface py-1.5 normal-case">{h}</Th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <Td key={j} className="py-1.5">{c}</Td>)}</tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function AssessmentDialog({ patientId, onClose }: { patientId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [base, setBase] = useState({ chief_complaint: '', history: '', pain_score: '', pain_location: '', diagnosis: '', goals: '', observations: '' });
  const [rom, setRom] = useState([{ joint: '', movement: '', degrees: '' }]);
  const [strength, setStrength] = useState([{ muscle: '', grade: '' }]);
  const [tests, setTests] = useState([{ name: '', result: 'negative' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (sign: boolean) =>
      unwrap(
        api.POST('/patients/{patient}/assessments', {
          params: { path: { patient: patientId } },
          body: {
            chief_complaint: base.chief_complaint,
            history: base.history || null,
            pain_score: base.pain_score === '' ? null : Number(base.pain_score),
            pain_location: base.pain_location || null,
            diagnosis: base.diagnosis || null,
            goals: base.goals || null,
            findings: {
              rom: rom.filter((r) => r.joint && r.movement).map((r) => ({ ...r, degrees: r.degrees === '' ? null : Number(r.degrees) })),
              strength: strength.filter((s) => s.muscle && s.grade),
              special_tests: tests.filter((x) => x.name),
              observations: base.observations || null,
            },
            sign,
          } as never,
        }),
      ),
    onSuccess: () => {
      toast.success(t('clinical.assessmentSaved'));
      void queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      onClose();
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  const rowEditor = <T extends Record<string, string>>(rows: T[], set: (r: T[]) => void, fields: { key: keyof T; label: string; type?: 'number' | 'result'; className?: string }[], blank: T, title: string) => (
    <fieldset className="space-y-2">
      <legend className="text-[13px] font-semibold">{title}</legend>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          {fields.map((fl) =>
            fl.type === 'result' ? (
              <Select key={String(fl.key)} aria-label={fl.label} className={fl.className} value={row[fl.key]} onChange={(e) => set(rows.map((r, j) => (j === i ? { ...r, [fl.key]: e.target.value } : r)))}>
                {['positive', 'negative', 'inconclusive'].map((v) => <option key={v} value={v}>{t(`clinical.results.${v}`)}</option>)}
              </Select>
            ) : (
              <Input key={String(fl.key)} aria-label={fl.label} placeholder={fl.label} type={fl.type ?? 'text'} className={fl.className} value={row[fl.key]} onChange={(e) => set(rows.map((r, j) => (j === i ? { ...r, [fl.key]: e.target.value } : r)))} />
            ),
          )}
          <Button variant="ghost" size="icon" aria-label={t('common:actions.delete')} onClick={() => set(rows.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => set([...rows, blank])}>
        <Plus />
        {t('clinical.addRow')}
      </Button>
    </fieldset>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="xl"
        title={t('clinical.newAssessment')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button variant="outline" loading={save.isPending && !save.variables} onClick={() => save.mutate(false)}>{t('clinical.saveDraft')}</Button>
            <Button loading={save.isPending && save.variables} onClick={() => save.mutate(true)}><Lock />{t('clinical.saveAndSign')}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1fr_140px_1fr]">
            <Field label={t('clinical.chiefComplaint')} required error={errors.chief_complaint}>
              <Input autoFocus value={base.chief_complaint} onChange={(e) => setBase({ ...base, chief_complaint: e.target.value })} />
            </Field>
            <Field label={t('clinical.painScore')}>
              <Input type="number" min={0} max={10} value={base.pain_score} onChange={(e) => setBase({ ...base, pain_score: e.target.value })} />
            </Field>
            <Field label={t('clinical.painLocation')}>
              <Input value={base.pain_location} onChange={(e) => setBase({ ...base, pain_location: e.target.value })} />
            </Field>
          </div>
          <Field label={t('clinical.history')}>
            <Textarea rows={3} value={base.history} onChange={(e) => setBase({ ...base, history: e.target.value })} />
          </Field>
          <div className="grid gap-5 lg:grid-cols-2">
            {rowEditor(rom, setRom, [{ key: 'joint', label: t('clinical.joint') }, { key: 'movement', label: t('clinical.movement') }, { key: 'degrees', label: t('clinical.degrees'), type: 'number', className: 'w-24' }], { joint: '', movement: '', degrees: '' }, t('clinical.rom'))}
            {rowEditor(strength, setStrength, [{ key: 'muscle', label: t('clinical.muscle') }, { key: 'grade', label: t('clinical.grade'), className: 'w-28' }], { muscle: '', grade: '' }, t('clinical.strength'))}
            {rowEditor(tests, setTests, [{ key: 'name', label: t('clinical.testName') }, { key: 'result', label: t('clinical.result'), type: 'result', className: 'w-40' }], { name: '', result: 'negative' }, t('clinical.specialTests'))}
            <Field label={t('clinical.observations')}>
              <Textarea rows={4} value={base.observations} onChange={(e) => setBase({ ...base, observations: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('clinical.diagnosis')}>
              <Textarea rows={2} value={base.diagnosis} onChange={(e) => setBase({ ...base, diagnosis: e.target.value })} />
            </Field>
            <Field label={t('clinical.goals')}>
              <Textarea rows={2} value={base.goals} onChange={(e) => setBase({ ...base, goals: e.target.value })} />
            </Field>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
