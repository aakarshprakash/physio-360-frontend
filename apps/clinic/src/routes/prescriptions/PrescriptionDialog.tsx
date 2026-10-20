import { api, unwrap, type Assessment, type PatientSummary, type Prescription, type TreatmentPlan } from '@physio/api';
import { todayInZone } from '@physio/core';
import { Button, Dialog, DialogContent, Field, Input, Select, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PatientPicker } from '../../components/common';
import { handleFormError } from '../../lib/errors';
import { useSession } from '../../lib/session';

type Modality = Prescription['modalities'][number];
type RxExercise = Prescription['exercises'][number];

/** Common physiotherapy modalities and techniques, offered as suggestions (free text is allowed). */
const MODALITY_SUGGESTIONS = [
  'Interferential therapy (IFT)', 'TENS', 'Therapeutic ultrasound', 'Short-wave diathermy', 'Low-level laser therapy',
  'Moist heat pack', 'Cryotherapy', 'Cervical traction', 'Lumbar traction', 'Shockwave therapy', 'Dry needling',
  'Kinesio taping', 'Joint mobilisation (Maitland)', 'Soft tissue release', 'Muscle energy technique', 'Neural mobilisation',
  'Gait training', 'Balance training', 'Electrical muscle stimulation (EMS)', 'Paraffin wax bath',
];

interface Props {
  patient?: { id: number; full_name: string; mrn?: string };
  assessmentId?: number | null;
  prescription?: Prescription;
  onClose: () => void;
  onSaved: (prescription: Prescription) => void;
}

export function PrescriptionDialog({ patient: fixedPatient, assessmentId, prescription, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const listId = useId();
  const [patient, setPatient] = useState<{ id: number; full_name: string; mrn?: string } | null>(fixedPatient ?? prescription?.patient ?? null);
  const [form, setForm] = useState({
    assessment_id: prescription?.assessment_id ?? assessmentId ?? null,
    treatment_plan_id: prescription?.treatment_plan_id ?? null,
    issued_on: prescription?.issued_on ?? todayInZone(session.tenant.timezone),
    review_on: prescription?.review_on ?? '',
    diagnosis: prescription?.diagnosis ?? '',
    advice: prescription?.advice ?? '',
    precautions: prescription?.precautions ?? '',
  });
  const [modalities, setModalities] = useState<Modality[]>(prescription?.modalities ?? []);
  const [exercises, setExercises] = useState<RxExercise[]>(prescription?.exercises ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const patientId = patient?.id;

  const { data: assessments } = useQuery({
    queryKey: ['patient', patientId, 'assessments'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/assessments', { params: { path: { patient: patientId! } } }))).data as Assessment[],
    enabled: !!patientId,
  });
  const { data: plans } = useQuery({
    queryKey: ['patient', patientId, 'plans'],
    queryFn: async () => (await unwrap(api.GET('/patients/{patient}/treatment-plans', { params: { path: { patient: patientId! } } }))).data as TreatmentPlan[],
    enabled: !!patientId,
  });

  // Fill the diagnosis from the chosen assessment when the field is still empty.
  const chooseAssessment = (id: number | null) => {
    const a = assessments?.find((x) => x.id === id);
    setForm((f) => ({ ...f, assessment_id: id, diagnosis: f.diagnosis || a?.diagnosis || '' }));
  };

  const choosePlan = async (id: number | null) => {
    setForm((f) => ({ ...f, treatment_plan_id: id }));
    if (!id || exercises.length) return;
    const plan = (await unwrap(api.GET('/treatment-plans/{plan}', { params: { path: { plan: id } } }))).data as TreatmentPlan;
    setExercises(
      (plan.exercises ?? []).map((row) => ({
        name: row.exercise?.name ?? '',
        dosage: [`${row.sets} × ${row.reps ?? `${row.hold_seconds ?? 0}s`}`, row.frequency].filter(Boolean).join(' · '),
        notes: row.notes,
      })),
    );
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        review_on: form.review_on || null,
        diagnosis: form.diagnosis || null,
        advice: form.advice || null,
        precautions: form.precautions || null,
        modalities: modalities.filter((m) => m.name.trim()),
        exercises: exercises.filter((e) => e.name.trim()),
      };
      return prescription
        ? unwrap(api.PUT('/prescriptions/{prescription}', { params: { path: { prescription: prescription.id } }, body: body as never }))
        : unwrap(api.POST('/patients/{patient}/prescriptions', { params: { path: { patient: patientId! } }, body: body as never }));
    },
    onSuccess: (r) => {
      const saved = (r as unknown as { data: Prescription }).data;
      toast.success(prescription ? t('prescriptions.saved') : t('prescriptions.created', { number: saved.number }));
      void queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['patient', patientId, 'prescriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['consultations'] });
      onSaved(saved);
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  const setText = (k: 'issued_on' | 'review_on' | 'diagnosis' | 'advice' | 'precautions') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="xl"
        title={prescription ? `${t('prescriptions.edit')} · ${prescription.number}` : t('prescriptions.new')}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={save.isPending} disabled={!patientId} onClick={() => save.mutate()}>{t('common:actions.save')}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {!fixedPatient && !prescription && (
              <Field label={t('consultations.patient')} required className="sm:col-span-2">
                <PatientPicker value={patient} onChange={(p: PatientSummary | null) => setPatient(p)} />
              </Field>
            )}
            <Field label={t('prescriptions.basedOn')}>
              <Select value={form.assessment_id ?? ''} onChange={(e) => chooseAssessment(e.target.value ? Number(e.target.value) : null)} disabled={!patientId}>
                <option value="">{t('prescriptions.none')}</option>
                {assessments?.map((a) => <option key={a.id} value={a.id}>{a.chief_complaint}</option>)}
              </Select>
            </Field>
            <Field label={t('prescriptions.plan')}>
              <Select value={form.treatment_plan_id ?? ''} onChange={(e) => void choosePlan(e.target.value ? Number(e.target.value) : null)} disabled={!patientId}>
                <option value="">{t('prescriptions.none')}</option>
                {plans?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </Field>
            <Field label={t('prescriptions.issuedOn')} error={errors.issued_on}>
              <Input type="date" value={form.issued_on} onChange={setText('issued_on')} />
            </Field>
            <Field label={t('prescriptions.reviewOn')} error={errors.review_on}>
              <Input type="date" value={form.review_on} onChange={setText('review_on')} />
            </Field>
            <Field label={t('prescriptions.diagnosis')} className="sm:col-span-2" error={errors.diagnosis}>
              <Textarea rows={2} value={form.diagnosis} onChange={setText('diagnosis')} />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t('prescriptions.modalities')}</legend>
            <datalist id={listId}>{MODALITY_SUGGESTIONS.map((m) => <option key={m} value={m} />)}</datalist>
            <div className="space-y-2">
              {modalities.map((m, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[2fr_2fr_90px_90px_auto] sm:border-0 sm:p-0">
                  <Input aria-label={t('prescriptions.modality')} placeholder={t('prescriptions.modality')} list={listId} value={m.name} onChange={(e) => setModalities(modalities.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <Input aria-label={t('prescriptions.parameters')} placeholder={t('prescriptions.parameters')} value={m.parameters ?? ''} onChange={(e) => setModalities(modalities.map((x, j) => (j === i ? { ...x, parameters: e.target.value || null } : x)))} />
                  <Input aria-label={t('prescriptions.minutes')} placeholder={t('prescriptions.minutes')} type="number" min={1} inputMode="numeric" value={m.duration_minutes ?? ''} onChange={(e) => setModalities(modalities.map((x, j) => (j === i ? { ...x, duration_minutes: e.target.value ? Number(e.target.value) : null } : x)))} />
                  <Input aria-label={t('prescriptions.sessions')} placeholder={t('prescriptions.sessions')} type="number" min={1} inputMode="numeric" value={m.sessions ?? ''} onChange={(e) => setModalities(modalities.map((x, j) => (j === i ? { ...x, sessions: e.target.value ? Number(e.target.value) : null } : x)))} />
                  <Button variant="ghost" size="icon" aria-label={t('prescriptions.remove')} onClick={() => setModalities(modalities.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setModalities([...modalities, { name: '', parameters: null, duration_minutes: null, sessions: null }])}>
                <Plus />
                {t('prescriptions.addModality')}
              </Button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t('prescriptions.exercises')}</legend>
            <div className="space-y-2">
              {exercises.map((x, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[2fr_1.5fr_2fr_auto] sm:border-0 sm:p-0">
                  <Input aria-label={t('prescriptions.exercise')} placeholder={t('prescriptions.exercise')} value={x.name} onChange={(e) => setExercises(exercises.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
                  <Input aria-label={t('prescriptions.dosage')} placeholder="3 × 15 · 2x daily" value={x.dosage ?? ''} onChange={(e) => setExercises(exercises.map((y, j) => (j === i ? { ...y, dosage: e.target.value || null } : y)))} />
                  <Input aria-label={t('prescriptions.exerciseNotes')} placeholder={t('prescriptions.exerciseNotes')} value={x.notes ?? ''} onChange={(e) => setExercises(exercises.map((y, j) => (j === i ? { ...y, notes: e.target.value || null } : y)))} />
                  <Button variant="ghost" size="icon" aria-label={t('prescriptions.remove')} onClick={() => setExercises(exercises.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setExercises([...exercises, { name: '', dosage: null, notes: null }])}>
                <Plus />
                {t('prescriptions.addExercise')}
              </Button>
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('prescriptions.advice')} error={errors.advice}>
              <Textarea rows={4} value={form.advice} onChange={setText('advice')} />
            </Field>
            <Field label={t('prescriptions.precautions')} error={errors.precautions}>
              <Textarea rows={4} value={form.precautions} onChange={setText('precautions')} />
            </Field>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
