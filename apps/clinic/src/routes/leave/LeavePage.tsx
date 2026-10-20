import { api, unwrap, type LeaveBalance, type LeaveRequest, type LeaveType, type PageMeta } from '@physio/api';
import { todayInZone } from '@physio/core';
import { Alert, Avatar, Badge, Button, Card, ConfirmDialog, Dialog, DialogContent, EmptyState, Field, Input, PageHeader, ProgressBar, Select, Skeleton, STATUS_TONES, Table, Tabs, TabsContent, TabsList, TabsTrigger, Td, Textarea, Th, toast, Tr } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarOff, Check, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStaff } from '../../lib/catalog';
import { handleFormError, toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';

interface Response {
  data: LeaveRequest[];
  meta: PageMeta;
  balances: LeaveBalance[];
  pending_approvals: number;
  can_approve: boolean;
  year: number;
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => (await unwrap(api.GET('/leave-types'))).data as unknown as LeaveType[],
    staleTime: 5 * 60_000,
  });
}

function LeaveStatus({ status }: { status: string }) {
  const { t } = useTranslation();
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{t(`leave.statuses.${status}`)}</Badge>;
}

export function LeavePage() {
  const { t } = useTranslation();
  const { session, can } = useSession();
  const [scope, setScope] = useUrlState('scope', can('leave.approve') ? 'team' : 'mine');
  const [applying, setApplying] = useState(false);
  const year = Number(todayInZone(session.tenant.timezone).slice(0, 4));

  const { data, isLoading } = useQuery({
    queryKey: ['leave-requests', { scope, year }],
    queryFn: () => unwrap(api.GET('/leave-requests', { params: { query: { scope, year } as never } })) as unknown as Promise<Response>,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('leave.title')}
        description={t('leave.subtitle')}
        actions={<Button onClick={() => setApplying(true)}><Plus />{t('leave.apply')}</Button>}
      />

      <section aria-label={t('leave.balances', { year })}>
        <h2 className="mb-3 text-sm font-semibold text-fg-muted">{t('leave.balances', { year })}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data
            ? data.balances.map((b) => (
                <Card key={b.leave_type_id} className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                    <p className="flex-1 truncate text-[13px] font-medium text-fg-muted">{b.name}</p>
                    {!b.is_paid && <Badge>{t('leave.unpaid')}</Badge>}
                  </div>
                  {b.remaining == null ? (
                    <p className="text-2xl font-bold">{b.used}<span className="ms-2 text-sm font-normal text-fg-muted">{t('leave.used')} · {t('leave.unlimited')}</span></p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold">{b.remaining}<span className="ms-1 text-sm font-normal text-fg-muted">/ {b.quota} {t('leave.remaining')}</span></p>
                      <ProgressBar className="mt-2" value={b.quota ? ((b.used + b.pending) / b.quota) * 100 : 0} label={b.name} />
                      <p className="mt-1.5 text-xs text-fg-muted">{t('leave.used')} {b.used} · {t('leave.pending')} {b.pending}</p>
                    </>
                  )}
                </Card>
              ))
            : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
        </div>
      </section>

      <Tabs value={scope} onValueChange={setScope}>
        <TabsList aria-label={t('leave.title')}>
          <TabsTrigger value="mine">{t('leave.myRequests')}</TabsTrigger>
          {can('leave.approve') && (
            <TabsTrigger value="team">
              {t('leave.approvals')}
              {!!data?.pending_approvals && <Badge tone="warning" className="ms-1.5">{data.pending_approvals}</Badge>}
            </TabsTrigger>
          )}
        </TabsList>
        <div className="pt-4">
          <TabsContent value={scope}>
            <RequestTable rows={data?.data} loading={isLoading} team={scope === 'team'} />
          </TabsContent>
        </div>
      </Tabs>

      {applying && <ApplyDialog onClose={() => setApplying(false)} />}
    </div>
  );
}

function RequestTable({ rows, loading, team }: { rows?: LeaveRequest[]; loading: boolean; team: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);

  const act = useMutation({
    mutationFn: ({ id, action, note }: { id: number; action: 'approve' | 'reject' | 'cancel'; note?: string }) => {
      const path = { params: { path: { leaveRequest: id } }, body: { note: note ?? null } as never };
      if (action === 'approve') return unwrap(api.POST('/leave-requests/{leaveRequest}/approve', path));
      if (action === 'reject') return unwrap(api.POST('/leave-requests/{leaveRequest}/reject', path));
      return unwrap(api.POST('/leave-requests/{leaveRequest}/cancel', { params: path.params }));
    },
    onSuccess: (_r, v) => {
      toast.success(t(v.action === 'approve' ? 'leave.approved' : v.action === 'reject' ? 'leave.rejected' : 'leave.cancelled'));
      setRejecting(null);
      void queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: toastError,
  });

  if (loading) return <Skeleton className="h-48 rounded-xl" />;
  if (!rows?.length) return <Card><EmptyState icon={<CalendarOff />} title={t('leave.empty')} description={t('leave.emptyHint')} /></Card>;

  const range = (l: LeaveRequest) =>
    l.start_date === l.end_date ? f.local(l.start_date, 'EEE, d MMM') : `${f.local(l.start_date, 'd MMM')} – ${f.local(l.end_date, 'd MMM yyyy')}`;

  return (
    <Card>
      <Table>
        <thead>
          <tr>
            {team && <Th>{t('leave.staffMember')}</Th>}
            <Th>{t('leave.type')}</Th>
            <Th>{t('leave.from')} – {t('leave.to')}</Th>
            <Th className="text-end">{t('leave.days')}</Th>
            <Th>{t('leave.reason')}</Th>
            <Th>{t('leave.status')}</Th>
            <Th><span className="sr-only">{t('common:actions.more')}</span></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const own = l.user?.id === session.user.id;
            const holding = l.status === 'pending' || l.status === 'approved';
            return (
              <Tr key={l.id}>
                {team && (
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={l.user?.name ?? ''} color={l.user?.color} size={28} />
                      <span className="max-w-40 truncate font-medium">{l.user?.name}</span>
                    </span>
                  </Td>
                )}
                <Td className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: l.leave_type?.color }} />
                    {l.leave_type?.name}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">
                  {range(l)}
                  {l.half_day && <span className="block text-xs text-fg-muted">½ · {t(`leave.halfDays.${l.half_day}`)}</span>}
                  {!!l.conflicting_appointments && l.status === 'pending' && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-medium text-warning-soft-fg" title={t('leave.conflictsHint')}>
                      <AlertTriangle className="size-3.5" />
                      {t('leave.conflicts', { count: l.conflicting_appointments })}
                    </span>
                  )}
                </Td>
                <Td className="tabular text-end font-semibold">{l.days}</Td>
                <Td className="max-w-48">
                  <p className="truncate text-fg-muted" title={l.reason ?? undefined}>{l.reason ?? '—'}</p>
                  {l.decision_note && <p className="truncate text-xs text-fg-subtle">“{l.decision_note}”</p>}
                </Td>
                <Td>
                  <LeaveStatus status={l.status} />
                  {l.decided_by && l.decided_at && <span className="mt-0.5 block whitespace-nowrap text-xs text-fg-subtle">{t('leave.decided', { name: l.decided_by, date: f.instant(l.decided_at, 'd MMM') })}</span>}
                </Td>
                <Td className="whitespace-nowrap">
                  <div className="flex justify-end gap-1">
                    {team && l.status === 'pending' && !own && (
                      <>
                        <Button size="icon-sm" variant="secondary" aria-label={`${t('leave.approve')}: ${l.user?.name ?? ''}`} title={t('leave.approve')} loading={act.isPending && act.variables?.id === l.id && act.variables.action === 'approve'} onClick={() => act.mutate({ id: l.id, action: 'approve' })}>
                          <Check />
                        </Button>
                        <Button size="icon-sm" variant="danger-ghost" aria-label={`${t('leave.reject')}: ${l.user?.name ?? ''}`} title={t('leave.reject')} onClick={() => setRejecting(l)}>
                          <X />
                        </Button>
                      </>
                    )}
                    {holding && (own || team) && (
                      <ConfirmDialog
                        tone="danger"
                        title={t('leave.cancelRequest')}
                        description={t('leave.cancelConfirm')}
                        confirmLabel={t('leave.cancelRequest')}
                        cancelLabel={t('common:actions.back')}
                        onConfirm={() => act.mutateAsync({ id: l.id, action: 'cancel' })}
                        trigger={<Button size="sm" variant="ghost">{t('leave.cancelRequest')}</Button>}
                      />
                    )}
                  </div>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>

      {rejecting && <RejectDialog leave={rejecting} loading={act.isPending} onClose={() => setRejecting(null)} onReject={(note) => act.mutate({ id: rejecting.id, action: 'reject', note })} />}
    </Card>
  );
}

function RejectDialog({ leave, loading, onClose, onReject }: { leave: LeaveRequest; loading: boolean; onClose: () => void; onReject: (note: string) => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="sm"
        title={t('leave.reject')}
        description={`${leave.user?.name ?? ''} · ${leave.leave_type?.name ?? ''}`}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button variant="danger" disabled={!note.trim()} loading={loading} onClick={() => onReject(note)}>{t('leave.reject')}</Button>
          </>
        }
      >
        <Field label={t('leave.rejectReason')} required><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </DialogContent>
    </Dialog>
  );
}

function ApplyDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { session, can } = useSession();
  const queryClient = useQueryClient();
  const { data: types } = useLeaveTypes();
  const { data: staff } = useStaff();
  const today = todayInZone(session.tenant.timezone);
  const [form, setForm] = useState({ user_id: String(session.user.id), leave_type_id: '', start_date: today, end_date: today, half_day: '', reason: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const single = form.start_date === form.end_date;
  const typeId = form.leave_type_id || String(types?.find((x) => x.is_active)?.id ?? '');

  const save = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/leave-requests', {
        body: {
          user_id: Number(form.user_id),
          leave_type_id: Number(typeId),
          start_date: form.start_date,
          end_date: form.end_date,
          half_day: single && form.half_day ? form.half_day : null,
          reason: form.reason || null,
        } as never,
      })),
    onSuccess: () => {
      toast.success(t('leave.submitted'));
      void queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      onClose();
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t('leave.apply')}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={save.isPending} disabled={!typeId || form.end_date < form.start_date} onClick={() => save.mutate()}>{t('leave.apply')}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {can('leave.approve') && (
            <Field label={t('leave.applyFor')} className="sm:col-span-2">
              <Select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
                {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label={t('leave.type')} required className="sm:col-span-2" error={errors.leave_type_id}>
            <Select value={typeId} onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}>
              {types?.filter((x) => x.is_active).map((x) => <option key={x.id} value={x.id}>{x.name}{x.is_paid ? '' : ` · ${t('leave.unpaid')}`}</option>)}
            </Select>
          </Field>
          <Field label={t('leave.from')} required error={errors.start_date}>
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: e.target.value > form.end_date ? e.target.value : form.end_date })} />
          </Field>
          <Field label={t('leave.to')} required error={errors.end_date}>
            <Input type="date" min={form.start_date} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
          {single && (
            <Field label={t('leave.dayType')} className="sm:col-span-2">
              <Select value={form.half_day} onChange={(e) => setForm({ ...form, half_day: e.target.value })}>
                <option value="">{t('leave.halfDays.none')}</option>
                <option value="am">{t('leave.halfDays.am')}</option>
                <option value="pm">{t('leave.halfDays.pm')}</option>
              </Select>
            </Field>
          )}
          <Field label={t('leave.reason')} className="sm:col-span-2"><Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
        </div>
        {Object.keys(errors).length === 0 && session.user.is_practitioner && (
          <Alert tone="info" className="mt-4">{t('leave.conflictsHint')}</Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
