import { api, unwrap, type Patient, type TimelineEvent, type TimelineType } from '@physio/api';
import { formatInZone } from '@physio/core';
import { Card, cn, EmptyState, Skeleton } from '@physio/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  History,
  MessageSquareText,
  NotebookPen,
  Paperclip,
  ReceiptText,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { StatusBadge } from '../../../components/common';
import { useFormat } from '../../../lib/format';

const META: Record<TimelineType, { icon: LucideIcon; tone: string; tab?: string }> = {
  registered: { icon: UserPlus, tone: 'bg-primary-soft text-primary-soft-fg' },
  appointment: { icon: CalendarDays, tone: 'bg-info-soft text-info-soft-fg', tab: 'appointments' },
  assessment: { icon: ClipboardCheck, tone: 'bg-violet-soft text-violet-soft-fg', tab: 'assessments' },
  note: { icon: NotebookPen, tone: 'bg-violet-soft text-violet-soft-fg', tab: 'notes' },
  plan: { icon: ClipboardList, tone: 'bg-primary-soft text-primary-soft-fg', tab: 'plans' },
  prescription: { icon: FileText, tone: 'bg-primary-soft text-primary-soft-fg', tab: 'prescriptions' },
  progress: { icon: Activity, tone: 'bg-success-soft text-success-soft-fg', tab: 'progress' },
  document: { icon: Paperclip, tone: 'bg-surface-3 text-fg-muted', tab: 'documents' },
  consent: { icon: FileSignature, tone: 'bg-surface-3 text-fg-muted', tab: 'documents' },
  invoice: { icon: ReceiptText, tone: 'bg-warning-soft text-warning-soft-fg', tab: 'billing' },
  payment: { icon: CreditCard, tone: 'bg-success-soft text-success-soft-fg', tab: 'billing' },
  message: { icon: MessageSquareText, tone: 'bg-info-soft text-info-soft-fg' },
};

const ORDER: TimelineType[] = ['appointment', 'assessment', 'note', 'plan', 'prescription', 'progress', 'document', 'consent', 'invoice', 'payment', 'message', 'registered'];

export function TimelineTab({ patient }: { patient: Patient }) {
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const [hidden, setHidden] = useState<TimelineType[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['patient', patient.id, 'timeline'],
    queryFn: () => unwrap(api.GET('/patients/{patient}/timeline', { params: { path: { patient: patient.id } } })) as unknown as Promise<{ data: TimelineEvent[]; counts: Partial<Record<TimelineType, number>> }>,
  });

  const events = useMemo(() => (data?.data ?? []).filter((e) => !hidden.includes(e.type)), [data, hidden]);
  const months = useMemo(() => {
    const groups: { key: string; label: string; items: TimelineEvent[] }[] = [];
    for (const e of events) {
      const key = formatInZone(e.at, f.tz, 'yyyy-MM');
      if (groups.at(-1)?.key !== key) groups.push({ key, label: formatInZone(e.at, f.tz, 'MMMM yyyy', i18n.language), items: [] });
      groups.at(-1)!.items.push(e);
    }
    return groups;
  }, [events, f.tz, i18n.language]);

  const describe = (e: TimelineEvent): string => {
    const d = e.data;
    switch (e.type) {
      case 'registered': return t('timeline.text.registered', { mrn: d.mrn });
      case 'appointment': return t('timeline.text.appointment', { service: d.service ?? t(`common:appointmentType.${d.type}`), practitioner: d.practitioner });
      case 'assessment': return String(d.chief_complaint ?? '');
      case 'note': return [t('timeline.text.note', { author: d.author }), d.pain_score != null ? t('timeline.text.pain', { value: d.pain_score }) : null].filter(Boolean).join(' · ');
      case 'plan': return t('timeline.text.plan', { title: d.title, weeks: d.duration_weeks });
      case 'prescription': return t('timeline.text.prescription', { number: d.number, practitioner: d.practitioner });
      case 'progress': return [
        d.pain_score != null ? t('timeline.text.pain', { value: d.pain_score }) : null,
        d.function_score != null ? t('timeline.text.function', { value: d.function_score }) : null,
        d.measure && d.value != null ? `${d.measure}: ${d.value}${d.unit ?? ''}` : null,
      ].filter(Boolean).join(' · ');
      case 'document': return String(d.name ?? '');
      case 'consent': return t('timeline.text.consent', { title: d.title, signer: d.signer });
      case 'invoice': return t('timeline.text.invoice', { number: d.number, amount: f.money(Number(d.total_minor)) });
      case 'payment': return t(e.status === 'refund' ? 'timeline.text.refund' : 'timeline.text.payment', { amount: f.money(Number(d.amount_minor)), method: t(`common:paymentMethod.${d.method}`) }) + (d.receipt_number ? ` · ${d.receipt_number}` : '');
      case 'message': return t('timeline.text.message', { channel: t(`messages.channels.${d.channel}`), purpose: t(`messages.purposes.${d.purpose}`, { defaultValue: String(d.purpose) }) });
    }
  };

  const present = ORDER.filter((type) => (data?.counts?.[type] ?? 0) > 0);
  const toggle = (type: TimelineType) => setHidden((h) => (h.includes(type) ? h.filter((x) => x !== type) : [...h, type]));

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />;
  if (!data?.data.length) return <Card><EmptyState icon={<History />} title={t('timeline.empty')} /></Card>;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
      <Card className="p-5">
        <h2 className="mb-4 text-base font-semibold">{t('timeline.title')}</h2>
        <div className="space-y-6">
          {months.map((m) => (
            <section key={m.key} aria-label={m.label}>
              <h3 className="sticky top-16 z-10 mb-3 inline-block rounded-full bg-surface-3 px-3 py-1 text-xs font-semibold text-fg-muted">{m.label}</h3>
              <ol className="relative space-y-4 border-s border-border ps-6">
                {m.items.map((e) => {
                  const meta = META[e.type];
                  const Icon = meta.icon;
                  const body = (
                    <>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{t(`timeline.types.${e.type}`)}</span>
                        {/* A payment's "status" is payment/refund, already in the text. */}
                        {e.status && e.type !== 'payment' && <StatusBadge status={e.status} />}
                      </span>
                      <span className="mt-0.5 block text-sm text-fg-muted">{describe(e)}</span>
                    </>
                  );
                  return (
                    <li key={e.key} className="relative">
                      <span aria-hidden className={cn('absolute -start-[37px] top-0 grid size-7 place-items-center rounded-full ring-4 ring-surface', meta.tone)}>
                        <Icon className="size-3.5" />
                      </span>
                      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                        <time dateTime={e.at} className="tabular w-28 shrink-0 pt-0.5 text-xs text-fg-subtle">{f.instant(e.at, 'd MMM, h:mm a')}</time>
                        {meta.tab ? (
                          <Link to={`/patients/${patient.id}?tab=${meta.tab}`} className="min-w-0 flex-1 rounded-md hover:bg-surface-2 focus-visible:bg-surface-2">{body}</Link>
                        ) : (
                          <div className="min-w-0 flex-1">{body}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </Card>

      <Card className="h-fit p-4 lg:sticky lg:top-20">
        <p className="mb-3 text-sm font-semibold">{t('timeline.show')}</p>
        <div className="flex flex-wrap gap-2 lg:flex-col">
          {present.map((type) => {
            const Icon = META[type].icon;
            const on = !hidden.includes(type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(type)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-start text-[13px] transition-colors',
                  on ? 'border-border-strong bg-surface text-fg' : 'border-dashed border-border bg-transparent text-fg-subtle line-through',
                )}
              >
                <span className={cn('grid size-5 place-items-center rounded-full', META[type].tone)}><Icon className="size-3" /></span>
                <span className="flex-1">{t(`timeline.types.${type}`)}</span>
                <span className="tabular text-xs text-fg-subtle">{data.counts[type]}</span>
              </button>
            );
          })}
        </div>
        {hidden.length > 0 && (
          <button type="button" className="mt-3 cursor-pointer text-[13px] font-medium text-primary hover:underline" onClick={() => setHidden([])}>
            {t('timeline.all')}
          </button>
        )}
      </Card>
    </div>
  );
}
