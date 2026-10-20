import { api, MESSAGE_CHANNELS, unwrap, type ChannelReadiness, type Message, type MessageChannel, type PageMeta, type ReminderAutomation, type ReminderRow } from '@physio/api';
import { Alert, Avatar, Badge, Button, Card, CardContent, CardHeader, Checkbox, Dialog, DialogContent, EmptyState, Field, Input, PageHeader, Pagination, SearchInput, Segmented, Select, Skeleton, StatCard, Switch, Table, Td, Th, toast, Tr } from '@physio/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, BellRing, CheckCircle2, Banknote, ReceiptText, Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useDebounced, useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';
import { ShareLink } from '../messages/ComposeDialog';

interface Response {
  data: ReminderRow[];
  meta: PageMeta;
  summary: { invoices: number; amount_due_minor: number; overdue: number };
  automation: ReminderAutomation;
  channels: ChannelReadiness;
}

const FILTERS = ['all', 'due', '7', '30', '60'] as const;

export function PaymentRemindersPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { branchId, can } = useSession();
  const [overdue, setOverdue] = useUrlState('overdue', 'all');
  const [page, setPage] = useUrlState('page', '1');
  const [text, setText] = useState('');
  const search = useDebounced(text, 300);
  const [selected, setSelected] = useState<number[]>([]);
  const [sending, setSending] = useState<number[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payment-reminders', { overdue, page, search, branchId }],
    queryFn: () =>
      unwrap(api.GET('/payment-reminders', {
        params: { query: { overdue, search: search || undefined, branch_id: branchId ?? undefined, page: Number(page) } as never },
      })) as unknown as Promise<Response>,
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  return (
    <div>
      <PageHeader
        title={t('reminders.title')}
        description={t('reminders.subtitle')}
        actions={
          <Button disabled={!selected.length} onClick={() => setSending(selected)}>
            <Send className="rtl:-scale-x-100" />
            {t('reminders.remindSelected', { count: selected.length })}
          </Button>
        }
      />

      <div className="mb-5 grid gap-5 xl:grid-cols-[1fr_380px]">
        <section className="grid content-start gap-4 sm:grid-cols-3" aria-label={t('reminders.title')}>
          {data ? (
            <>
              <StatCard label={t('reminders.summary.count')} value={data.summary.invoices} icon={<ReceiptText />} tone="info" />
              <StatCard label={t('reminders.summary.amount')} value={f.money(data.summary.amount_due_minor)} icon={<Banknote />} tone="primary" />
              <StatCard label={t('reminders.summary.overdue')} value={data.summary.overdue} icon={<AlarmClock />} tone="warning" />
            </>
          ) : (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
          )}
        </section>
        {data && <AutomationCard automation={data.automation} channels={data.channels} editable={can('settings.manage')} />}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Segmented label={t('reminders.title')} value={overdue as (typeof FILTERS)[number]} onChange={(v) => { setOverdue(v); setSelected([]); }} options={FILTERS.map((x) => ({ value: x, label: t(`reminders.filters.${x}`) }))} />
          <SearchInput className="min-w-52 flex-1" placeholder={`${t('reminders.invoice')} / ${t('reminders.patient')}`} aria-label={t('common:actions.search')} value={text} onChange={(e) => setText(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !rows.length ? (
          <EmptyState icon={<CheckCircle2 />} title={t('reminders.empty')} description={t('reminders.emptyHint')} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">
                    <Checkbox aria-label={t('reminders.selectAll')} checked={allSelected} onCheckedChange={(v) => setSelected(v ? rows.map((r) => r.id) : [])} />
                  </Th>
                  <Th>{t('reminders.invoice')}</Th>
                  <Th>{t('reminders.patient')}</Th>
                  <Th>{t('reminders.due')}</Th>
                  <Th className="text-end">{t('reminders.balance')}</Th>
                  <Th>{t('reminders.reminded')}</Th>
                  <Th><span className="sr-only">{t('reminders.remind')}</span></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <Checkbox aria-label={t('reminders.select', { number: r.number })} checked={selected.includes(r.id)} onCheckedChange={(v) => setSelected(v ? [...selected, r.id] : selected.filter((x) => x !== r.id))} />
                    </Td>
                    <Td><Link to={`/billing/invoices/${r.id}`} className="tabular font-semibold hover:underline">{r.number}</Link></Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.patient.full_name} size={30} />
                        <div className="min-w-0">
                          <Link to={`/patients/${r.patient.id}?tab=billing`} className="block max-w-44 truncate font-medium hover:underline">{r.patient.full_name}</Link>
                          {!r.patient.has_phone && !r.patient.has_email && <span className="text-xs text-danger">{t('reminders.noContact')}</span>}
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {f.local(r.due_date)}
                      <span className="block">
                        {r.days_overdue > 0 ? (
                          <Badge tone={r.days_overdue >= 30 ? 'danger' : 'warning'}>{t('reminders.overdue', { count: r.days_overdue })}</Badge>
                        ) : (
                          <span className="text-xs text-fg-muted">{t('reminders.notDue')}</span>
                        )}
                      </span>
                    </Td>
                    <Td className="tabular whitespace-nowrap text-end font-semibold">{f.money(r.balance_minor)}</Td>
                    <Td className="whitespace-nowrap text-fg-muted">
                      {r.last_reminded_at ? (
                        <>
                          {f.instant(r.last_reminded_at, 'd MMM')}
                          <span className="ms-1 text-xs">{t('reminders.times', { count: r.reminder_count })}</span>
                        </>
                      ) : t('reminders.never')}
                    </Td>
                    <Td>
                      <Button variant="secondary" size="sm" onClick={() => setSending([r.id])}>
                        <BellRing />
                        {t('reminders.remind')}
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={data!.meta.current_page}
              lastPage={data!.meta.last_page}
              total={data!.meta.total}
              onChange={(p) => setPage(String(p))}
              labels={{ previous: t('common:pagination.previous'), next: t('common:pagination.next'), page: (pg, tot) => t('common:pagination.page', { page: pg, total: tot }) }}
            />
          </>
        )}
      </Card>

      {sending && data && (
        <SendDialog
          invoiceIds={sending}
          channels={data.channels}
          defaultChannel={data.automation.channel}
          onClose={(done) => {
            setSending(null);
            if (done) setSelected([]);
          }}
        />
      )}
    </div>
  );
}

function SendDialog({ invoiceIds, channels, defaultChannel, onClose }: { invoiceIds: number[]; channels: ChannelReadiness; defaultChannel: MessageChannel; onClose: (done: boolean) => void }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<MessageChannel>(channels.whatsapp ? 'whatsapp' : defaultChannel === 'email' ? 'email' : 'whatsapp');
  const [withLink, setWithLink] = useState<boolean>(Boolean(session.tenant.online_payments_enabled));
  const [result, setResult] = useState<{ data: Message[]; skipped: { invoice_id: number; number: string; reason: string }[] } | null>(null);

  const send = useMutation({
    mutationFn: () => unwrap(api.POST('/payment-reminders', { body: { invoice_ids: invoiceIds, channel, include_payment_link: withLink } as never })) as unknown as Promise<NonNullable<typeof result>>,
    onSuccess: (r) => {
      toast.success(t('reminders.created', { count: r.data.length }));
      void queryClient.invalidateQueries({ queryKey: ['payment-reminders'] });
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
      if (r.data.some((m) => m.status === 'manual') || r.skipped.length) setResult(r);
      else onClose(true);
    },
    onError: toastError,
  });

  if (result) {
    const manual = result.data.filter((m) => m.status === 'manual');
    return (
      <Dialog open onOpenChange={(o) => !o && onClose(true)}>
        <DialogContent title={t('messages.manualReady')} closeLabel={t('common:actions.close')} footer={<Button onClick={() => onClose(true)}>{t('common:actions.close')}</Button>}>
          {manual.length > 0 && <Alert tone="info" className="mb-3">{t('messages.manualHint')}</Alert>}
          <ul className="divide-y divide-border">
            {manual.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.patient?.full_name} · <span className="tabular">{m.invoice?.number}</span></p>
                  <p dir="ltr" className="tabular text-xs text-fg-muted">{m.recipient}</p>
                </div>
                <ShareLink message={m} />
              </li>
            ))}
          </ul>
          {result.skipped.length > 0 && (
            <Alert tone="warning" className="mt-3" title={t('messages.skipped', { count: result.skipped.length })}>
              <ul className="list-disc ps-5">{result.skipped.map((s) => <li key={s.invoice_id}>{s.number}: {t(`messages.skipReasons.${s.reason}`, { defaultValue: s.reason })}</li>)}</ul>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent
        title={t('reminders.remindSelected', { count: invoiceIds.length })}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => onClose(false)}>{t('common:actions.cancel')}</Button>
            <Button loading={send.isPending} onClick={() => send.mutate()}><Send className="rtl:-scale-x-100" />{t('messages.send')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[13px] font-medium">{t('reminders.channel')}</p>
            <Segmented label={t('reminders.channel')} value={channel} onChange={setChannel} options={MESSAGE_CHANNELS.map((c) => ({ value: c, label: t(`messages.channels.${c}`) }))} />
            {!channels[channel] && <p className="mt-2 text-xs text-fg-muted">{t('messages.manualHint')}</p>}
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={withLink} disabled={!session.tenant.online_payments_enabled} onCheckedChange={setWithLink} />
            {session.tenant.online_payments_enabled ? t('reminders.includeLink') : t('reminders.linkUnavailable')}
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AutomationCard({ automation, channels, editable }: { automation: ReminderAutomation; channels: ChannelReadiness; editable: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [form, setForm] = useState({ ...automation, days: automation.days_after_due.join(', ') });

  const save = useMutation({
    mutationFn: () => {
      const days = [...new Set(form.days.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 180))].sort((a, b) => a - b).slice(0, 6);
      return unwrap(api.PUT('/settings/clinic', {
        body: { settings: { payment_reminders: { enabled: form.enabled, channel: form.channel, days_after_due: days, include_payment_link: form.include_payment_link } } } as never,
      }));
    },
    onSuccess: () => {
      toast.success(t('reminders.automation.saved'));
      void queryClient.invalidateQueries({ queryKey: ['payment-reminders'] });
    },
    onError: toastError,
  });

  return (
    <Card>
      <CardHeader title={t('reminders.automation.title')} description={t('reminders.automation.description')} />
      <CardContent className="space-y-3">
        <label className="flex items-center gap-3 text-sm font-medium">
          <Switch checked={form.enabled} disabled={!editable} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          {t('reminders.automation.enabled')}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('reminders.channel')}>
            <Select value={form.channel} disabled={!editable} onChange={(e) => setForm({ ...form, channel: e.target.value as MessageChannel })}>
              {MESSAGE_CHANNELS.map((c) => <option key={c} value={c} disabled={!channels[c]}>{t(`messages.channels.${c}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('reminders.automation.days')}>
            <Input inputMode="numeric" disabled={!editable} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
          </Field>
        </div>
        {session.tenant.online_payments_enabled && (
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={form.include_payment_link} disabled={!editable} onCheckedChange={(v) => setForm({ ...form, include_payment_link: v })} />
            {t('reminders.includeLink')}
          </label>
        )}
        {(!channels.sms || !channels.whatsapp) && <p className="text-xs text-fg-muted">{t('reminders.automation.needsGateway')}</p>}
        {editable && (
          <div className="flex justify-end">
            <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>{t('reminders.automation.save')}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
