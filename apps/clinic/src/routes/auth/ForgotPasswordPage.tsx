import { api, unwrap } from '@physio/api';
import { Alert, Button, Field, Input } from '@physio/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { errorMessage } from '../../lib/errors';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotHelp')}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const res = await unwrap(api.POST('/auth/forgot-password', { body: { email } }));
            setSent((res as { message: string }).message);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {sent && <Alert tone="success">{sent}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t('auth.email')} required>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {t('auth.sendLink')}
        </Button>
        <p className="text-center text-sm">
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('auth.backToSignIn')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
