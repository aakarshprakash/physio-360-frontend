import { api, ApiError, unwrap } from '@physio/api';
import { getThemePreference, setThemePreference, SUPPORTED_LANGUAGES, type ThemePreference } from '@physio/core';
import { Alert, Button, Card, CardContent, CardHeader, Field, Input, PageHeader, Segmented, toast } from '@physio/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage, toastError } from '../../lib/errors';
import { useSession } from '../../lib/session';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { session, refresh } = useSession();
  const [details, setDetails] = useState({ name: session.user.name, phone: session.user.phone ?? '' });
  const [pw, setPw] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference());

  const saveDetails = useMutation({
    mutationFn: () => unwrap(api.PUT('/auth/profile', { body: { ...details, phone: details.phone || null, locale: i18n.language } as never })),
    onSuccess: () => {
      toast.success(t('staff.saved'));
      void refresh();
    },
    onError: toastError,
  });

  const savePw = useMutation({
    mutationFn: () => unwrap(api.PUT('/auth/password', { body: pw })),
    onSuccess: () => {
      toast.success(t('profile.passwordChanged'));
      setPw({ current_password: '', password: '', password_confirmation: '' });
      setPwError(null);
    },
    onError: (e) => setPwError(e instanceof ApiError ? (e.fieldError('current_password') ?? e.fieldError('password') ?? e.message) : errorMessage(e)),
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title={t('profile.title')} description={session.user.email} />
      <div className="space-y-5">
        <Card>
          <CardHeader title={t('profile.details')} />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label={t('staff.name')}><Input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} /></Field>
            <Field label={t('staff.phone')}><Input value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} /></Field>
            <div className="flex justify-end sm:col-span-2"><Button loading={saveDetails.isPending} onClick={() => saveDetails.mutate()}>{t('common:actions.saveChanges')}</Button></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t('profile.appearance')} />
          <CardContent className="flex flex-wrap items-center gap-6">
            <div>
              <p className="mb-2 text-[13px] font-medium">{t('profile.language')}</p>
              <Segmented<string>
                label={t('profile.language')}
                value={SUPPORTED_LANGUAGES.some((l) => l.code === i18n.language) ? i18n.language : 'en'}
                onChange={(l) => {
                  void i18n.changeLanguage(l);
                  void api.PUT('/auth/profile', { body: { locale: l } as never }).catch(() => undefined);
                }}
                options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: <span lang={l.code}>{l.label}</span> }))}
              />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium">{t('common:theme.toggle')}</p>
              <Segmented<ThemePreference>
                label={t('common:theme.toggle')}
                value={theme}
                onChange={(v) => {
                  setTheme(v);
                  setThemePreference(v);
                }}
                options={[{ value: 'light', label: t('common:theme.light') }, { value: 'dark', label: t('common:theme.dark') }, { value: 'system', label: t('common:theme.system') }]}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t('profile.security')} />
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {pwError && <Alert tone="danger" className="sm:col-span-3">{pwError}</Alert>}
            <Field label={t('profile.currentPassword')}><Input type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
            <Field label={t('profile.newPassword')}><Input type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
            <Field label={t('profile.confirmPassword')}><Input type="password" autoComplete="new-password" value={pw.password_confirmation} onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })} /></Field>
            <div className="flex justify-end sm:col-span-3"><Button loading={savePw.isPending} disabled={!pw.current_password || !pw.password} onClick={() => savePw.mutate()}>{t('auth.resetSubmit')}</Button></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
