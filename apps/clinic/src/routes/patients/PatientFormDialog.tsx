import { zodResolver } from '@hookform/resolvers/zod';
import { api, unwrap, type Patient } from '@physio/api';
import { Button, Dialog, DialogContent, Field, Input, Select, Textarea, toast } from '@physio/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useStaff } from '../../lib/catalog';
import { handleFormError } from '../../lib/errors';
import { useDefaultBranchId, useSession } from '../../lib/session';

const schema = z.object({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'undisclosed', '']).optional(),
  phone: z.string().trim().regex(/^[+0-9 ()-]{6,32}$/),
  email: z.union([z.email(), z.literal('')]).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  occupation: z.string().optional(),
  referred_by: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  medical_history: z.string().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),
  preferred_language: z.string(),
  primary_branch_id: z.coerce.number().int().positive(),
  primary_practitioner_id: z.string().optional(),
});
type Values = z.input<typeof schema>;

interface Props {
  patient?: Patient;
  initial?: Partial<Values>;
  onClose: () => void;
  onSaved: (patient: Patient) => void;
}

export function PatientFormDialog({ patient, initial, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { session, can } = useSession();
  const queryClient = useQueryClient();
  const defaultBranch = useDefaultBranchId();
  const { data: practitioners } = useStaff({ practitionersOnly: true });
  const clinical = can('clinical.view');

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: patient?.first_name ?? '',
      last_name: patient?.last_name ?? '',
      date_of_birth: patient?.date_of_birth ?? '',
      gender: (patient?.gender as Values['gender']) ?? '',
      phone: patient?.phone ?? '',
      email: patient?.email ?? '',
      address: patient?.address ?? '',
      city: patient?.city ?? '',
      occupation: patient?.occupation ?? '',
      referred_by: patient?.referred_by ?? '',
      emergency_contact_name: patient?.emergency_contact_name ?? '',
      emergency_contact_phone: patient?.emergency_contact_phone ?? '',
      medical_history: (patient?.medical_history as string | undefined) ?? '',
      allergies: (patient?.allergies as string | undefined) ?? '',
      notes: patient?.notes ?? '',
      preferred_language: patient?.preferred_language ?? 'en',
      primary_branch_id: patient?.primary_branch_id ?? defaultBranch,
      primary_practitioner_id: patient?.primary_practitioner?.id ? String(patient.primary_practitioner.id) : '',
      ...initial,
    },
  });
  const { errors } = form.formState;

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const body = Object.fromEntries(
        Object.entries({
          ...values,
          primary_practitioner_id: values.primary_practitioner_id ? Number(values.primary_practitioner_id) : null,
          primary_branch_id: Number(values.primary_branch_id),
          gender: values.gender || null,
        }).map(([k, v]) => [k, v === '' ? null : v]),
      );
      if (!clinical) {
        delete body.medical_history;
        delete body.allergies;
      }
      return patient
        ? unwrap(api.PUT('/patients/{patient}', { params: { path: { patient: patient.id } }, body: body as never }))
        : unwrap(api.POST('/patients', { body: body as never }));
    },
    onSuccess: (r) => {
      const saved = (r as unknown as { data: Patient }).data;
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.setQueryData(['patient', saved.id], saved);
      toast.success(patient ? t('patients.updated') : t('patients.created'));
      onSaved(saved);
    },
    onError: (e) => handleFormError(e, form.setError),
  });

  const req = t('common:errors.required');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="xl"
        title={patient ? t('patients.edit') : t('patients.new')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" form="patient-form" loading={mutation.isPending}>
              {t('common:actions.save')}
            </Button>
          </>
        }
      >
        <form id="patient-form" noValidate onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
          <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-fg-subtle">{t('patients.sections.personal')}</legend>
            <Field label={t('patients.firstName')} required error={errors.first_name && (errors.first_name.message?.length ? errors.first_name.message : req)}>
              <Input autoFocus autoComplete="off" {...form.register('first_name')} />
            </Field>
            <Field label={t('patients.lastName')} error={errors.last_name?.message}>
              <Input autoComplete="off" {...form.register('last_name')} />
            </Field>
            <Field label={t('patients.dob')} error={errors.date_of_birth?.message}>
              <Input type="date" max={new Date().toISOString().slice(0, 10)} {...form.register('date_of_birth')} />
            </Field>
            <Field label={t('patients.gender')}>
              <Select {...form.register('gender')}>
                <option value="">—</option>
                {['male', 'female', 'other', 'undisclosed'].map((g) => (
                  <option key={g} value={g}>
                    {t(`common:gender.${g}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('patients.occupation')}>
              <Input {...form.register('occupation')} />
            </Field>
            <Field label={t('patients.language')}>
              <Select {...form.register('preferred_language')}>
                <option value="en">English</option>
                <option value="ar">العربية</option>
                <option value="hi">हिन्दी</option>
                <option value="ml">മലയാളം</option>
                <option value="ta">தமிழ்</option>
              </Select>
            </Field>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-fg-subtle">{t('patients.sections.contact')}</legend>
            <Field label={t('patients.phone')} required error={errors.phone && (errors.phone.type === 'server' ? errors.phone.message : req)}>
              <Input type="tel" inputMode="tel" autoComplete="off" placeholder="+91 98765 43210" {...form.register('phone')} />
            </Field>
            <Field label={t('patients.email')} error={errors.email?.message}>
              <Input type="email" autoComplete="off" {...form.register('email')} />
            </Field>
            <Field label={t('patients.city')}>
              <Input {...form.register('city')} />
            </Field>
            <Field label={t('patients.address')} className="sm:col-span-2 lg:col-span-3">
              <Input {...form.register('address')} />
            </Field>
            <Field label={t('patients.emergencyName')}>
              <Input {...form.register('emergency_contact_name')} />
            </Field>
            <Field label={t('patients.emergencyPhone')}>
              <Input type="tel" {...form.register('emergency_contact_phone')} />
            </Field>
            <Field label={t('patients.referredBy')}>
              <Input {...form.register('referred_by')} />
            </Field>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-fg-subtle">{t('patients.sections.care')}</legend>
            <Field label={t('patients.branch')} required error={errors.primary_branch_id?.message}>
              <Select {...form.register('primary_branch_id')}>
                {session.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('patients.primaryPractitioner')}>
              <Select {...form.register('primary_practitioner_id')}>
                <option value="">—</option>
                {practitioners?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            {clinical && (
              <>
                <Field label={t('patients.medicalHistory')} className="sm:col-span-2">
                  <Textarea rows={3} {...form.register('medical_history')} />
                </Field>
                <Field label={t('patients.allergies')}>
                  <Input {...form.register('allergies')} />
                </Field>
              </>
            )}
            <Field label={t('patients.notes')} className={clinical ? '' : 'sm:col-span-2'}>
              <Input {...form.register('notes')} />
            </Field>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
