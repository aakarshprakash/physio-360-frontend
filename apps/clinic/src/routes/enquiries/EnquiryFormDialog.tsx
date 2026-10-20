import { api, ENQUIRY_SOURCES, unwrap, type Enquiry } from '@physio/api';
import { Button, Dialog, DialogContent, Field, Input, Select, Textarea, toast } from '@physio/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices, useStaff } from '../../lib/catalog';
import { handleFormError } from '../../lib/errors';
import { useDefaultBranchId, useSession } from '../../lib/session';

interface Props {
  enquiry?: Enquiry;
  onClose: () => void;
  onSaved: (enquiry: Enquiry) => void;
}

export function EnquiryFormDialog({ enquiry, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const defaultBranch = useDefaultBranchId();
  const { data: staff } = useStaff();
  const { data: services } = useServices();

  const [form, setForm] = useState({
    name: enquiry?.name ?? '',
    phone: enquiry?.phone ?? '',
    email: enquiry?.email ?? '',
    source: enquiry?.source ?? 'phone',
    interest: enquiry?.interest ?? '',
    service_id: enquiry?.service?.id ? String(enquiry.service.id) : '',
    message: enquiry?.message ?? '',
    preferred_contact_time: enquiry?.preferred_contact_time ?? '',
    branch_id: String(enquiry?.branch_id ?? defaultBranch),
    assigned_to: enquiry?.assignee?.id ? String(enquiry.assignee.id) : String(session.user.id),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        email: form.email || null,
        interest: form.interest || null,
        message: form.message || null,
        preferred_contact_time: form.preferred_contact_time || null,
        service_id: form.service_id ? Number(form.service_id) : null,
        branch_id: Number(form.branch_id),
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      };
      return enquiry
        ? unwrap(api.PUT('/enquiries/{enquiry}', { params: { path: { enquiry: enquiry.id } }, body: body as never }))
        : unwrap(api.POST('/enquiries', { body: body as never }));
    },
    onSuccess: (r) => {
      toast.success(enquiry ? t('enquiries.saved') : t('enquiries.created'));
      void queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      onSaved((r as unknown as { data: Enquiry }).data);
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={enquiry ? t('common:actions.edit') : t('enquiries.new')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={save.isPending} disabled={!form.name.trim() || !form.phone.trim()} onClick={() => save.mutate()}>{t('common:actions.save')}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('enquiries.name')} required error={errors.name}>
            <Input autoFocus value={form.name} onChange={set('name')} />
          </Field>
          <Field label={t('enquiries.phone')} required error={errors.phone}>
            <Input type="tel" inputMode="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label={t('enquiries.email')} error={errors.email}>
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label={t('enquiries.source')} required>
            <Select value={form.source} onChange={set('source')}>
              {ENQUIRY_SOURCES.map((s) => <option key={s} value={s}>{t(`enquiries.sources.${s}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('enquiries.interest')} className="sm:col-span-2" error={errors.interest}>
            <Input placeholder="Knee pain after surgery" value={form.interest} onChange={set('interest')} />
          </Field>
          <Field label={t('enquiries.service')}>
            <Select value={form.service_id} onChange={set('service_id')}>
              <option value="">—</option>
              {services?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label={t('enquiries.preferredTime')}>
            <Input placeholder="Evenings after 6 pm" value={form.preferred_contact_time} onChange={set('preferred_contact_time')} />
          </Field>
          {session.branches.length > 1 && (
            <Field label={t('enquiries.branch')}>
              <Select value={form.branch_id} onChange={set('branch_id')}>
                {session.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label={t('enquiries.assignedTo')}>
            <Select value={form.assigned_to} onChange={set('assigned_to')}>
              <option value="">{t('enquiries.unassigned')}</option>
              {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label={t('enquiries.message')} className="sm:col-span-2">
            <Textarea rows={3} value={form.message} onChange={set('message')} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
