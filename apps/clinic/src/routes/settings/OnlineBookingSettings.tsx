import { api, unwrap, type Tenant } from '@physio/api';
import { Button, Card, CardContent, CardHeader, Field, Input, Label, Segmented, Switch, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Code2, Copy, Download, ExternalLink, Link2, MessageCircle, QrCode } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toastError } from '../../lib/errors';
import { useSession } from '../../lib/session';

type OnlineBooking = { enabled: boolean; mode: 'request' | 'instant'; min_lead_minutes: number; max_days_ahead: number; allow_practitioner_choice: boolean; intro: string | null };

export function bookingUrl(slug: string, source?: string): string {
  return `${window.location.origin}/my/book/${slug}${source ? `?src=${source}` : ''}`;
}

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error(text);
  }
}

/** Everything a clinic needs to collect bookings: link, WhatsApp, website embed, QR poster. */
export function BookingShareKit() {
  const { t } = useTranslation();
  const { session } = useSession();
  const slug = session.tenant.slug;
  const link = bookingUrl(slug);
  const waText = t('onlineBooking.share.whatsAppText', { clinic: session.tenant.name, url: bookingUrl(slug, 'whatsapp') });
  const embed = `<iframe src="${bookingUrl(slug, 'website')}&embed=1" title="${t('onlineBooking.share.iframeTitle', { clinic: session.tenant.name })}" style="width:100%;min-height:760px;border:0;border-radius:16px" loading="lazy"></iframe>`;
  const button = `<a href="${bookingUrl(slug, 'website')}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#2F7D66;color:#fff;font:600 15px system-ui,sans-serif;text-decoration:none">${t('onlineBooking.share.bookButton')}</a>`;
  const qrUrl = `/api/settings/booking-qr?url=${encodeURIComponent(bookingUrl(slug, 'qr'))}`;
  const copied = t('staff.copied');

  return (
    <Card>
      <CardHeader title={t('onlineBooking.share.title')} description={t('onlineBooking.share.subtitle')} />
      <CardContent className="space-y-5">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[13px] font-medium"><Link2 className="size-4" />{t('onlineBooking.share.link')}</p>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={link} className="min-w-64 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} aria-label={t('onlineBooking.share.link')} />
            <Button variant="outline" onClick={() => void copyText(link, copied)}><Copy />{t('common:actions.copy')}</Button>
            <Button variant="outline" asChild><a href={link} target="_blank" rel="noreferrer"><ExternalLink />{t('onlineBooking.share.open')}</a></Button>
            <Button asChild><a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer"><MessageCircle />{t('onlineBooking.share.whatsApp')}</a></Button>
          </div>
          <p className="mt-1.5 text-xs text-fg-muted">{t('onlineBooking.share.whatsAppHint')}</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-[13px] font-medium"><Code2 className="size-4" />{t('onlineBooking.share.embed')}</p>
              <Textarea readOnly rows={3} className="font-mono text-xs" value={embed} onFocus={(e) => e.target.select()} aria-label={t('onlineBooking.share.embed')} />
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void copyText(embed, copied)}><Copy />{t('onlineBooking.share.copyEmbed')}</Button>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-medium">{t('onlineBooking.share.button')}</p>
              <Textarea readOnly rows={2} className="font-mono text-xs" value={button} onFocus={(e) => e.target.select()} aria-label={t('onlineBooking.share.button')} />
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void copyText(button, copied)}><Copy />{t('onlineBooking.share.copyButton')}</Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-2 p-4">
            <p className="flex items-center gap-2 text-[13px] font-medium"><QrCode className="size-4" />{t('onlineBooking.share.qr')}</p>
            <img src={qrUrl} alt={t('onlineBooking.share.qrAlt')} className="size-44 rounded-lg bg-white p-1" />
            <Button size="sm" variant="outline" asChild><a href={qrUrl} download={`${slug}-booking-qr.svg`}><Download />{t('common:actions.download')}</a></Button>
            <p className="max-w-44 text-center text-xs text-fg-muted">{t('onlineBooking.share.qrHint')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OnlineBookingSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { refresh } = useSession();
  const { data: clinic } = useQuery({ queryKey: ['clinic'], queryFn: async () => (await unwrap(api.GET('/settings/clinic'))).data as Tenant });
  const [draft, setDraft] = useState<OnlineBooking | null>(null);
  const save = useMutation({
    mutationFn: (online_booking: OnlineBooking) => unwrap(api.PUT('/settings/clinic', { body: { settings: { online_booking } } as never })),
    onSuccess: (r) => {
      queryClient.setQueryData(['clinic'], (r as unknown as { data: Tenant }).data);
      void refresh();
      setDraft(null);
      toast.success(t('settings.saved'));
    },
    onError: toastError,
  });
  if (!clinic) return null;
  const v: OnlineBooking = draft ?? ((clinic.settings as unknown as { online_booking: OnlineBooking }).online_booking);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t('onlineBooking.settings.title')} description={t('onlineBooking.settings.subtitle')} />
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <Label htmlFor="ob-enabled">{t('onlineBooking.settings.enabled')}</Label>
            <Switch id="ob-enabled" checked={v.enabled} onCheckedChange={(x) => setDraft({ ...v, enabled: x })} />
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium">{t('onlineBooking.settings.mode')}</p>
            <Segmented<OnlineBooking['mode']>
              label={t('onlineBooking.settings.mode')}
              value={v.mode}
              onChange={(mode) => setDraft({ ...v, mode })}
              options={[{ value: 'request', label: t('onlineBooking.settings.modes.request') }, { value: 'instant', label: t('onlineBooking.settings.modes.instant') }]}
            />
            <p className="mt-1.5 text-xs text-fg-muted">{t(`onlineBooking.settings.modeHelp.${v.mode}`)}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('onlineBooking.settings.leadMinutes')} hint={t('onlineBooking.settings.leadHint')}>
              <Input type="number" min={0} step={15} value={v.min_lead_minutes} onChange={(e) => setDraft({ ...v, min_lead_minutes: Number(e.target.value) })} />
            </Field>
            <Field label={t('onlineBooking.settings.daysAhead')}>
              <Input type="number" min={1} max={180} value={v.max_days_ahead} onChange={(e) => setDraft({ ...v, max_days_ahead: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <Label htmlFor="ob-choice">{t('onlineBooking.settings.choosePractitioner')}</Label>
            <Switch id="ob-choice" checked={v.allow_practitioner_choice} onCheckedChange={(x) => setDraft({ ...v, allow_practitioner_choice: x })} />
          </div>
          <Field label={t('onlineBooking.settings.intro')} hint={t('onlineBooking.settings.introHint')}>
            <Textarea rows={2} maxLength={500} value={v.intro ?? ''} onChange={(e) => setDraft({ ...v, intro: e.target.value || null })} />
          </Field>
          <p className="text-xs text-fg-muted">{t('onlineBooking.settings.servicesHint')}</p>
          <div className="flex justify-end"><Button loading={save.isPending} disabled={!draft} onClick={() => save.mutate(v)}>{t('common:actions.saveChanges')}</Button></div>
        </CardContent>
      </Card>
      <BookingShareKit />
    </div>
  );
}
