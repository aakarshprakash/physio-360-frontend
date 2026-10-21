import { api, unwrap } from '@physio/api';
import { Button, Dialog, DialogContent, Field, Input, Label, Switch, toast } from '@physio/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { handleFormError } from '../../lib/errors';
import { CredentialsCard } from './CredentialsCard';
import type { StaffProfile } from './staffApi';

type Mode = 'generate' | 'set' | 'email';

/** Manager resets a colleague's password; they are signed out everywhere. */
export function PasswordDialog({ user, onClose }: { user: StaffProfile; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('generate');
  const [requireChange, setRequireChange] = useState(true);
  const [pw, setPw] = useState({ password: '', password_confirmation: '' });
  const [error, setError] = useState<string | undefined>();
  const [issued, setIssued] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/staff/{user}/password', {
        params: { path: { user: user.id } },
        body: { mode, require_change: requireChange, ...(mode === 'set' ? pw : {}) } as never,
      })),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
      const temp = (r as unknown as { meta?: { temporary_password?: string | null } }).meta?.temporary_password;
      if (temp) {
        setIssued(temp);
        return;
      }
      toast.success(mode === 'email' ? t('staff.reset.emailed', { email: user.email }) : t('staff.reset.done', { name: user.name }));
      onClose();
    },
    onError: (e) => handleFormError(e, (_f, err) => setError(err.message)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t('staff.reset.title', { name: user.name })}
        footer={issued ? <Button onClick={onClose}>{t('common:actions.done')}</Button> : (
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={reset.isPending} onClick={() => reset.mutate()}>{t('staff.resetPassword')}</Button>
          </>
        )}
      >
        {issued ? (
          <CredentialsCard name={user.name} email={user.email} password={issued} phone={user.phone} />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2" role="radiogroup" aria-label={t('staff.resetPassword')}>
              {(['generate', 'set', 'email'] as const).map((m) => (
                <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${mode === m ? 'border-primary bg-primary-soft/40' : 'border-border'}`}>
                  <input type="radio" name="mode" className="accent-[var(--color-primary)]" checked={mode === m} onChange={() => setMode(m)} />
                  {t(`staff.reset.${m}`, { email: user.email })}
                </label>
              ))}
            </div>
            {mode === 'set' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('staff.password')} error={error} hint={t('staff.passwordRules')}>
                  <Input type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
                </Field>
                <Field label={t('staff.confirmPassword')}>
                  <Input type="password" autoComplete="new-password" value={pw.password_confirmation} onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })} />
                </Field>
              </div>
            )}
            {mode !== 'email' && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <Label htmlFor="require-change" className="font-normal">{t('staff.reset.requireChange')}</Label>
                <Switch id="require-change" checked={requireChange} onCheckedChange={setRequireChange} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
