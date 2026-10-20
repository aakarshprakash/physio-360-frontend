import { api, unwrap, type Room, type StaffUser } from '@physio/api';
import { Alert, Avatar, Badge, Button, Card, CardContent, Checkbox, Dialog, DialogContent, EmptyState, Field, Input, Label, PageHeader, Select, Switch, Table, Tabs, TabsContent, TabsList, TabsTrigger, Td, Th, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Plus, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRooms, useStaff } from '../../lib/catalog';
import { errorMessage, handleFormError, toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';

const ROLES = ['owner', 'admin', 'therapist', 'receptionist', 'accountant'] as const;

export function StaffPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useUrlState('tab', 'team');
  return (
    <div>
      <PageHeader title={t('staff.title')} description={t('staff.subtitle')} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="team">{t('staff.team')}</TabsTrigger>
          <TabsTrigger value="hours">{t('staff.hours')}</TabsTrigger>
          <TabsTrigger value="rooms">{t('staff.rooms')}</TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="pt-5"><TeamTab /></TabsContent>
        <TabsContent value="hours" className="pt-5"><HoursTab /></TabsContent>
        <TabsContent value="rooms" className="pt-5"><RoomsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function TeamTab() {
  const { t } = useTranslation();
  const f = useFormat();
  const { session } = useSession();
  const { data: staff } = useStaff({ includeInactive: true });
  const [editing, setEditing] = useState<StaffUser | 'new' | null>(null);

  return (
    <Card>
      <div className="flex justify-end border-b border-border p-4">
        <Button onClick={() => setEditing('new')}><UserPlus />{t('staff.add')}</Button>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>{t('staff.name')}</Th>
            <Th>{t('staff.role')}</Th>
            <Th>{t('staff.branches')}</Th>
            <Th>{t('staff.lastLogin')}</Th>
            <Th>{t('patients.status')}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {staff?.map((u) => (
            <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} color={u.color} size={34} />
                  <div className="min-w-0">
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-fg-muted">{u.email}</p>
                  </div>
                </div>
              </Td>
              <Td>
                {u.roles?.map((r) => <Badge key={r} tone={r === 'owner' ? 'violet' : 'neutral'}>{t(`staff.roles.${r}`)}</Badge>)}
                {u.is_practitioner && <Badge tone="primary" className="ms-1">{t('nav.appointments')}</Badge>}
              </Td>
              <Td className="text-fg-muted">{session.branches.filter((b) => u.branch_ids?.includes(b.id)).map((b) => b.name).join(', ') || '—'}</Td>
              <Td className="whitespace-nowrap text-fg-muted">{u.last_login_at ? f.instant(u.last_login_at, 'd MMM, h:mm a') : t('staff.never')}</Td>
              <Td><Badge tone={u.is_active ? 'success' : 'neutral'}>{u.is_active ? t('staff.active') : t('common:status.inactive')}</Badge></Td>
              <Td className="text-end"><Button size="sm" variant="ghost" onClick={() => setEditing(u)}>{t('common:actions.edit')}</Button></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && <StaffDialog user={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function StaffDialog({ user, onClose }: { user?: StaffUser; onClose: () => void }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    title: user?.title ?? '',
    specialization: user?.specialization ?? '',
    color: user?.color ?? '#3E8E76',
    role: user?.roles?.[0] ?? 'therapist',
    is_practitioner: user?.is_practitioner ?? true,
    is_active: user?.is_active ?? true,
    branch_ids: user?.branch_ids ?? session.branches.map((b) => b.id),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { ...form, phone: form.phone || null, title: form.title || null, specialization: form.specialization || null };
      if (user) delete body.email;
      return user ? unwrap(api.PUT('/staff/{user}', { params: { path: { user: user.id } }, body: body as never })) : unwrap(api.POST('/staff', { body: body as never }));
    },
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar-resources'] });
      const temp = (r as unknown as { meta?: { temporary_password?: string | null } }).meta?.temporary_password;
      if (!user && temp) {
        setNotice(t('staff.tempPassword', { password: temp }));
      } else {
        toast.success(user ? t('staff.saved') : t('staff.created'));
        onClose();
      }
    },
    onError: (e) => handleFormError(e, (field, err) => setErrors((x) => ({ ...x, [field]: err.message ?? '' }))),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" title={user ? t('staff.edit') : t('staff.add')} footer={notice ? <Button onClick={onClose}>{t('common:actions.close')}</Button> : <><Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button><Button loading={save.isPending} onClick={() => save.mutate()}>{t('common:actions.save')}</Button></>}>
        {notice ? (
          <Alert tone="success" title={t('staff.created')}>{notice}</Alert>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.keys(errors).length > 0 && !errors.name && !errors.email && <Alert tone="danger" className="sm:col-span-2">{Object.values(errors)[0]}</Alert>}
            <Field label={t('staff.name')} required error={errors.name}><Input autoFocus value={form.name} onChange={set('name')} /></Field>
            <Field label={t('staff.email')} required error={errors.email}><Input type="email" disabled={!!user} value={form.email} onChange={set('email')} /></Field>
            <Field label={t('staff.phone')}><Input type="tel" value={form.phone} onChange={set('phone')} /></Field>
            <Field label={t('staff.jobTitle')}><Input value={form.title} onChange={set('title')} /></Field>
            <Field label={t('staff.role')} required error={errors.role}>
              <Select value={form.role} onChange={set('role')}>{ROLES.map((r) => <option key={r} value={r}>{t(`staff.roles.${r}`)}</option>)}</Select>
            </Field>
            <Field label={t('staff.specialization')}><Input value={form.specialization} onChange={set('specialization')} /></Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-[13px] font-medium">{t('staff.branches')}</legend>
              <div className="flex flex-wrap gap-4">
                {session.branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.branch_ids.includes(b.id)} onCheckedChange={(v) => setForm({ ...form, branch_ids: v ? [...form.branch_ids, b.id] : form.branch_ids.filter((x) => x !== b.id) })} />
                    {b.name}
                  </label>
                ))}
              </div>
              {errors.branch_ids && <p className="mt-1 text-xs text-danger">{errors.branch_ids}</p>}
            </fieldset>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 sm:col-span-2">
              <Label htmlFor="is-pract">{t('staff.practitioner')}</Label>
              <Switch id="is-pract" checked={form.is_practitioner} onCheckedChange={(v) => setForm({ ...form, is_practitioner: v })} />
            </div>
            <Field label={t('staff.color')}><Input type="color" className="h-10 w-20 p-1" value={form.color} onChange={set('color')} /></Field>
            {user && (
              <div className="flex items-center gap-3 self-end pb-2">
                <Switch id="active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label htmlFor="active">{t('staff.active')}</Label>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface Interval {
  branch_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
}

function HoursTab() {
  const { t } = useTranslation();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: practitioners } = useStaff({ practitionersOnly: true });
  const [userId, setUserId] = useState<number | null>(null);
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

function RoomsTab() {
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
