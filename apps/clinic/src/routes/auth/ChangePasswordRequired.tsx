import { api, ApiError, unwrap } from '@physio/api';
import { Alert, Button, Field, Input, toast } from '@physio/ui';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../lib/errors';
import { sessionQueryKey, useSession } from '../../lib/session';
import { AuthLayout } from './AuthLayout';

/**
 * First sign-in with an administrator-issued password: the user must choose
 * their own before using the app.
 */
export function ChangePasswordRequired() {
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <AuthLayout title={t('auth.firstLogin.title')}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await unwrap(api.PUT('/auth/password', { body: form as never }));
            toast.success(t('auth.firstLogin.done'));
            await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
          } catch (err) {
            setError(err instanceof ApiError ? (err.fieldError('password') ?? err.fieldError('current_password') ?? err.message) : errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Alert tone="info" title={t('auth.firstLogin.welcome', { name: session.user.name.split(' ')[0] })}>
          <span className="inline-flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" />{t('auth.firstLogin.body')}</span>
        </Alert>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t('auth.firstLogin.current')} required>
          <Input type="password" autoComplete="current-password" autoFocus value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
        </Field>
        <Field label={t('auth.newPassword')} required hint={t('staff.passwordRules')}>
          <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label={t('auth.confirmPassword')} required>
          <Input type="password" autoComplete="new-password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>{t('auth.firstLogin.submit')}</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => void signOut()}>{t('common:actions.signOut')}</Button>
      </form>
    </AuthLayout>
  );
}
