import { api, ApiError, unwrap } from '@physio/api';
import { SUPPORTED_LANGUAGES } from '@physio/core';
import { Alert, Button, Field, Input, Logo } from '@physio/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Languages } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { rememberClinic, rememberedClinic, sessionKey } from '../lib/session';

function Frame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-6">
      <div className="flex items-center justify-between">
        <Logo />
        <label className="relative inline-flex items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-fg-muted hover:bg-surface-3">
          <Languages className="size-4" aria-hidden />
          <span className="sr-only">{t('more.language')}</span>
          <select
            value={SUPPORTED_LANGUAGES.some((l) => l.code === i18n.language) ? i18n.language : 'en'}
            onChange={(e) => void i18n.changeLanguage(e.target.value)}
            className="h-9 cursor-pointer appearance-none bg-transparent pe-1 outline-none"
          >
            {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-1 flex-col justify-center py-8">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [clinic, setClinic] = useState(rememberedClinic());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await unwrap(api.POST('/patient/auth/login', { body: { clinic: clinic.trim().toLowerCase(), email, password } }));
      rememberClinic(clinic.trim().toLowerCase());
      client.setQueryData(sessionKey, (r as unknown as { data: unknown }).data);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldError('email') ?? err.message) : t('common:errors.network'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame title={t('auth.title')} subtitle={t('auth.subtitle')}>
      <form className="space-y-4" onSubmit={submit}>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t('auth.clinic')} hint={t('auth.clinicHint')} required>
          <Input autoCapitalize="none" autoCorrect="off" value={clinic} onChange={(e) => setClinic(e.target.value)} />
        </Field>
        <Field label={t('auth.email')} required>
          <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('auth.password')} required>
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>{t('auth.submit')}</Button>
        <p className="text-center text-xs text-fg-muted">{t('auth.noAccount')}</p>
      </form>
    </Frame>
  );
}

export function ActivatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Frame title={t('auth.activateTitle')} subtitle={t('auth.activateHelp')}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const clinic = params.get('clinic') ?? '';
            const r = await unwrap(api.POST('/patient/auth/activate', { body: { clinic, token: params.get('token') ?? '', password, password_confirmation: confirmation } }));
            rememberClinic(clinic);
            client.setQueryData(sessionKey, (r as unknown as { data: unknown }).data);
            navigate('/', { replace: true });
          } catch (err) {
            setError(err instanceof ApiError ? (err.fieldError('token') ?? err.fieldError('password') ?? err.message) : t('common:errors.network'));
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t('auth.newPassword')} required hint="8+ characters with letters and numbers">
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t('auth.confirm')} required>
          <Input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>{t('auth.activate')}</Button>
      </form>
    </Frame>
  );
}
