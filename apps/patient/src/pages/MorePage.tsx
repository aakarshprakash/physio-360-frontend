import { api, unwrap } from '@physio/api';
import { resolvedTheme, setThemePreference, SUPPORTED_LANGUAGES } from '@physio/core';
import { Avatar, Button, Card, PageHeader, Segmented, Switch } from '@physio/ui';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FileSignature, LineChart, LogOut, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { sessionKey, useSession } from '../lib/session';

export function MorePage() {
  const { t, i18n } = useTranslation();
  const { patient, clinic } = useSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [dark, setDark] = useState(resolvedTheme() === 'dark');

  const links = [
    { to: '/progress', label: t('home.tiles.progress'), icon: LineChart },
    { to: '/invoices', label: t('home.tiles.billing'), icon: ReceiptText },
    { to: '/consents', label: t('home.tiles.consents'), icon: FileSignature },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t('more.title')} />
      <Card className="flex items-center gap-3 p-4">
        <Avatar name={patient.full_name} size={48} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{patient.full_name}</p>
          <p className="truncate text-sm text-fg-muted">{patient.mrn} · {clinic.name}</p>
        </div>
      </Card>
      <Card className="divide-y divide-border">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="flex items-center gap-3 p-4 text-sm font-medium">
            <l.icon className="size-5 text-primary" />
            <span className="flex-1">{l.label}</span>
            <ChevronRight className="size-5 text-fg-subtle rtl:rotate-180" />
          </Link>
        ))}
      </Card>
      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{t('more.language')}</span>
          <Segmented<string> label={t('more.language')} value={SUPPORTED_LANGUAGES.some((l) => l.code === i18n.language) ? i18n.language : 'en'} onChange={(l) => void i18n.changeLanguage(l)} options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: <span lang={l.code}>{l.label}</span> }))} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="dark" className="text-sm font-medium">{t('more.theme')}</label>
          <Switch id="dark" checked={dark} onCheckedChange={(v) => { setDark(v); setThemePreference(v ? 'dark' : 'light'); }} />
        </div>
      </Card>
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={async () => {
          await unwrap(api.POST('/patient/auth/logout')).catch(() => undefined);
          client.clear();
          client.setQueryData(sessionKey, null);
          navigate('/login', { replace: true });
        }}
      >
        <LogOut />
        {t('more.signOut')}
      </Button>
    </div>
  );
}
