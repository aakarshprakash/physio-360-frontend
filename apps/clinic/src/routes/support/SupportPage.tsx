import { api, SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, unwrap, type Paginated, type SupportContact, type SupportTicket } from '@physio/api';
import { Alert, Avatar, Badge, Button, Card, CardContent, CardHeader, cn, Dialog, DialogContent, EmptyState, Field, Input, PageHeader, Segmented, Select, Skeleton, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, Clock, LifeBuoy, Mail, MessageCircle, Phone, Plus, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { StatusBadge } from '../../components/common';
import { handleFormError, toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useUrlState } from '../../lib/hooks';

interface ListResponse extends Paginated<SupportTicket> {
  contact: SupportContact;
}

const PRIORITY_TONES = { low: 'neutral', normal: 'info', high: 'warning', urgent: 'danger' } as const;

export function SupportPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useUrlState('status', 'open');
  const [creating, setCreating] = useState(false);
  const selected = params.get('ticket') ? Number(params.get('ticket')) : null;
  const select = (id: number | null) =>
    setParams((p) => {
      if (id) p.set('ticket', String(id));
      else p.delete('ticket');
      return p;
    }, { replace: true });

  const { data, isLoading } = useQuery({
    queryKey: ['support', 'tickets', status],
    queryFn: () => unwrap(api.GET('/support/tickets', { params: { query: { status } as never } })) as unknown as Promise<ListResponse>,
  });

  return (
    <div>
      <PageHeader title={t('support.title')} description={t('support.subtitle')} actions={<Button onClick={() => setCreating(true)}><Plus />{t('support.newTicket')}</Button>} />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Card>
            <div className="border-b border-border p-3">
              <Segmented label={t('support.title')} value={status as 'open' | 'closed' | 'all'} onChange={setStatus} options={(['open', 'closed', 'all'] as const).map((s) => ({ value: s, label: t(`support.filters.${s}`) }))} />
            </div>
            {isLoading ? (
              <div className="space-y-2 p-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : !data?.data.length ? (
              <EmptyState icon={<LifeBuoy />} title={t('support.empty')} description={t('support.emptyHint')} />
            ) : (
              <ul className="divide-y divide-border">
                {data.data.map((ticket) => (
                  <li key={ticket.id}>
                    <button type="button" aria-current={selected === ticket.id || undefined} onClick={() => select(ticket.id)} className={cn('block w-full cursor-pointer px-4 py-3 text-start hover:bg-surface-2', selected === ticket.id && 'bg-primary-soft/50')}>
                      <span className="flex items-center gap-2">
                        <span className="tabular text-xs font-semibold text-fg-subtle">{ticket.number}</span>
                        <StatusBadge status={ticket.status} />
                        {ticket.last_reply_by === 'sysnac' && ticket.status === 'waiting_on_clinic' && <span className="size-2 rounded-full bg-primary" aria-hidden />}
                      </span>
                      <span className="mt-1 block truncate text-sm font-semibold">{ticket.subject}</span>
                      <span className="mt-0.5 block text-xs text-fg-muted">{t(`support.categories.${ticket.category}`)} · {f.instant(ticket.last_reply_at, 'd MMM, h:mm a')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {data?.contact && <ContactCard contact={data.contact} />}
        </div>

        {selected ? <TicketThread id={selected} /> : <QuickHelp />}
      </div>

      {creating && <NewTicketDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); select(id); }} />}
    </div>
  );
}

function TicketThread({ id }: { id: number }) {
  const { t } = useTranslation();
  const f = useFormat();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['support', 'ticket', id],
    queryFn: async () => (await unwrap(api.GET('/support/tickets/{ticket}', { params: { path: { ticket: id } } }))).data as SupportTicket,
  });

  const refresh = (updated: SupportTicket) => {
    queryClient.setQueryData(['support', 'ticket', id], updated);
    void queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
  };

  const send = useMutation({
    mutationFn: () => unwrap(api.POST('/support/tickets/{ticket}/messages', { params: { path: { ticket: id } }, body: { body: reply } as never })),
    onSuccess: (r) => {
      toast.success(t('support.replySent'));
      setReply('');
      refresh((r as unknown as { data: SupportTicket }).data);
    },
    onError: toastError,
  });

  const setStatus = useMutation({
    mutationFn: (status: 'open' | 'resolved' | 'closed') => unwrap(api.POST('/support/tickets/{ticket}/status', { params: { path: { ticket: id } }, body: { status } as never })),
    onSuccess: (r) => {
      toast.success(t('support.updated'));
      refresh((r as unknown as { data: SupportTicket }).data);
    },
    onError: toastError,
  });

  if (isLoading || !ticket) return <Skeleton className="h-96 rounded-xl" />;
  const closed = ticket.status === 'closed';

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="tabular text-xs font-semibold text-fg-subtle">{ticket.number}</p>
          <h2 className="text-base font-semibold">{ticket.subject}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <StatusBadge status={ticket.status} />
            <Badge tone={PRIORITY_TONES[ticket.priority as keyof typeof PRIORITY_TONES] ?? 'neutral'}>{t(`support.priorities.${ticket.priority}`)}</Badge>
            {t(`support.categories.${ticket.category}`)} · {t('support.openedBy')} {ticket.created_by}
          </p>
        </div>
        <div className="flex gap-2">
          {ticket.status === 'resolved' && (
            <Button variant="outline" size="sm" loading={setStatus.isPending} onClick={() => setStatus.mutate('open')}><RotateCcw />{t('support.reopen')}</Button>
          )}
          {!closed && ticket.status !== 'resolved' && (
            <Button variant="outline" size="sm" loading={setStatus.isPending} onClick={() => setStatus.mutate('resolved')}><CheckCircle2 />{t('support.markResolved')}</Button>
          )}
          {!closed && <Button variant="ghost" size="sm" onClick={() => setStatus.mutate('closed')}>{t('support.closeTicket')}</Button>}
        </div>
      </div>

      <ol className="flex-1 space-y-4 px-5 py-4" aria-label={ticket.subject}>
        {ticket.messages?.map((m) => {
          const sysnac = m.author_type === 'sysnac';
          return (
            <li key={m.id} className={cn('flex gap-3', sysnac ? 'flex-row' : 'flex-row-reverse')}>
              {sysnac ? (
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar text-white"><LifeBuoy className="size-4" /></span>
              ) : (
                <Avatar name={m.author_name} size={32} />
              )}
              <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5', sysnac ? 'rounded-ss-sm bg-surface-2' : 'rounded-se-sm bg-primary-soft')}>
                <p className="text-xs font-semibold">{sysnac ? t('support.sysnac') : m.author_name} <span className="font-normal text-fg-muted">· {f.instant(m.created_at, 'd MMM, h:mm a')}</span></p>
                <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border p-4">
        {closed ? (
          <Alert tone="info">{t('support.closedNote')}</Alert>
        ) : (
          <div className="space-y-2">
            <Textarea aria-label={t('support.replyPlaceholder')} rows={3} placeholder={t('support.replyPlaceholder')} value={reply} onChange={(e) => setReply(e.target.value)} />
            <div className="flex justify-end">
              <Button loading={send.isPending} disabled={!reply.trim()} onClick={() => send.mutate()}><Send className="rtl:-scale-x-100" />{t('support.sendReply')}</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function ContactCard({ contact }: { contact: SupportContact }) {
  const { t } = useTranslation();
  const whatsapp = contact.whatsapp?.replace(/\D/g, '');
  return (
    <Card>
      <CardHeader title={t('support.contact')} />
      <CardContent>
        <ul className="space-y-2.5 text-sm">
          <li className="flex items-center gap-3"><Mail className="size-4 text-fg-subtle" /><a className="text-primary hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a></li>
          {contact.phone && <li className="flex items-center gap-3"><Phone className="size-4 text-fg-subtle" /><a dir="ltr" className="tabular hover:underline" href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a></li>}
          {whatsapp && <li className="flex items-center gap-3"><MessageCircle className="size-4 text-fg-subtle" /><a className="text-primary hover:underline" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">{t('support.whatsapp')}</a></li>}
          {contact.hours && <li className="flex items-center gap-3"><Clock className="size-4 text-fg-subtle" /><span><span className="text-fg-muted">{t('support.hours')}:</span> {contact.hours}</span></li>}
          {contact.docs_url && <li className="flex items-center gap-3"><BookOpen className="size-4 text-fg-subtle" /><a className="text-primary hover:underline" href={contact.docs_url} target="_blank" rel="noopener noreferrer">{t('support.guide')}</a></li>}
        </ul>
      </CardContent>
    </Card>
  );
}

function QuickHelp() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader title={t('support.quickHelp')} />
      <CardContent className="space-y-2">
        {(['1', '2', '3', '4'] as const).map((n) => (
          <details key={n} className="group rounded-xl border border-border px-4 py-3 open:bg-surface-2">
            <summary className="cursor-pointer list-none text-sm font-semibold marker:hidden">{t(`support.faq.q${n}`)}</summary>
            <p className="mt-2 text-sm text-fg-muted">{t(`support.faq.a${n}`)}</p>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}

function NewTicketDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ subject: '', category: 'question', priority: 'normal', body: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => unwrap(api.POST('/support/tickets', { body: form as never })),
    onSuccess: (r) => {
      const ticket = (r as unknown as { data: SupportTicket }).data;
      toast.success(t('support.created', { number: ticket.number }));
      void queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
      onCreated(ticket.id);
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={t('support.newTicket')}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={save.isPending} disabled={!form.subject.trim() || !form.body.trim()} onClick={() => save.mutate()}>{t('support.submit')}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('support.subject')} required error={errors.subject} className="sm:col-span-2"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
          <Field label={t('support.category')}>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {SUPPORT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`support.categories.${c}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('support.priority')}>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {SUPPORT_PRIORITIES.map((p) => <option key={p} value={p}>{t(`support.priorities.${p}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('support.description')} required error={errors.body} hint={t('support.descriptionHint')} className="sm:col-span-2">
            <Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
