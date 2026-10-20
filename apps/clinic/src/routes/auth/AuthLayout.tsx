import { Logo } from '@physio/ui';
import { CalendarDays, ClipboardList, ReceiptText, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageMenu, ThemeToggle } from '../../components/AppShell';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -end-32 -top-32 size-[28rem] rounded-full bg-[#65A995]/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-40 -start-24 size-[26rem] rounded-full bg-[#2F7D66]/30 blur-3xl" />
        <svg aria-hidden className="absolute inset-x-0 bottom-0 h-56 w-full opacity-30" viewBox="0 0 600 200" preserveAspectRatio="none">
          <path d="M0 140 C 120 60, 240 200, 360 120 S 540 60, 600 110 L600 200 L0 200 Z" fill="#65A995" />
          <path d="M0 170 C 150 110, 260 210, 400 150 S 560 120, 600 150 L600 200 L0 200 Z" fill="#DCEDE6" opacity="0.5" />
        </svg>
        <Logo inverted className="relative" />
        <div className="relative mt-auto max-w-lg">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">{t('auth.heroTitle')}</h1>
          <p className="mt-4 text-lg text-white/75">{t('auth.heroText')}</p>
          <ul className="mt-8 grid grid-cols-2 gap-3 text-sm">
            {[
              [CalendarDays, t('nav.appointments')],
              [ClipboardList, t('nav.treatmentPlans')],
              [ReceiptText, t('nav.billing')],
              [ShieldCheck, 'Encrypted · Audited'],
            ].map(([Icon, label], i) => {
              const I = Icon as typeof CalendarDays;
              return (
                <li key={i} className="flex items-center gap-2.5 rounded-xl bg-white/8 px-3 py-2.5 ring-1 ring-white/10">
                  <I className="size-4 text-[#A9D8C8]" />
                  {label as string}
                </li>
              );
            })}
          </ul>
          <p className="mt-10 text-2xl font-semibold italic text-[#A9D8C8]">{t('auth.tagline')}</p>
        </div>
      </section>

      <section className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <div className="flex items-center gap-1">
            <LanguageMenu persist={false} />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-center text-xs text-fg-subtle">© {new Date().getFullYear()} SYSNAC · Physio360</p>
      </section>
    </div>
  );
}
