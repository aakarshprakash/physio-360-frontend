import { api, unwrap, type Branch, type Service } from '@physio/api';
import { addDays, formatLocal, todayInZone } from '@physio/core';
import { Alert, Avatar, Button, Card, cn, PageHeader, Skeleton, Spinner, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useFormat } from '../lib/session';
import { errorText } from './util';

interface Catalog {
  booking_enabled: boolean;
  branches: Branch[];
  services: Service[];
  practitioners: { id: number; name: string; title: string | null; specialization: string | null; branch_ids: number[] }[];
}

export function BookPage() {
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [practitionerId, setPractitionerId] = useState<number | null>(null);
  const [date, setDate] = useState(addDays(todayInZone(f.tz), 1));
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { data: catalog, isLoading } = useQuery({
    queryKey: ['my', 'catalog'],
    queryFn: async () => (await unwrap(api.GET('/patient/catalog')) as unknown as { data: Catalog }).data,
  });

  const practitioner = catalog?.practitioners.find((p) => p.id === practitionerId);
  const branchId = practitioner?.branch_ids[0] ?? catalog?.branches[0]?.id;

  const slots = useQuery({
    queryKey: ['my', 'slots', practitionerId, serviceId, date],
    queryFn: async () =>
      (await unwrap(api.GET('/patient/availability', { params: { query: { practitioner_id: practitionerId!, branch_id: branchId!, service_id: serviceId!, date } } })) as unknown as { data: { local_start: string }[] }).data,
    enabled: step >= 3 && !!practitionerId && !!serviceId && !!branchId,
  });

  const book = useMutation({
    mutationFn: () => unwrap(api.POST('/patient/appointments', { body: { practitioner_id: practitionerId!, branch_id: branchId!, service_id: serviceId!, local_start: slot!, notes: notes || null } as never })),
    onSuccess: () => {
      toast.success(t('book.booked'));
      void client.invalidateQueries({ queryKey: ['my'] });
      navigate('/appointments');
    },
    onError: (e) => {
      toast.error(errorText(e));
      setSlot(null);
      void slots.refetch();
    },
  });

  if (isLoading || !catalog) return <Skeleton className="h-64 rounded-2xl" />;
  if (!catalog.booking_enabled) return <Alert tone="info">{t('book.disabled')}</Alert>;

  const days = Array.from({ length: 14 }, (_, i) => addDays(todayInZone(f.tz), i + 1));
  const option = (selected: boolean) =>
    cn('flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 text-start transition-colors', selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-primary');

  return (
    <div>
      <PageHeader
        title={t('book.title')}
        description={t('book.step', { n: step })}
        back={step > 1 && (
          <button type="button" className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-fg-muted" onClick={() => setStep(step - 1)}>
            <ChevronLeft className="size-4 rtl:rotate-180" />{t('common:actions.back')}
          </button>
        )}
      />

      {step === 1 && (
        <section aria-labelledby="s1" className="space-y-2">
          <h2 id="s1" className="mb-2 font-semibold">{t('book.service')}</h2>
          {catalog.services.filter((s) => s.code !== 'HOME').map((s) => (
            <button key={s.id} type="button" className={option(serviceId === s.id)} onClick={() => { setServiceId(s.id); setStep(2); }}>
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: s.color ?? '#3E8E76' }} />
              <span className="flex-1"><span className="block font-medium">{s.name}</span><span className="text-sm text-fg-muted">{s.duration_minutes} min · {f.money(s.price_minor)}</span></span>
            </button>
          ))}
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="s2" className="space-y-2">
          <h2 id="s2" className="mb-2 font-semibold">{t('book.practitioner')}</h2>
          {catalog.practitioners.map((p) => (
            <button key={p.id} type="button" className={option(practitionerId === p.id)} onClick={() => { setPractitionerId(p.id); setStep(3); }}>
              <Avatar name={p.name} size={44} />
              <span className="flex-1"><span className="block font-medium">{p.name}</span><span className="text-sm text-fg-muted">{p.specialization ?? p.title}</span></span>
            </button>
          ))}
        </section>
      )}

      {step >= 3 && (
        <section aria-labelledby="s3" className="space-y-4">
          <h2 id="s3" className="font-semibold">{t('book.date')}</h2>
          <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {days.map((d) => (
              <button key={d} type="button" aria-pressed={date === d} onClick={() => { setDate(d); setSlot(null); setStep(3); }}
                className={cn('flex w-16 shrink-0 cursor-pointer flex-col items-center rounded-2xl border py-2.5', date === d ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface')}>
                <span className="text-[11px] font-medium uppercase opacity-80">{formatLocal(d, 'EEE', i18n.language)}</span>
                <span className="text-lg font-bold">{formatLocal(d, 'd', i18n.language)}</span>
              </button>
            ))}
          </div>
          <h2 className="font-semibold">{t('book.time')}</h2>
          {slots.isLoading ? (
            <div className="flex justify-center py-6 text-primary"><Spinner /></div>
          ) : !slots.data?.length ? (
            <p className="rounded-2xl bg-surface-2 p-4 text-sm text-fg-muted">{t('book.noSlots')}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.data.map((s) => (
                <button key={s.local_start} type="button" aria-pressed={slot === s.local_start} onClick={() => { setSlot(s.local_start); setStep(4); }}
                  className={cn('tabular cursor-pointer rounded-xl border py-2.5 text-sm font-medium', slot === s.local_start ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface')}>
                  {formatLocal(s.local_start, 'h:mm a', i18n.language)}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 4 && slot && (
        <Card className="mt-5 space-y-3 p-4">
          <p className="flex items-center gap-2 font-semibold"><Check className="size-5 text-primary" />{f.local(slot, 'EEEE, d MMM · h:mm a')}</p>
          <p className="text-sm text-fg-muted">{catalog.services.find((s) => s.id === serviceId)?.name} · {practitioner?.name}</p>
          <Textarea rows={2} aria-label={t('book.notes')} placeholder={t('book.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button size="lg" className="w-full" loading={book.isPending} onClick={() => book.mutate()}>{t('book.confirm')}</Button>
        </Card>
      )}
    </div>
  );
}
