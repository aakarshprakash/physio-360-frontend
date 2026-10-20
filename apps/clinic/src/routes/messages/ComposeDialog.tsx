import { api, MESSAGE_CHANNELS, unwrap, type ChannelReadiness, type Message, type MessageChannel, type MessageTemplate } from '@physio/api';
import { Alert, Avatar, Button, Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Field, Input, Segmented, Select, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Braces, ExternalLink, Send, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PatientPicker } from '../../components/common';
import { toastError } from '../../lib/errors';

interface Recipient {
  id: number;
  full_name: string;
  mrn?: string;
}

interface Result {
  data: Message[];
  skipped: { patient_id: number; name: string | null; reason: string }[];
}

export function useTemplates() {
  return useQuery({
    queryKey: ['message-templates'],
    queryFn: () => unwrap(api.GET('/message-templates')) as unknown as Promise<{ data: MessageTemplate[]; placeholders: string[]; channels: ChannelReadiness }>,
    staleTime: 60_000,
  });
}

/** Opens the prefilled WhatsApp / SMS link of a "manual" message. */
export function ShareLink({ message }: { message: Message }) {
  const { t } = useTranslation();
  if (!message.share_url) return null;
  return (
    <Button asChild size="sm" variant="secondary">
      <a href={message.share_url} target="_blank" rel="noopener noreferrer">
        <ExternalLink />
        {message.channel === 'whatsapp' ? t('messages.openWhatsApp') : t('messages.openSms')}
      </a>
    </Button>
  );
}

export function ComposeDialog({ initialRecipients = [], onClose }: { initialRecipients?: Recipient[]; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: catalog } = useTemplates();
  const [channel, setChannel] = useState<MessageChannel>('whatsapp');
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const templates = useMemo(() => (catalog?.data ?? []).filter((x) => x.channel === channel && x.is_active), [catalog, channel]);
  const ready = catalog?.channels?.[channel] ?? channel === 'email';

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((x) => String(x.id) === id);
    if (tpl) {
      setBody(tpl.body);
      setSubject(tpl.subject ?? '');
    }
  };

  const insert = (key: string) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const previewMutation = useMutation({
    mutationFn: () => unwrap(api.POST('/messages/preview', { body: { body, patient_id: recipients[0]?.id ?? null } as never })) as unknown as Promise<{ data: { body: string } }>,
    onSuccess: (r) => setPreview(r.data.body),
    onError: toastError,
  });

  const send = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/messages', {
        body: {
          channel,
          patient_ids: recipients.map((r) => r.id),
          template_id: templateId ? Number(templateId) : null,
          body,
          subject: channel === 'email' ? subject || null : null,
          purpose: templates.find((x) => String(x.id) === templateId)?.purpose ?? 'general',
        } as never,
      })) as unknown as Promise<Result>,
    onSuccess: (r) => {
      toast.success(t('messages.queued', { count: r.data.length }));
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
      if (r.data.some((m) => m.status === 'manual') || r.skipped.length) setResult(r);
      else onClose();
    },
    onError: toastError,
  });

  if (result) {
    const manual = result.data.filter((m) => m.status === 'manual');
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent size="lg" title={t('messages.manualReady')} closeLabel={t('common:actions.close')} footer={<Button onClick={onClose}>{t('common:actions.close')}</Button>}>
          {manual.length > 0 && <Alert tone="info" className="mb-4">{t('messages.manualHint')}</Alert>}
          <ul className="divide-y divide-border">
            {manual.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.patient?.full_name ?? '?'} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.patient?.full_name}</p>
                  <p dir="ltr" className="tabular truncate text-xs text-fg-muted">{m.recipient}</p>
                </div>
                <ShareLink message={m} />
              </li>
            ))}
          </ul>
          {result.skipped.length > 0 && (
            <Alert tone="warning" title={t('messages.skipped', { count: result.skipped.length })} className="mt-4">
              <ul className="list-disc ps-5">
                {result.skipped.map((s) => <li key={s.patient_id}>{s.name ?? `#${s.patient_id}`}: {t(`messages.skipReasons.${s.reason}`, { defaultValue: s.reason })}</li>)}
              </ul>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={t('messages.compose')}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={send.isPending} disabled={!recipients.length || !body.trim()} onClick={() => send.mutate()}>
              <Send className="rtl:-scale-x-100" />
              {t('messages.sendCount', { count: recipients.length })}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[13px] font-medium">{t('messages.channel')}</p>
            <Segmented
              label={t('messages.channel')}
              value={channel}
              onChange={(c) => {
                setChannel(c);
                setTemplateId('');
              }}
              options={MESSAGE_CHANNELS.map((c) => ({ value: c, label: t(`messages.channels.${c}`) }))}
            />
            {!ready && <p className="mt-2 text-xs text-fg-muted">{t('messages.gatewayMissing')}</p>}
          </div>

          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium">
              {t('messages.recipients')}
              <span aria-hidden className="ms-0.5 text-danger">*</span>
            </legend>
            <div className="space-y-2">
              {recipients.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label={t('messages.recipients')}>
                  {recipients.map((r) => (
                    <li key={r.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 ps-1 pe-1.5 text-[13px]">
                      <Avatar name={r.full_name} size={22} />
                      {r.full_name}
                      <button type="button" className="grid size-5 cursor-pointer place-items-center rounded-full text-fg-subtle hover:bg-surface-3" aria-label={`${t('common:actions.clear')} ${r.full_name}`} onClick={() => setRecipients(recipients.filter((x) => x.id !== r.id))}>
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <PatientPicker value={null} onChange={(p) => p && !recipients.some((r) => r.id === p.id) && setRecipients([...recipients, { id: p.id, full_name: p.full_name, mrn: p.mrn }])} />
            </div>
          </fieldset>

          <Field label={t('messages.template')}>
            <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">{t('messages.noTemplate')}</option>
              {templates.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.locale.toUpperCase()}</option>)}
            </Select>
          </Field>

          {channel === 'email' && (
            <Field label={t('messages.subject')}>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
          )}

          <div className="space-y-2">
            <Field label={t('messages.body')} required hint={t('messages.characters', { count: body.length })}>
              <Textarea ref={bodyRef} rows={6} value={body} onChange={(e) => { setBody(e.target.value); setPreview(null); }} />
            </Field>
            <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm"><Braces />{t('messages.insertField')}</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                    {(catalog?.placeholders ?? []).map((p) => <DropdownMenuItem key={p} onSelect={() => insert(p)}><code className="text-xs">{`{{${p}}}`}</code></DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="sm" disabled={!body.trim()} loading={previewMutation.isPending} onClick={() => previewMutation.mutate()}>{t('messages.preview')}</Button>
            </div>
          </div>

          {preview !== null && (
            <div className="rounded-xl border border-border bg-surface-2 p-3">
              <p className="mb-1 text-xs font-semibold text-fg-subtle">{recipients[0] ? t('messages.previewFor', { name: recipients[0].full_name }) : t('messages.preview')}</p>
              <p className="whitespace-pre-line text-sm">{preview}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
