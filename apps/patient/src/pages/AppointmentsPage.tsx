import { api, unwrap } from '@physio/api';
import { Badge, Button, Card, ConfirmDialog, EmptyState, PageHeader, Segmented, Skeleton, STATUS_TONES, Textarea, toast } from '@physio/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Home, Star } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useMyAppointments, type PortalAppointment } from '../lib/data';
import { useFormat } from '../lib/session';
import { errorText } from './util';

export function AppointmentsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'upcoming' | 'past'>(params.get('rate') ? 'past' : 'upcoming');
  const { data, isLoading } = useMyAppointments();
  const rows = data?.[tab] ?? [];

  return (
    <div>
      <PageHeader title={t('appointments.title')} />
      <Segmented
        label={t('appointments.title')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: `${t('appointments.upcoming')} (${data?.upcoming.length ?? 0})` },
          { value: 'past', label: t('appointments.past') },
        ]}
      />
      <div className="mt-4 space-y-3">
        {isLoading ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : rows.length === 0 ? (
          <Card><EmptyState icon={<CalendarDays />} title={t('appointments.none')} /></Card>
        ) : (
          rows.map((a) => <VisitCard key={a.id} appointment={a} autoRate={Number(params.get('rate')) === a.id} />)
        )}
      </div>
    </div>
  );
}

function VisitCard({ appointment: a, autoRate }: { appointment: PortalAppointment; autoRate: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const client = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [rateOpen, setRateOpen] = useState(autoRate);

  const cancel = useMutation({
    mutationFn: () => unwrap(api.POST('/patient/appointments/{appointment}/cancel', { params: { path: { appointment: a.id } } })),
    onSuccess: () => {
      toast.success(t('appointments.cancelled'));
      void client.invalidateQueries({ queryKey: ['my'] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const feedback = useMutation({
    mutationFn: () => unwrap(api.POST('/patient/feedback', { body: { appointment_id: a.id, rating, comment: comment || null } as never })),
    onSuccess: () => {
      toast.success(t('appointments.thanks'));
      setRateOpen(false);
      void client.invalidateQueries({ queryKey: ['my', 'appointments'] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{f.local(a.local_start, 'EEEE, d MMM')}</p>
          <p className="text-sm text-fg-muted">{f.local(a.local_start, 'h:mm a')} · {a.duration_minutes} min</p>
        </div>
        <Badge tone={STATUS_TONES[a.status] ?? 'neutral'}>{t(`common:status.${a.status}`)}</Badge>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm">
        {a.type === 'home_visit' && <Home className="size-4 text-primary" />}
        {a.service?.name} · {t('appointments.with', { name: a.practitioner?.name })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {a.can_cancel && (
          <ConfirmDialog
            tone="danger"
            title={t('appointments.cancelConfirm')}
            description={f.local(a.local_start)}
            confirmLabel={t('appointments.cancel')}
            cancelLabel={t('common:actions.back')}
            onConfirm={() => cancel.mutateAsync()}
            trigger={<Button size="sm" variant="danger-ghost">{t('appointments.cancel')}</Button>}
          />
        )}
        {a.status === 'completed' && !a.feedback_given && !rateOpen && (
          <Button size="sm" variant="outline" onClick={() => setRateOpen(true)}><Star />{t('appointments.rate')}</Button>
        )}
      </div>
      {rateOpen && (
        <div className="mt-3 space-y-3 rounded-xl bg-surface-2 p-3">
          <div role="radiogroup" aria-label={t('appointments.rate')} className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}/5`} onClick={() => setRating(n)} className="cursor-pointer p-1">
                <Star className={`size-8 ${n <= rating ? 'fill-current text-warning' : 'text-border-strong'}`} />
              </button>
            ))}
          </div>
          <Textarea rows={2} aria-label={t('appointments.feedbackPlaceholder')} placeholder={t('appointments.feedbackPlaceholder')} value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button className="w-full" disabled={!rating} loading={feedback.isPending} onClick={() => feedback.mutate()}>{t('appointments.send')}</Button>
        </div>
      )}
    </Card>
  );
}
