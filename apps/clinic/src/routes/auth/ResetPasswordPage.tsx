import { api, ApiError, unwrap } from '@physio/api';
import { Alert, Button, Field, Input } from '@physio/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { errorMessage } from '../../lib/errors';
import { AuthLayout } from './AuthLayout';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <AuthLayout title={t('auth.resetTitle')}>
      {done ? (
        <div className="space-y-4">
          <Alert tone="success">{done}</Alert>
          <Button asChild size="lg" className="w-full">
            <Link to="/login">{t('auth.backToSignIn')}</Link>
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const res = await unwrap(
                api.POST('/auth/reset-password', {
                  body: { token: params.get('token') ?? '', email: params.get('email') ?? '', password, password_confirmation: confirmation },
                }),
              );
              setDone((res as { message: string }).message);
            } catch (err) {
              setError(err instanceof ApiError ? (err.fieldError('password') ?? err.fieldError('email') ?? err.message) : errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label={t('auth.newPassword')} required hint="Min. 10 characters with upper & lower case and a number">
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label={t('auth.confirmPassword')} required>
            <Input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {t('auth.resetSubmit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
