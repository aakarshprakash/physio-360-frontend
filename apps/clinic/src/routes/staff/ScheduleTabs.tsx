import { api, unwrap, type Room } from '@physio/api';
import { Button, Card, CardContent, EmptyState, Field, Input, Select, Switch, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRooms, useStaff } from '../../lib/catalog';
import { errorMessage, toastError } from '../../lib/errors';
import { useSession } from '../../lib/session';

interface Interval {
  branch_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
}

export function HoursTab({ initialUserId }: { initialUserId?: number }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: practitioners } = useStaff({ practitionersOnly: true });
  const [userId, setUserId] = useState<number | null>(initialUserId ?? null);
  const [branchId, setBranchId] = useState(session.branches[0]?.id ?? 0);
  const [hours, setHours] = useState<Interval[]>([]);
  const weekdays = t('staff.weekdays', { returnObjects: true }) as string[];

  useEffect(() => {
    if (!userId && practitioners?.length) setUserId(practitioners[0].id);
  }, [practitioners, userId]);

  const { data } = useQuery({
    queryKey: ['working-hours', userId],
    queryFn: async () => (await unwrap(api.GET('/staff/{user}/working-hours', { params: { path: { user: userId! } } })) as unknown as { data: Interval[] }).data,
    enabled: !!userId,
  });
  useEffect(() => setHours(data ?? []), [data]);

  const save = useMutation({
    mutationFn: () => unwrap(api.PUT('/staff/{user}/working-hours', { params: { path: { user: userId! } }, body: { hours } as never })),
    onSuccess: () => {
      toast.success(t('staff.hoursSaved'));
      void queryClient.invalidateQueries({ queryKey: ['working-hours', userId] });
      void queryClient.invalidateQueries({ queryKey: ['calendar-resources'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const practitioner = practitioners?.find((p) => p.id === userId);
  const branchOptions = session.branches.filter((b) => practitioner?.branch_ids?.includes(b.id));

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
        <Field label={t('staff.selectPractitioner')} className="w-64">
          <Select value={userId ?? ''} onChange={(e) => setUserId(Number(e.target.value))}>{practitioners?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        </Field>
        {branchOptions.length > 1 && (
          <Field label={t('nav.branch')} className="w-52">
            <Select value={branchId} onChange={(e) => setBranchId(Number(e.target.value))}>{branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          </Field>
        )}
        <Button className="ms-auto" loading={save.isPending} onClick={() => save.mutate()}>{t('common:actions.saveChanges')}</Button>
      </div>
      <CardContent className="pt-4">
        <ul className="divide-y divide-border">
          {weekdays.map((label, day) => {
            const rows = hours.map((h, i) => ({ h, i })).filter(({ h }) => h.weekday === day && h.branch_id === (branchOptions.length > 1 ? branchId : (branchOptions[0]?.id ?? branchId)));
            const effectiveBranch = branchOptions.length > 1 ? branchId : (branchOptions[0]?.id ?? branchId);
            return (
              <li key={day} className="flex flex-wrap items-start gap-3 py-3">
                <span className="w-28 pt-2 text-sm font-medium">{label}</span>
                <div className="flex flex-1 flex-col gap-2">
                  {rows.length === 0 && <span className="pt-2 text-sm text-fg-subtle">{t('staff.off')}</span>}
                  {rows.map(({ h, i }) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="time" aria-label={`${label} start`} className="h-9 w-32" value={h.start_time} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))} />
                      <span className="text-fg-subtle">–</span>
                      <Input type="time" aria-label={`${label} end`} className="h-9 w-32" value={h.end_time} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)))} />
                      <Button variant="ghost" size="icon-sm" aria-label={t('common:actions.delete')} onClick={() => setHours(hours.filter((_, j) => j !== i))}><Trash2 /></Button>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setHours([...hours, { branch_id: effectiveBranch, weekday: day, start_time: rows.length ? '14:00' : '09:00', end_time: rows.length ? '18:00' : '13:00' }])}>
                  <Plus />{t('staff.addInterval')}
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export function RoomsTab() {
  const { t } = useTranslation();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: rooms } = useRooms();
  const [form, setForm] = useState({ name: '', branch_id: session.branches[0]?.id ?? 0, type: 'treatment' });

  const add = useMutation({
    mutationFn: () => unwrap(api.POST('/settings/rooms', { body: form as never })),
    onSuccess: () => {
      setForm({ ...form, name: '' });
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar-resources'] });
    },
    onError: toastError,
  });
  const toggle = useMutation({
    mutationFn: (room: Room) => unwrap(api.PUT('/settings/rooms/{room}', { params: { path: { room: room.id } }, body: { is_active: !room.is_active } as never })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rooms'] }),
    onError: toastError,
  });

  return (
    <Card>
      <form className="flex flex-wrap items-end gap-3 border-b border-border p-4" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <Field label={t('staff.roomName')} className="min-w-52 flex-1"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label={t('nav.branch')} className="w-48"><Select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: Number(e.target.value) })}>{session.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
        <Field label={t('staff.roomType')} className="w-48"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{['treatment', 'gym', 'hydro', 'consult'].map((r) => <option key={r} value={r}>{t(`staff.roomTypes.${r}`)}</option>)}</Select></Field>
        <Button type="submit" disabled={!form.name.trim()} loading={add.isPending}><Plus />{t('staff.addRoom')}</Button>
      </form>
      {!rooms?.length ? (
        <EmptyState icon={<DoorOpen />} title={t('common:empty')} />
      ) : (
        <ul className="divide-y divide-border">
          {rooms.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3">
              <DoorOpen className="size-5 text-fg-subtle" />
              <span className="flex-1 text-sm font-medium">{r.name}</span>
              <span className="text-xs text-fg-muted">{session.branches.find((b) => b.id === r.branch_id)?.name} · {t(`staff.roomTypes.${r.type}`)}</span>
              <Switch aria-label={`${t('settings.active')}: ${r.name}`} checked={r.is_active} onCheckedChange={() => toggle.mutate(r)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
