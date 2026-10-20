import { greetingKey } from '@physio/core';
import { Alert, Avatar, Button, Card, Logo, ProgressBar, Skeleton } from '@physio/ui';
import { CalendarDays, CalendarPlus, ChevronRight, Dumbbell, FileSignature, LineChart, ReceiptText, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMyAppointments, useMyConsents, useMyPlans } from '../lib/data';
import { useFormat, useSession } from '../lib/session';

export function HomePage() {
  const { t } = useTranslation();
  const { patient, clinic } = useSession();
  const f = useFormat();
  const { data: appts, isLoading } = useMyAppointments();
  const { data: plans } = useMyPlans();
  const { data: consents } = useMyConsents();

  const next = appts?.upcoming[0];
  const exercises = plans?.flatMap((p) => p.exercises ?? []) ?? [];
  const done = exercises.filter((e) => e.done_today).length;
  const toRate = appts?.past.find((a) => a.status === 'completed' && !a.feedback_given);

  const tiles = [
    { to: '/appointments', label: t('home.tiles.appointments'), icon: CalendarDays, tone: 'bg-info-soft text-info-soft-fg' },
    { to: '/exercises', label: t('home.tiles.exercises'), icon: Dumbbell, tone: 'bg-primary-soft text-primary-soft-fg' },
    { to: '/progress', label: t('home.tiles.progress'), icon: LineChart, tone: 'bg-violet-soft text-violet-soft-fg' },
    { to: '/invoices', label: t('home.tiles.billing'), icon: ReceiptText, tone: 'bg-warning-soft text-warning-soft-fg' },
  ];

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <Logo showTagline={false} />
        <span className="max-w-40 truncate text-xs font-medium text-fg-muted">{clinic.name}</span>
      </header>

      <div className="flex items-center gap-3">
        <Avatar name={patient.full_name} size={48} />
        <div>
          <p className="text-sm text-fg-muted">{t(`home.greeting.${greetingKey(f.tz)}`)}</p>
          <h1 className="text-xl font-bold">{patient.first_name}!</h1>
        </div>
      </div>

      {!!consents?.pending.length && (
        <Alert tone="warning" title={t('home.consentsPending')}>
          <Link to="/consents" className="font-semibold underline">{t('home.signNow')}</Link>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <div className="bg-sidebar p-4 text-white">
          <p className="text-xs font-medium uppercase tracking-wider text-white/70">{t('home.nextVisit')}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-12 bg-white/10" />
          ) : next ? (
            <Link to="/appointments" className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{f.local(next.local_start)}</p>
                <p className="text-sm text-white/75">{next.service?.name} · {t('appointments.with', { name: next.practitioner?.name })}</p>
              </div>
              <ChevronRight className="size-5 rtl:rotate-180" />
            </Link>
          ) : (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-white/80">{t('home.noUpcoming')}</p>
              <Button asChild size="sm" variant="secondary"><Link to="/book"><CalendarPlus />{t('home.bookNow')}</Link></Button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <Link key={tile.to} to={tile.to} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-sm font-medium shadow-card active:scale-[0.98]">
            <span className={`grid size-12 place-items-center rounded-xl ${tile.tone}`}><tile.icon className="size-6" /></span>
            {tile.label}
          </Link>
        ))}
      </div>

      {exercises.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('home.todayExercises')}</h2>
            <Link to="/exercises" className="text-sm font-medium text-primary">{t('home.doneOf', { done, total: exercises.length })}</Link>
          </div>
          <ProgressBar className="mt-3" value={(done / exercises.length) * 100} label={t('home.doneOf', { done, total: exercises.length })} />
        </Card>
      )}

      {toRate && (
        <Link to={`/appointments?rate=${toRate.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
          <Star className="size-6 text-warning" />
          <div className="flex-1">
            <p className="font-semibold">{t('home.rateVisit')}</p>
            <p className="text-xs text-fg-muted">{f.local(toRate.local_start)} · {toRate.practitioner?.name}</p>
          </div>
          <ChevronRight className="size-5 text-fg-subtle rtl:rotate-180" />
        </Link>
      )}

      <Link to="/consents" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-sm shadow-card">
        <FileSignature className="size-5 text-primary" />
        <span className="flex-1 font-medium">{t('home.tiles.consents')}</span>
        <ChevronRight className="size-5 text-fg-subtle rtl:rotate-180" />
      </Link>
    </div>
  );
}
