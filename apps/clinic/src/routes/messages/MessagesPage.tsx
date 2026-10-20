import { api, MESSAGE_CHANNELS, MESSAGE_PURPOSES, unwrap, type ChannelReadiness, type Message, type MessageTemplate, type Paginated } from '@physio/api';
import { SUPPORTED_LANGUAGES } from '@physio/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  Switch,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Td,
  Textarea,
  Th,
  toast,
  Tr,
} from '@physio/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Mail, MessageCircle, MessageSquareText, Pencil, Plus, Send, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { StatusBadge } from '../../components/common';
import { handleFormError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useDebounced, useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';
import { ComposeDialog, ShareLink, useTemplates } from './ComposeDialog';

export const CHANNEL_ICONS = { whatsapp: MessageCircle, sms: Smartphone, email: Mail } as const;

interface LogResponse extends Paginated<Message> {
  summary: { sent_30d: number; manual_30d: number; failed_30d: number; queued: number };
  channels: ChannelReadiness;
}

export function MessagesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useUrlState('tab', 'log');
  const [composing, setComposing] = useState(false);

  return (
    <div>
      <PageHeader
        title={t('messages.title')}
        description={t('messages.subtitle')}
        actions={
          <Button onClick={() => setComposing(true)}>
            <Send className="rtl:-scale-x-100" />
            {t('messages.compose')}
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label={t('messages.title')}>
          <TabsTrigger value="log">{t('messages.log')}</TabsTrigger>
          <TabsTrigger value="templates">{t('messages.templates')}</TabsTrigger>
        </TabsList>
        <div className="pt-5">
          <TabsContent value="log">{tab === 'log' && <MessageLog />}</TabsContent>
          <TabsContent value="templates">{tab === 'templates' && <Templates />}</TabsContent>
        </div>
      </Tabs>
      {composing && <ComposeDialog onClose={() => setComposing(false)} />}
    </div>
  );
}

function MessageLog() {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useSession();
  const [channel, setChannel] = useUrlState('channel');
  const [status, setStatus] = useUrlState('status');
  const [purpose, setPurpose] = useUrlState('purpose');
  const [page, setPage] = useUrlState('page', '1');
  const [text, setText] = useState('');
  const search = useDebounced(text, 300);
  const [open, setOpen] = useState<Message | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['messages', { channel, status, purpose, page, search }],
    queryFn: () =>
      unwrap(api.GET('/messages', {
        params: { query: { channel: channel || undefined, status: status || undefined, purpose: purpose || undefined, search: search || undefined, page: Number(page) } as never },
      })) as unknown as Promise<LogResponse>,
    placeholderData: keepPreviousData,
  });

  const gatewayMissing = data && (!data.channels.whatsapp || !data.channels.sms);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('messages.log')}>
        {data ? (
          <>
            <StatCard label={t('messages.summary.sent')} value={data.summary.sent_30d} icon={<Send />} tone="primary" />
            <StatCard label={t('messages.summary.manual')} value={data.summary.manual_30d} icon={<MessageCircle />} tone="info" />
            <StatCard label={t('messages.summary.failed')} value={data.summary.failed_30d} icon={<AlertTriangle />} tone="warning" />
            <StatCard label={t('messages.summary.queued')} value={data.summary.queued} icon={<Clock />} tone="violet" />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        )}
      </section>

      {gatewayMissing && (
        <Alert tone="info">
          {t('messages.gatewayMissing')}{' '}
          {can('settings.manage') && <Link to="/settings?section=messaging" className="font-semibold underline">{t('messages.connect')}</Link>}
        </Alert>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <SearchInput className="min-w-52 flex-1" placeholder={t('consultations.patient')} aria-label={t('common:actions.search')} value={text} onChange={(e) => setText(e.target.value)} />
          <Select aria-label={t('messages.channel')} className="w-40" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">{t('messages.allChannels')}</option>
            {MESSAGE_CHANNELS.map((c) => <option key={c} value={c}>{t(`messages.channels.${c}`)}</option>)}
          </Select>
          <Select aria-label={t('messages.purpose')} className="w-48" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            <option value="">{t('messages.allPurposes')}</option>
            {MESSAGE_PURPOSES.map((p) => <option key={p} value={p}>{t(`messages.purposes.${p}`)}</option>)}
          </Select>
          <Select aria-label={t('messages.status')} className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('messages.allStatuses')}</option>
            {['queued', 'sent', 'delivered', 'failed', 'manual'].map((s) => <option key={s} value={s}>{t(`common:status.${s}`)}</option>)}
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.data.length ? (
          <EmptyState icon={<MessageSquareText />} title={t('messages.empty')} description={t('messages.emptyHint')} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{t('messages.when')}</Th>
                  <Th>{t('messages.to')}</Th>
                  <Th>{t('messages.channel')}</Th>
                  <Th>{t('messages.body')}</Th>
                  <Th>{t('messages.status')}</Th>
                  <Th>{t('messages.sentBy')}</Th>
                  <Th><span className="sr-only">{t('common:actions.more')}</span></Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((m) => {
                  const Icon = CHANNEL_ICONS[m.channel as keyof typeof CHANNEL_ICONS] ?? MessageSquareText;
                  return (
                    <Tr key={m.id} interactive onClick={() => setOpen(m)}>
                      <Td className="whitespace-nowrap text-fg-muted">{f.instant(m.sent_at ?? m.created_at, 'd MMM, h:mm a')}</Td>
                      <Td>
                        {m.patient ? (
                          <Link to={`/patients/${m.patient.id}?tab=timeline`} onClick={(e) => e.stopPropagation()} className="block max-w-44 truncate font-medium hover:underline">{m.patient.full_name}</Link>
                        ) : '—'}
                        <span dir="ltr" className="tabular block max-w-44 truncate text-xs text-fg-muted">{m.recipient}</span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5"><Icon className="size-4 text-fg-subtle" />{t(`messages.channels.${m.channel}`)}</span>
                        <span className="block text-xs text-fg-muted">{t(`messages.purposes.${m.purpose}`, { defaultValue: m.purpose })}</span>
                      </Td>
                      <Td className="max-w-80"><p className="line-clamp-2 text-[13px] text-fg-muted">{m.body}</p></Td>
                      <Td><StatusBadge status={m.status} /></Td>
                      <Td className="whitespace-nowrap text-fg-muted">{m.sent_by ?? t('messages.automatic')}</Td>
                      <Td onClick={(e) => e.stopPropagation()}><ShareLink message={m} /></Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination
              page={data.meta.current_page}
              lastPage={data.meta.last_page}
              total={data.meta.total}
              onChange={(p) => setPage(String(p))}
              labels={{ previous: t('common:pagination.previous'), next: t('common:pagination.next'), page: (pg, tot) => t('common:pagination.page', { page: pg, total: tot }) }}
            />
          </>
        )}
      </Card>

      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(null)}>
          <DialogContent title={open.subject ?? t(`messages.purposes.${open.purpose}`, { defaultValue: open.purpose })} description={`${open.patient?.full_name ?? ''} · ${open.recipient}`} closeLabel={t('common:actions.close')} footer={<ShareLink message={open} />}>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={open.status} />
                <Badge>{t(`messages.channels.${open.channel}`)}</Badge>
                {open.invoice && <Badge tone="info">{open.invoice.number}</Badge>}
              </div>
              <p className="whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{open.body}</p>
              {open.error && <Alert tone="danger">{open.error}</Alert>}
              <p className="text-xs text-fg-muted">{f.instant(open.created_at)} · {open.sent_by ?? t('messages.automatic')}</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Templates() {
  const { t } = useTranslation();
  const { can } = useSession();
  const { data, isLoading } = useTemplates();
  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null);
  const manage = can('settings.manage');

  if (isLoading) return <Skeleton className="h-60 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!manage ? <p className="text-sm text-fg-muted">{t('messages.adminOnly')}</p> : <span />}
        {manage && <Button onClick={() => setEditing('new')}><Plus />{t('messages.newTemplate')}</Button>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.data.map((tpl) => {
          const Icon = CHANNEL_ICONS[tpl.channel as keyof typeof CHANNEL_ICONS] ?? MessageSquareText;
          return (
            <Card key={tpl.id} className={tpl.is_active ? 'p-4' : 'p-4 opacity-60'}>
              <div className="mb-2 flex items-start gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-fg"><Icon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold" lang={tpl.locale}>{tpl.name}</p>
                  <p className="text-xs text-fg-muted">{t(`messages.purposes.${tpl.purpose}`)} · {SUPPORTED_LANGUAGES.find((l) => l.code === tpl.locale)?.label ?? tpl.locale}</p>
                </div>
                {tpl.is_default && <Badge tone="primary">{t('messages.default')}</Badge>}
                {manage && <Button variant="ghost" size="icon-sm" aria-label={t('messages.editTemplate')} onClick={() => setEditing(tpl)}><Pencil /></Button>}
              </div>
              <p lang={tpl.locale} dir={tpl.locale === 'ar' ? 'rtl' : 'ltr'} className="line-clamp-4 whitespace-pre-line text-[13px] text-fg-muted">{tpl.body}</p>
            </Card>
          );
        })}
      </div>
      {editing && <TemplateDialog template={editing === 'new' ? undefined : editing} placeholders={data?.placeholders ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TemplateDialog({ template, placeholders, onClose }: { template?: MessageTemplate; placeholders: string[]; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: template?.name ?? '',
    purpose: template?.purpose ?? 'general',
    channel: template?.channel ?? 'whatsapp',
    locale: template?.locale ?? 'en',
    subject: template?.subject ?? '',
    body: template?.body ?? '',
    is_default: template?.is_default ?? false,
    is_active: template?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, subject: form.subject || null };
      return template
        ? unwrap(api.PUT('/message-templates/{template}', { params: { path: { template: template.id } }, body: body as never }))
        : unwrap(api.POST('/message-templates', { body: body as never }));
    },
    onSuccess: () => {
      toast.success(t('messages.templateSaved'));
      void queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      onClose();
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  const set = (k: 'name' | 'purpose' | 'channel' | 'locale' | 'subject' | 'body') => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={template ? t('messages.editTemplate') : t('messages.newTemplate')}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={save.isPending} disabled={!form.name.trim() || !form.body.trim()} onClick={() => save.mutate()}>{t('common:actions.save')}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('messages.templateName')} required error={errors.name} className="sm:col-span-2"><Input value={form.name} onChange={set('name')} /></Field>
          <Field label={t('messages.purpose')}>
            <Select value={form.purpose} onChange={set('purpose')}>{MESSAGE_PURPOSES.map((p) => <option key={p} value={p}>{t(`messages.purposes.${p}`)}</option>)}</Select>
          </Field>
          <Field label={t('messages.channel')}>
            <Select value={form.channel} onChange={set('channel')}>{MESSAGE_CHANNELS.map((c) => <option key={c} value={c}>{t(`messages.channels.${c}`)}</option>)}</Select>
          </Field>
          <Field label={t('messages.language')}>
            <Select value={form.locale} onChange={set('locale')}>{SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</Select>
          </Field>
          {form.channel === 'email' && <Field label={t('messages.subject')}><Input value={form.subject} onChange={set('subject')} /></Field>}
          <Field label={t('messages.body')} required error={errors.body} className="sm:col-span-2" hint={placeholders.map((p) => `{{${p}}}`).join('  ')}>
            <Textarea rows={6} lang={form.locale} dir={form.locale === 'ar' ? 'rtl' : 'ltr'} value={form.body} onChange={set('body')} />
          </Field>
          <label className="flex items-center gap-3 text-sm"><Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />{t('messages.isDefault')}</label>
          <label className="flex items-center gap-3 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />{t('settings.active')}</label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
