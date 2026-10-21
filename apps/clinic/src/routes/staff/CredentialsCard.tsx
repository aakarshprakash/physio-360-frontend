import { Alert, Button, toast } from '@physio/ui';
import { Copy, KeyRound, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../lib/session';

/** One-time display of a temporary password, with copy and WhatsApp hand-off. */
export function CredentialsCard({ name, email, password, phone }: { name: string; email: string; password: string; phone?: string | null }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const url = window.location.origin + '/login';
  const message = t('staff.loginMessage', { name: name.split(' ')[0], clinic: session.tenant.name, url, email, password });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('staff.copied'));
    } catch {
      toast.error(text);
    }
  };
  const waNumber = (phone ?? '').replace(/\D/g, '');

  return (
    <div className="space-y-4">
      <Alert tone="success" title={t('staff.loginDetails')}>{t('staff.loginDetailsHint', { name })}</Alert>
      <dl className="divide-y divide-border rounded-xl border border-border bg-surface-2">
        {[
          [t('staff.email'), email],
          [t('staff.password'), password],
          ['URL', url],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <dt className="w-24 shrink-0 text-xs font-medium text-fg-muted">{label}</dt>
            <dd className={`min-w-0 flex-1 truncate text-sm ${label === t('staff.password') ? 'font-mono text-base font-semibold tracking-wide' : ''}`}>{value}</dd>
            <Button variant="ghost" size="icon-sm" aria-label={`${t('staff.copy')} ${label}`} onClick={() => void copy(value!)}><Copy /></Button>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void copy(message)}><KeyRound />{t('staff.copyAll')}</Button>
        <Button variant="outline" asChild>
          <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle />{t('staff.shareWhatsApp')}</a>
        </Button>
      </div>
    </div>
  );
}
