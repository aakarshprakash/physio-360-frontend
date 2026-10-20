import { api, ATTENDANCE_STATUSES, unwrap, type AttendanceRegister, type RegisterCell, type RegisterStatus } from '@physio/api';
import { formatLocal, todayInZone } from '@physio/core';
import { Avatar, Button, Card, cn, Dialog, DialogContent, Field, Input, PageHeader, Select, Skeleton, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';
import { MyDayCard, useHours } from './MyDayCard';

const CELL: Record<Exclude<RegisterStatus, null>, string> = {
  present: 'bg-success text-white',
  half_day: 'bg-warning text-white',
  absent: 'bg-danger text-white',
  leave: 'bg-violet-soft text-violet-soft-fg',
  holiday: 'bg-info-soft text-info-soft-fg',
  off: 'bg-surface-3 text-fg-subtle',
  unmarked: 'border border-dashed border-border-strong text-fg-subtle',
};
const LEGEND: Exclude<RegisterStatus, null>[] = ['present', 'half_day', 'absent', 'leave', 'holiday', 'off', 'unmarked'];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function AttendancePage() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const hours = useHours();
  const thisMonth = todayInZone(session.tenant.timezone).slice(0, 7);
  const [month, setMonth] = useUrlState('month', thisMonth);
  const [editing, setEditing] = useState<{ userId: number; name: string; date: string; cell: RegisterCell } | null>(null);
  const today = todayInZone(session.tenant.timezone);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'register', month],
    queryFn: () => unwrap(api.GET('/attendance', { params: { query: { month } as never } })) as unknown as Promise<{ data: AttendanceRegister; can_manage: boolean }>,
  });
  const register = data?.data;
  const canManage = data?.can_manage ?? false;

  return (
    <div className="space-y-5">
      <PageHeader title={t('attendance.title')} description={t('attendance.subtitle')} />
      <MyDayCard />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <h2 className="text-base font-semibold">{t('attendance.register')}</h2>
          <div className="ms-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={t('attendance.previousMonth')} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="rtl:rotate-180" /></Button>
            <span className="min-w-36 text-center text-sm font-semibold">{formatLocal(`${month}-01`, 'MMMM yyyy', i18n.language)}</span>
            <Button variant="ghost" size="icon-sm" aria-label={t('attendance.nextMonth')} disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="rtl:rotate-180" /></Button>
          </div>
        </div>

        {isLoading || !register ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="sticky start-0 z-10 min-w-52 border-b border-border bg-surface px-4 py-2 text-start text-xs font-semibold text-fg-muted">{t('attendance.staffMember')}</th>
                    {register.days.map((d) => (
                      <th key={d.date} scope="col" title={d.holiday ?? undefined} className={cn('border-b border-border px-px py-2 text-center text-[11px] font-medium', d.date === today ? 'text-primary' : d.weekly_off || d.holiday ? 'text-fg-subtle' : 'text-fg-muted')}>
                        <span className="block">{formatLocal(d.date, 'EEEEE', i18n.language)}</span>
                        <span className="tabular block">{Number(d.date.slice(8))}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {register.rows.map((row) => (
                    <tr key={row.user.id}>
                      <th scope="row" className="sticky start-0 z-10 border-b border-border bg-surface px-4 py-2 text-start font-normal">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={row.user.name} color={row.user.color} size={28} />
                          <span className="min-w-0">
                            <span className="block max-w-40 truncate text-[13px] font-semibold">{row.user.name}</span>
                            {/* Month totals live under the name so the whole month fits without scrolling. */}
                            <span className="tabular flex flex-wrap gap-x-2 text-[11px] text-fg-muted">
                              <span title={t('attendance.summary.present')}><span className="text-success">●</span> {row.summary.present}</span>
                              {row.summary.absent > 0 && <span title={t('attendance.summary.absent')} className="font-semibold text-danger">● {row.summary.absent}</span>}
                              {row.summary.leave > 0 && <span title={t('attendance.summary.leave')}><span className="text-violet-soft-fg">●</span> {row.summary.leave}</span>}
                              {row.summary.late > 0 && <span title={t('attendance.summary.late')} className="text-warning-soft-fg">{t('attendance.lateCount', { count: row.summary.late })}</span>}
                              <span title={t('attendance.summary.hours')}>{hours(row.summary.minutes)}</span>
                            </span>
                          </span>
                        </span>
                      </th>
                      {register.days.map((d) => {
                        const cell = row.cells[d.date];
                        const status = cell?.status;
                        const label = [
                          formatLocal(d.date, 'EEE d MMM', i18n.language),
                          status ? t(`attendance.legend.${status}`) : null,
                          cell?.check_in ? `${cell.check_in}–${cell.check_out ?? '…'}` : null,
                          cell?.is_late ? t('attendance.late') : null,
                          d.holiday,
                          cell?.notes,
                        ].filter(Boolean).join(' · ');
                        const editable = canManage && d.date <= today;
                        const content = (
                          <span className={cn('relative grid size-6 place-items-center rounded-md text-[10px] font-semibold', status ? CELL[status] : '')}>
                            {cell?.leave?.half_day || status === 'half_day' ? '½' : ''}
                            {cell?.is_late && <span aria-hidden className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-warning ring-2 ring-surface" />}
                          </span>
                        );
                        return (
                          <td key={d.date} className="border-b border-border px-px py-1.5 text-center">
                            {editable ? (
                              <button type="button" aria-label={label} title={label} className="cursor-pointer rounded-md align-middle focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setEditing({ userId: row.user.id, name: row.user.name, date: d.date, cell })}>
                                {content}
                              </button>
                            ) : (
                              <span role="img" aria-label={label} title={label} className="inline-block align-middle">{content}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-xs text-fg-muted">
              {LEGEND.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={cn('size-3.5 rounded', CELL[s])} />
                  {t(`attendance.legend.${s}`)}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-warning" />{t('attendance.late')}</span>
              {canManage && <span className="ms-auto">{t('attendance.clickToEdit')}</span>}
            </div>
          </>
        )}
      </Card>

      {editing && <RecordDialog {...editing} month={month} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RecordDialog({ userId, name, date, cell, month, onClose }: { userId: number; name: string; date: string; cell: RegisterCell; month: string; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const queryClient = useQueryClient();
  const initial = cell.status && (ATTENDANCE_STATUSES as readonly string[]).includes(cell.status) ? cell.status : 'present';
  const [form, setForm] = useState({ status: initial, check_in: cell.check_in ?? '', check_out: cell.check_out ?? '', notes: cell.notes ?? '' });
  const works = form.status === 'present' || form.status === 'half_day';

  const save = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/attendance', {
        body: { user_id: userId, work_date: date, status: form.status, check_in: works ? form.check_in || null : null, check_out: works ? form.check_out || null : null, notes: form.notes || null } as never,
      })),
    onSuccess: () => {
      toast.success(t('attendance.saved'));
      void queryClient.invalidateQueries({ queryKey: ['attendance', 'register', month] });
      onClose();
    },
    onError: toastError,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="sm"
        title={t('attendance.record')}
        description={t('attendance.recordFor', { name, date: f.local(date, 'EEE, d MMM yyyy') })}
        closeLabel={t('common:actions.close')}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common:actions.save')}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('attendance.status')} className="col-span-2">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}>
              {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{t(`common:status.${s}`)}</option>)}
            </Select>
          </Field>
          {works && (
            <>
              <Field label={t('attendance.checkIn')}><Input type="time" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} /></Field>
              <Field label={t('attendance.checkOut')}><Input type="time" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} /></Field>
            </>
          )}
          <Field label={t('attendance.notes')} className="col-span-2"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
