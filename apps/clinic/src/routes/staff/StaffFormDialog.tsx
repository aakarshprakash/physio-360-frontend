import { api, unwrap } from '@physio/api';
import { Alert, Button, Checkbox, Dialog, DialogContent, Field, Input, Label, Select, Switch, Textarea, toast } from '@physio/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { handleFormError } from '../../lib/errors';
import { useSession } from '../../lib/session';
import { CredentialsCard } from './CredentialsCard';
import { EMPLOYMENT_TYPES, ROLES, type StaffProfile } from './staffApi';

type Credentials = 'generate' | 'password' | 'invite';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-border pt-4 first:border-t-0 first:pt-0 sm:grid-cols-2">
      <legend className="mb-1 text-xs font-semibold tracking-wide text-fg-muted uppercase sm:col-span-2">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Create or edit a team member's employee record, role and sign-in. */
export function StaffFormDialog({ user, onClose, onSaved }: { user?: StaffProfile; onClose: () => void; onSaved?: (u: StaffProfile) => void }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const isOwner = session.user.roles?.includes('owner');
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    title: user?.title ?? '',
    specialization: user?.specialization ?? '',
    color: user?.color ?? '#3E8E76',
    role: (user?.role ?? user?.roles?.[0] ?? 'therapist') as string,
    is_practitioner: user?.is_practitioner ?? true,
    is_active: user?.is_active ?? true,
    branch_ids: user?.branch_ids ?? session.branches.map((b) => b.id),
    employee_code: user?.employee_code ?? '',
    employment_type: user?.employment_type ?? 'full_time',
    joined_on: user?.joined_on ?? '',
    date_of_birth: user?.date_of_birth ?? '',
    gender: user?.gender ?? '',
    qualification: user?.qualification ?? '',
    registration_number: user?.registration_number ?? '',
    address: user?.address ?? '',
    emergency_contact_name: user?.emergency_contact_name ?? '',
    emergency_contact_phone: user?.emergency_contact_phone ?? '',
    hr_notes: user?.hr_notes ?? '',
    online_bookable: user?.online_bookable ?? true,
    geofence_exempt: user?.geofence_exempt ?? false,
  });
  const [credentials, setCredentials] = useState<Credentials>('generate');
  const [password, setPassword] = useState({ password: '', password_confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ user: StaffProfile; password: string | null } | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const nullable = (v: string) => (v.trim() === '' ? null : v.trim());
      const body: Record<string, unknown> = {
        ...form,
        phone: nullable(form.phone),
        title: nullable(form.title),
        specialization: nullable(form.specialization),
        employee_code: nullable(form.employee_code),
        joined_on: nullable(form.joined_on),
        date_of_birth: nullable(form.date_of_birth),
        gender: nullable(form.gender),
        qualification: nullable(form.qualification),
        registration_number: nullable(form.registration_number),
        address: nullable(form.address),
        emergency_contact_name: nullable(form.emergency_contact_name),
        emergency_contact_phone: nullable(form.emergency_contact_phone),
        hr_notes: nullable(form.hr_notes),
      };
      if (user) {
        delete body.email;
        return unwrap(api.PUT('/staff/{user}', { params: { path: { user: user.id } }, body: body as never }));
      }
      Object.assign(body, { credentials }, credentials === 'password' ? password : {});
      return unwrap(api.POST('/staff', { body: body as never }));
    },
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar-resources'] });
      const res = r as unknown as { data: StaffProfile; meta?: { temporary_password?: string | null } };
      onSaved?.(res.data);
      if (!user && (credentials !== 'invite' || res.meta?.temporary_password)) {
        setCreated({ user: res.data, password: res.meta?.temporary_password ?? null });
      } else {
        toast.success(user ? t('staff.saved') : t('staff.created'));
        onClose();
      }
    },
    onError: (e) => {
      setErrors({});
      handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [String(field)]: err.message ?? '' })));
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const unshownErrors = Object.entries(errors).filter(([k]) => !['name', 'email', 'role', 'employee_code', 'password', 'branch_ids'].includes(k));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={created ? t('staff.loginDetails') : user ? t('staff.edit') : t('staff.add')}
        footer={
          created ? (
            <Button onClick={onClose}>{t('common:actions.done')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
              <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common:actions.save')}</Button>
            </>
          )
        }
      >
        {created ? (
          created.password ? (
            <CredentialsCard name={created.user.name} email={created.user.email} password={created.password} />
          ) : (
            <Alert tone="success" title={t('staff.created')}>{t('staff.passwordRules')}</Alert>
          )
        ) : (
          <div className="space-y-5">
            {unshownErrors.length > 0 && <Alert tone="danger">{unshownErrors[0]![1]}</Alert>}

            <Section title={t('staff.sections.personal')}>
              <Field label={t('staff.name')} required error={errors.name}><Input autoFocus value={form.name} onChange={set('name')} /></Field>
              <Field label={t('staff.email')} required error={errors.email} hint={user ? undefined : t('staff.credentials.label')}>
                <Input type="email" disabled={!!user} value={form.email} onChange={set('email')} autoComplete="off" />
              </Field>
              <Field label={t('staff.phone')}><Input type="tel" value={form.phone} onChange={set('phone')} /></Field>
              <Field label={t('staff.gender')}>
                <Select value={form.gender} onChange={set('gender')}>
                  <option value="">—</option>
                  {(['male', 'female', 'other'] as const).map((g) => <option key={g} value={g}>{t(`staff.genders.${g}`)}</option>)}
                </Select>
              </Field>
              <Field label={t('staff.dateOfBirth')}><Input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} /></Field>
              <Field label={t('staff.address')} className="sm:col-span-2"><Input value={form.address} onChange={set('address')} /></Field>
            </Section>

            <Section title={t('staff.sections.employment')}>
              <Field label={t('staff.employeeCode')} error={errors.employee_code}><Input value={form.employee_code} onChange={set('employee_code')} placeholder="EMP-001" /></Field>
              <Field label={t('staff.jobTitle')}><Input value={form.title} onChange={set('title')} placeholder={t('staff.roles.therapist')} /></Field>
              <Field label={t('staff.employmentType')}>
                <Select value={form.employment_type} onChange={set('employment_type')}>{EMPLOYMENT_TYPES.map((x) => <option key={x} value={x}>{t(`staff.employmentTypes.${x}`)}</option>)}</Select>
              </Field>
              <Field label={t('staff.joinedOn')}><Input type="date" value={form.joined_on} onChange={set('joined_on')} /></Field>
              <Field label={t('staff.qualification')}><Input value={form.qualification} onChange={set('qualification')} placeholder="BPT, MPT (Ortho)" /></Field>
              <Field label={t('staff.registrationNumber')}><Input value={form.registration_number} onChange={set('registration_number')} /></Field>
              <Field label={t('staff.specialization')} className="sm:col-span-2"><Input value={form.specialization} onChange={set('specialization')} /></Field>
            </Section>

            <Section title={t('staff.sections.emergency')}>
              <Field label={t('staff.emergencyName')}><Input value={form.emergency_contact_name} onChange={set('emergency_contact_name')} /></Field>
              <Field label={t('staff.emergencyPhone')}><Input type="tel" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} /></Field>
            </Section>

            <Section title={t('staff.sections.access')}>
              <Field label={t('staff.role')} required error={errors.role}>
                <Select value={form.role} onChange={set('role')}>
                  {ROLES.filter((r) => r !== 'owner' || isOwner || form.role === 'owner').map((r) => <option key={r} value={r}>{t(`staff.roles.${r}`)}</option>)}
                </Select>
              </Field>
              <Field label={t('staff.color')}><Input type="color" className="h-10 w-20 p-1" value={form.color} onChange={set('color')} /></Field>
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-[13px] font-medium">{t('staff.branches')}</legend>
                <div className="flex flex-wrap gap-4">
                  {session.branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.branch_ids.includes(b.id)} onCheckedChange={(v) => setForm({ ...form, branch_ids: v ? [...form.branch_ids, b.id] : form.branch_ids.filter((x) => x !== b.id) })} />
                      {b.name}
                    </label>
                  ))}
                </div>
                {errors.branch_ids && <p className="mt-1 text-xs text-danger">{errors.branch_ids}</p>}
              </fieldset>
              <ToggleRow id="is-pract" label={t('staff.practitioner')} checked={form.is_practitioner} onChange={(v) => setForm({ ...form, is_practitioner: v })} />
              {form.is_practitioner && <ToggleRow id="bookable" label={t('staff.onlineBookable')} checked={form.online_bookable} onChange={(v) => setForm({ ...form, online_bookable: v })} />}
              <ToggleRow id="geo" label={t('staff.geofenceExempt')} checked={form.geofence_exempt} onChange={(v) => setForm({ ...form, geofence_exempt: v })} />
              {user && <ToggleRow id="active" label={t('staff.active')} checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />}
              <Field label={t('staff.hrNotes')} className="sm:col-span-2"><Textarea rows={2} value={form.hr_notes} onChange={set('hr_notes')} /></Field>
            </Section>

            {!user && (
              <Section title={t('staff.sections.login')}>
                <div className="space-y-2 sm:col-span-2" role="radiogroup" aria-label={t('staff.credentials.label')}>
                  {(['generate', 'password', 'invite'] as const).map((c) => (
                    <label key={c} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${credentials === c ? 'border-primary bg-primary-soft/40' : 'border-border'}`}>
                      <input type="radio" name="credentials" className="mt-1 accent-[var(--color-primary)]" checked={credentials === c} onChange={() => setCredentials(c)} />
                      <span>
                        <span className="block text-sm font-medium">{t(`staff.credentials.${c}`)}</span>
                        <span className="block text-xs text-fg-muted">{t(`staff.credentials.${c}Hint`)}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {credentials === 'password' && (
                  <>
                    <Field label={t('staff.password')} required error={errors.password} hint={t('staff.passwordRules')}>
                      <Input type="password" autoComplete="new-password" value={password.password} onChange={(e) => setPassword({ ...password, password: e.target.value })} />
                    </Field>
                    <Field label={t('staff.confirmPassword')} required>
                      <Input type="password" autoComplete="new-password" value={password.password_confirmation} onChange={(e) => setPassword({ ...password, password_confirmation: e.target.value })} />
                    </Field>
                  </>
                )}
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 sm:col-span-2">
      <Label htmlFor={id} className="font-normal">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
