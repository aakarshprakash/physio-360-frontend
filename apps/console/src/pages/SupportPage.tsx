import { api, unwrap, type SupportTicket } from '@physio/api';
import { Badge, Button, Card, cn, EmptyState, PageHeader, Pagination, SearchInput, Select, Skeleton, StatCard, Textarea, toast } from '@physio/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Inbox, LifeBuoy, MessageSquareReply, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

type Ticket = SupportTicket & { clinic: { id: number; name: string | null; slug?: string; plan?: string } };

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_clinic: 'Waiting on clinic',
  resolved: 'Resolved',
  closed: 'Closed',
};
const STATUS_TONES = { open: 'info', in_progress: 'violet', waiting_on_clinic: 'warning', resolved: 'success', closed: 'neutral' } as const;
const PRIORITY_TONES = { low: 'neutral', normal: 'info', high: 'warning', urgent: 'danger' } as const;

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status as keyof typeof STATUS_TONES] ?? 'neutral'}>{STATUS_LABELS[status] ?? status}</Badge>;
}

/** SYSNAC support desk: tickets from every clinic, oldest unanswered first. */
export function SupportPage() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('open_all');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const selected = params.get('ticket') ? Number(params.get('ticket')) : null;

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-support', status, priority, debounced, page],
    queryFn: () =>
      unwrap(api.GET('/platform/support/tickets', {
        params: { query: { status, priority: priority || undefined, search: debounced || undefined, page } as never },
      })) as unknown as Promise<{ data: Ticket[]; meta: { current_page: number; last_page: number; total: number }; summary: { open: number; awaiting_sysnac: number; high_priority: number } }>,
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader title="Support desk" description="Requests from every clinic. Never ask clinics for patient health information." />
      <section className="mb-5 grid gap-4 sm:grid-cols-3" aria-label="Support figures">
        {data ? (
          <>
            <StatCard label="Open tickets" value={data.summary.open} icon={<Inbox />} tone="info" />
            <StatCard label="Awaiting SYSNAC" value={data.summary.awaiting_sysnac} icon={<MessageSquareReply />} tone="primary" />
            <StatCard label="High / urgent" value={data.summary.high_priority} icon={<AlertTriangle />} tone="warning" />
          </>
        ) : (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <Card>
          <div className="flex flex-wrap gap-2 border-b border-border p-3">
            <SearchInput className="min-w-40 flex-1" placeholder="Subject or SUP number" aria-label="Search tickets" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <Select aria-label="Status" className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="open_all">All open</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select aria-label="Priority" className="w-32" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
              <option value="">Any priority</option>
              {Object.keys(PRIORITY_TONES).map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
            </Select>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : !data?.data.length ? (
            <EmptyState icon={<LifeBuoy />} title="No tickets" description="Nothing matches these filters." />
          ) : (
            <>
              <ul className="divide-y divide-border">
                {data.data.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      aria-current={selected === t.id || undefined}
                      onClick={() => setParams({ ticket: String(t.id) }, { replace: true })}
                      className={cn('block w-full cursor-pointer px-4 py-3 text-start hover:bg-surface-2', selected === t.id && 'bg-primary-soft/50')}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="tabular text-xs font-semibold text-fg-subtle">{t.number}</span>
                        <StatusBadge status={t.status} />
                        <Badge tone={PRIORITY_TONES[t.priority as keyof typeof PRIORITY_TONES] ?? 'neutral'} className="capitalize">{t.priority}</Badge>
                        {t.last_reply_by === 'clinic' && t.status !== 'closed' && <span className="size-2 rounded-full bg-primary" title="Clinic replied" aria-label="Clinic replied" />}
                      </span>
                      <span className="mt-1 block truncate text-sm font-semibold">{t.subject}</span>
                      <span className="mt-0.5 block truncate text-xs text-fg-muted">{t.clinic.name} · {when(t.last_reply_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />
            </>
          )}
        </Card>

        {selected ? <TicketPanel id={selected} /> : (
          <Card className="grid place-items-center p-10 text-sm text-fg-muted">Select a ticket to read and reply.</Card>
        )}
      </div>
    </div>
  );
}

function TicketPanel({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [nextStatus, setNextStatus] = useState('');

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['platform-support', 'ticket', id],
    queryFn: async () => (await unwrap(api.GET('/platform/support/tickets/{ticket}', { params: { path: { ticket: id } } }))).data as unknown as Ticket,
  });

  const done = (r: unknown, message: string) => {
    queryClient.setQueryData(['platform-support', 'ticket', id], (r as { data: Ticket }).data);
    void queryClient.invalidateQueries({ queryKey: ['platform-support'] });
    toast.success(message);
  };

  const send = useMutation({
    mutationFn: () => unwrap(api.POST('/platform/support/tickets/{ticket}/messages', { params: { path: { ticket: id } }, body: { body: reply, status: nextStatus || null } as never })),
    onSuccess: (r) => {
      setReply('');
      setNextStatus('');
      done(r, 'Reply sent to the clinic');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not send'),
  });

  const status = useMutation({
    mutationFn: (s: string) => unwrap(api.POST('/platform/support/tickets/{ticket}/status', { params: { path: { ticket: id } }, body: { status: s } as never })),
    onSuccess: (r) => done(r, 'Ticket updated'),
  });

  if (isLoading || !ticket) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="tabular text-xs font-semibold text-fg-subtle">{ticket.number} · {ticket.category}</p>
          <h2 className="text-base font-semibold">{ticket.subject}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <StatusBadge status={ticket.status} />
            <Link to={`/tenants/${ticket.clinic.id}`} className="font-medium text-primary hover:underline">{ticket.clinic.name}</Link>
            {ticket.clinic.plan && <span className="capitalize">· {ticket.clinic.plan}</span>}
          </p>
        </div>
        <Select aria-label="Set status" className="w-44" value={ticket.status} onChange={(e) => status.mutate(e.target.value)}>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      <ol className="flex-1 space-y-4 px-5 py-4" aria-label="Conversation">
        {ticket.messages?.map((m) => {
          const sysnac = m.author_type === 'sysnac';
          return (
            <li key={m.id} className={cn('flex', sysnac ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5', sysnac ? 'rounded-se-sm bg-primary-soft' : 'rounded-ss-sm bg-surface-2')}>
                <p className="text-xs font-semibold">{m.author_name} <span className="font-normal text-fg-muted">· {when(m.created_at)}</span></p>
                <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {ticket.status !== 'closed' && (
        <div className="space-y-2 border-t border-border p-4">
          <Textarea aria-label="Reply" rows={4} placeholder="Write a reply to the clinic…" value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select aria-label="Status after reply" className="w-56" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
              <option value="">Then: waiting on clinic</option>
              <option value="in_progress">Then: in progress</option>
              <option value="resolved">Then: resolved</option>
            </Select>
            <Button loading={send.isPending} disabled={!reply.trim()} onClick={() => send.mutate()}><Send />Send reply</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
