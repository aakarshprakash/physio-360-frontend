import { api, unwrap, type AttendanceToday } from '@physio/api';
import { Badge, Button, Card, cn, Skeleton, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, LogIn, LogOut, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useDefaultBranchId } from '../../lib/session';

export function useHours() {
  const { t } = useTranslation();
  return (minutes: number | null | undefined) => (minutes == null ? '—' : t('attendance.hours', { h: Math.floor(minutes / 60), m: String(minutes % 60).padStart(2, '0') }));
}

/** The signed-in user's clock-in state with one-tap clock in / out. */
export function MyDayCard({ className }: { className?: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const hours = useHours();
  const queryClient = useQueryClient();
  const branchId = useDefaultBranchId();

  const { data } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: async () => (await unwrap(api.GET('/attendance/today'))).data as unknown as AttendanceToday,
    refetchInterval: 60_000,
  });

  const clock = useMutation({
    mutationFn: (action: 'in' | 'out') =>
      action === 'in'
        ? unwrap(api.POST('/attendance/check-in', { body: { branch_id: branchId || null } as never }))
        : unwrap(api.POST('/attendance/check-out')),
    onSuccess: (r, action) => {
      const today = (r as unknown as { data: AttendanceToday }).data;
      queryClient.setQueryData(['attendance', 'today'], today);
      void queryClient.invalidateQueries({ queryKey: ['attendance', 'register'] });
      toast.success(action === 'in' ? t('attendance.clockedIn', { time: today.check_in }) : t('attendance.clockedOut', { time: today.check_out }));
    },
    onError: toastError,
  });

  if (!data) return <Skeleton className={cn('h-[92px] rounded-xl', className)} />;

  const leave = data.on_leave === 'full' ? t('attendance.onLeave') : data.on_leave ? t('attendance.onHalfLeave') : null;

  return (
    <Card className={cn('flex flex-wrap items-center gap-4 p-4', className)}>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-fg">
        {leave ? <CalendarOff className="size-5" /> : <Timer className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-fg-muted">{t('attendance.myDay')} · {f.local(data.date, 'EEE, d MMM')}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 font-semibold">
          {data.check_in ? t('attendance.clockedIn', { time: data.check_in }) : leave ?? t('attendance.notClockedIn')}
          {data.check_out && <span className="font-normal text-fg-muted">· {t('attendance.clockedOut', { time: data.check_out })}</span>}
          {data.is_late && <Badge tone="warning">{t('attendance.late')}</Badge>}
        </p>
        {data.minutes_worked != null && <p className="text-xs text-fg-muted">{t('attendance.worked', { time: hours(data.minutes_worked) })}</p>}
      </div>
      {data.can_check_in ? (
        <Button loading={clock.isPending} onClick={() => clock.mutate('in')}><LogIn className="rtl:-scale-x-100" />{t('attendance.clockIn')}</Button>
      ) : data.can_check_out ? (
        <Button variant="outline" loading={clock.isPending} onClick={() => clock.mutate('out')}><LogOut className="rtl:-scale-x-100" />{t('attendance.clockOut')}</Button>
      ) : null}
    </Card>
  );
}
