import { api, unwrap } from '@physio/api';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DetailList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Input,
  ProgressBar,
  Skeleton,
  StatCard,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Td,
  Th,
  toast,
} from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck2,
  CalendarClock,
  IndianRupee,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Smartphone,
  Star,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '@physio/api';
import { toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';
import { PasswordDialog } from './PasswordDialog';
import { PresenceBadge, ROLE_TONES } from './StaffPage';
import { StaffFormDialog } from './StaffFormDialog';
import { useRoleMatrix, useStaffDetail, type StaffDetail } from './staffApi';

function thisMonth(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
}

function tenure(joined: string | null | undefined, t: (k: string, o?: Record<string, unknown>) => string): string | null {
  if (!joined) return null;
  const from = new Date(joined);
  const now = new Date();
  const months = (now.getFullYear() - from.getFullYear()) * 12 + now.getMonth() - from.getMonth();
  if (months < 0) return null;
  return months >= 12 ? t('staff.profile.tenure', { years: Math.floor(months / 12), months: months % 12 }) : t('staff.profile.tenureMonths', { months });
}

export function StaffProfilePage() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const id = Number(userId);
  const { session, can } = useSession();
  const [month, setMonth] = useUrlState('month', thisMonth(session.tenant.timezone));
  const [tab, setTab] = useUrlState('tab', 'overview');
  const { data, isLoading, error } = useStaffDetail(id, month);
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const queryClient = useQueryClient();
  const manager = can('staff.manage');

  const signOut = useMutation({
    mutationFn: () => unwrap(api.POST('/staff/{user}/sign-out', { params: { path: { user: id } } })),
    onSuccess: () => {
      toast.success(t('staff.signedOut'));
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: toastError,
  });
  const toggleActive = useMutation({
    mutationFn: (active: boolean) => unwrap(api.PUT('/staff/{user}', { params: { path: { user: id } }, body: { is_active: active } as never })),
    onSuccess: () => {
      toast.success(t('staff.saved'));
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: toastError,
  });

  if (error) {
    return <ErrorState title={error instanceof ApiError && error.status === 403 ? t('common:errors.forbidden') : t('common:errors.generic')} />;
  }
  if (isLoading || !data) {
    return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  }

  const p = data.profile;
  const self = p.id === session.user.id;
  const wa = (p.phone ?? '').replace(/\D/g, '');

  return (
    <div className="space-y-5">
      {manager && <Link to="/staff" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"><ArrowLeft className="size-4 rtl:rotate-180" />{t('staff.profile.back')}</Link>}

      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-sidebar to-primary/80" />
        <div className="flex flex-wrap items-end gap-5 px-6 pb-5">
          <div className="-mt-10 rounded-full ring-4 ring-surface"><Avatar name={p.name} color={p.color} size={88} /></div>
          <div className="min-w-0 flex-1 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
              {p.role && <Badge tone={ROLE_TONES[p.role] ?? 'neutral'}>{t(`staff.roles.${p.role}`)}</Badge>}
              {!p.is_active && <Badge tone="danger">{t('common:status.inactive')}</Badge>}
              {p.is_active && <PresenceBadge presence={data.stats.presence_today} />}
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {[p.title, p.specialization, p.employee_code].filter(Boolean).join(' · ')}
              {p.joined_on && <> · {t('staff.profile.memberSince', { date: new Date(p.joined_on).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) })}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {p.phone && <Button variant="outline" size="sm" asChild><a href={`tel:${p.phone}`}><Phone />{t('staff.phone')}</a></Button>}
            {wa && <Button variant="outline" size="sm" asChild><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></Button>}
            <Button variant="outline" size="sm" asChild><a href={`mailto:${p.email}`}><Mail />Email</a></Button>
            {manager && (
              <>
                <Button size="sm" onClick={() => setEditing(true)}><Pencil />{t('common:actions.edit')}</Button>
                {!self && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="icon-sm" aria-label={t('common:actions.more')}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => setResetting(true)}><KeyRound className="size-4" />{t('staff.resetPassword')}</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => signOut.mutate()}><LogOut className="size-4" />{t('staff.signOutEverywhere')}</DropdownMenuItem>
                      {p.is_active ? (
                        <DropdownMenuItem tone="danger" onSelect={() => { if (window.confirm(t('staff.profile.deactivateConfirm', { name: p.name }))) toggleActive.mutate(false); }}><UserX className="size-4" />{t('staff.profile.deactivate')}</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => toggleActive.mutate(true)}><UserCheck className="size-4" />{t('staff.profile.reactivate')}</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      {p.must_change_password && <Alert tone="warning">{t('staff.mustChange')}</Alert>}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {(['overview', 'performance', 'attendance', 'leave', 'schedule', 'access'] as const).map((k) => <TabsTrigger key={k} value={k}>{t(`staff.profile.tabs.${k}`)}</TabsTrigger>)}
          </TabsList>
          {['overview', 'performance', 'attendance'].includes(tab) && (
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              {t('staff.profile.month')}
              <Input type="month" className="h-9 w-40" value={month} max={thisMonth(session.tenant.timezone)} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </label>
          )}
        </div>
        <TabsContent value="overview" className="pt-5"><Overview data={data} /></TabsContent>
        <TabsContent value="performance" className="pt-5"><Performance data={data} /></TabsContent>
        <TabsContent value="attendance" className="pt-5"><Attendance data={data} /></TabsContent>
        <TabsContent value="leave" className="pt-5"><Leave data={data} /></TabsContent>
        <TabsContent value="schedule" className="pt-5"><Schedule userId={id} canEdit={manager} /></TabsContent>
        <TabsContent value="access" className="pt-5"><Access data={data} /></TabsContent>
      </Tabs>

      {editing && <StaffFormDialog user={p} onClose={() => setEditing(false)} />}
      {resetting && <PasswordDialog user={p} onClose={() => setResetting(false)} />}
    </div>
  );
}

function KpiRow({ data }: { data: StaffDetail }) {
  const { t } = useTranslation();
  const f = useFormat();
  const s = data.stats;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label={t('staff.profile.appointments')} value={s.appointments.total} icon={<CalendarClock />} footer={<span className="text-fg-muted">{t('staff.profile.upcoming', { count: s.appointments.upcoming_7_days })}</span>} />
      <StatCard label={t('staff.profile.patientsSeen')} value={s.patients_seen} icon={<Users />} tone="info" footer={<span className="text-fg-muted">{t('staff.profile.completed')}: {s.appointments.completed}</span>} />
      <StatCard label={t('staff.profile.revenue')} value={f.moneyCompact(s.revenue_minor)} icon={<IndianRupee />} tone="violet" />
      <StatCard
        label={t('staff.profile.rating')}
        value={s.rating.average !== null ? `${s.rating.average} ★` : '—'}
        icon={<Star />}
        tone="warning"
        footer={<span className="text-fg-muted">{s.rating.count ? t('staff.profile.ratingCount', { count: s.rating.count }) : t('staff.profile.noRating')}</span>}
      />
    </div>
  );
}

function Overview({ data }: { data: StaffDetail }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const p = data.profile;
  const dash = (v: ReactNode) => v || <span className="text-fg-subtle">{t('staff.profile.notSet')}</span>;
  const date = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

  return (
    <div className="space-y-5">
      {p.is_practitioner && <KpiRow data={data} />}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('staff.sections.employment')} />
          <CardContent>
            <DetailList items={[
              { label: t('staff.employeeCode'), value: dash(p.employee_code) },
              { label: t('staff.jobTitle'), value: dash(p.title) },
              { label: t('staff.employmentType'), value: dash(p.employment_type && t(`staff.employmentTypes.${p.employment_type}`)) },
              { label: t('staff.joinedOn'), value: dash(p.joined_on && <>{date(p.joined_on)} <span className="text-fg-muted">({tenure(p.joined_on, t)})</span></>) },
              { label: t('staff.qualification'), value: dash(p.qualification) },
              { label: t('staff.registrationNumber'), value: dash(p.registration_number) },
              { label: t('staff.specialization'), value: dash(p.specialization) },
              { label: t('staff.branches'), value: dash(session.branches.filter((b) => p.branch_ids?.includes(b.id)).map((b) => b.name).join(', ')) },
            ]} />
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title={t('staff.sections.personal')} />
            <CardContent>
              <DetailList items={[
                { label: t('staff.email'), value: p.email },
                { label: t('staff.phone'), value: dash(p.phone) },
                { label: t('staff.gender'), value: dash(p.gender && t(`staff.genders.${p.gender}`)) },
                { label: t('staff.dateOfBirth'), value: dash(date(p.date_of_birth)) },
                { label: t('staff.address'), value: dash(p.address) },
              ]} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader title={t('staff.sections.emergency')} />
            <CardContent>
              <DetailList items={[
                { label: t('staff.emergencyName'), value: dash(p.emergency_contact_name) },
                { label: t('staff.emergencyPhone'), value: dash(p.emergency_contact_phone) },
              ]} />
            </CardContent>
          </Card>
          {p.hr_notes && <Alert tone="info" title={t('staff.hrNotes')}>{p.hr_notes}</Alert>}
        </div>
      </div>
    </div>
  );
}

function Performance({ data }: { data: StaffDetail }) {
  const { t } = useTranslation();
  const a = data.stats.appointments;
  if (!data.profile.is_practitioner) return <EmptyState icon={<CalendarClock />} title={t('common:empty')} />;
  const pct = (n: number) => (a.total ? Math.round((n / a.total) * 100) : 0);
  return (
    <div className="space-y-5">
      <KpiRow data={data} />
      <Card>
        <CardHeader title={t('staff.profile.appointments')} />
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-2"><span className="text-3xl font-bold">{a.completion_rate ?? '—'}%</span><span className="text-sm text-fg-muted">{t('staff.profile.completionRate')}</span></div>
          {([
            ['completed', a.completed],
            ['cancelled', a.cancelled],
            ['noShows', a.no_show],
          ] as const).map(([k, n]) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-sm"><span>{t(`staff.profile.${k}`)}</span><span className="tabular font-medium">{n}</span></div>
              <ProgressBar value={pct(n)} label={t(`staff.profile.${k}`)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Attendance({ data }: { data: StaffDetail }) {
  const { t } = useTranslation();
  const s = data.stats.attendance;
  const days = data.stats.attendance_days.filter((d) => d.status && d.status !== 'off');
  const tone: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { present: 'success', half_day: 'warning', absent: 'danger', leave: 'info', holiday: 'neutral', unmarked: 'neutral' };
  return (
    <div className="space-y-5">
      {s && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('staff.profile.presentDays')} value={s.present} icon={<CalendarCheck2 />} footer={s.unmarked > 0 && <span className="text-fg-muted">{t('staff.profile.unmarked', { count: s.unmarked })}</span>} />
          <StatCard label={t('staff.profile.hoursWorked')} value={Math.round(s.minutes / 60)} icon={<CalendarClock />} tone="info" />
          <StatCard label={t('staff.profile.lateDays')} value={s.late} icon={<BadgeCheck />} tone="warning" />
          <StatCard label={t('staff.profile.leaveDays')} value={s.leave} icon={<CalendarClock />} tone="violet" footer={<span className="text-fg-muted">{t('staff.profile.absentDays')}: {s.absent}</span>} />
        </div>
      )}
      <Card className="overflow-x-auto">
        <Table>
          <thead><tr><Th>{t('staff.profile.date')}</Th><Th>{t('patients.status')}</Th><Th>{t('staff.profile.checkIn')}</Th><Th>{t('staff.profile.checkOut')}</Th><Th>{t('staff.profile.hoursWorked')}</Th><Th /></tr></thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.date}>
                <Td className="whitespace-nowrap">{new Date(d.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</Td>
                <Td><Badge tone={tone[d.status!] ?? 'neutral'}>{t(`attendance.legend.${d.status}`, { defaultValue: d.status })}</Badge>{d.is_late && <Badge tone="danger" className="ms-1">{t('staff.presence.late')}</Badge>}</Td>
                <Td className="tabular">{d.check_in ?? '—'}</Td>
                <Td className="tabular">{d.check_out ?? '—'}</Td>
                <Td className="tabular">{d.minutes ? `${Math.floor(d.minutes / 60)}h ${d.minutes % 60}m` : '—'}</Td>
                <Td className="text-xs text-fg-muted">
                  {d.check_in_distance_m != null && t('staff.profile.distance', { m: d.check_in_distance_m })}
                  {d.device && d.device !== 'web' && <span className="ms-2 inline-flex items-center gap-1"><Smartphone className="size-3" />{d.device}</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function Leave({ data }: { data: StaffDetail }) {
  const { t } = useTranslation();
  const balances = data.stats.leave_balances;
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-fg-muted">{t('staff.profile.leaveBalance', { year: data.stats.month.slice(0, 4) })}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {balances.map((b) => {
          const quota = Number(b.quota);
          return (
            <Card key={b.leave_type_id} className="p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold"><span className="size-2.5 rounded-full" style={{ background: b.color }} />{b.name}</span>
                <span className="text-xs text-fg-muted">{b.code}</span>
              </div>
              <p className="mt-3 text-2xl font-bold">{b.remaining === null ? t('staff.profile.unlimited') : t('staff.profile.remaining', { n: b.remaining })}</p>
              <p className="text-xs text-fg-muted">{t('staff.profile.used', { used: b.used, pending: b.pending })}{quota > 0 && ` / ${quota}`}</p>
              {quota > 0 && <ProgressBar className="mt-3" value={Math.min(100, (b.used / quota) * 100)} label={b.name} />}
            </Card>
          );
        })}
      </div>
      <Link to="/leave" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">{t('nav.leave')} →</Link>
    </div>
  );
}

function Schedule({ userId, canEdit }: { userId: number; canEdit: boolean }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const weekdays = t('staff.weekdays', { returnObjects: true }) as string[];
  const { data } = useQuery({
    queryKey: ['working-hours', userId],
    queryFn: async () => ((await unwrap(api.GET('/staff/{user}/working-hours', { params: { path: { user: userId } } }))) as unknown as { data: { branch_id: number; weekday: number; start_time: string; end_time: string }[] }).data,
  });
  return (
    <Card>
      <CardHeader title={t('staff.hours')} description={t('staff.profile.workingHoursHint')} action={canEdit && <Button size="sm" variant="outline" asChild><Link to={`/staff?tab=hours&user=${userId}`}>{t('staff.profile.editHours')}</Link></Button>} />
      <CardContent>
        <ul className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const rows = (data ?? []).filter((h) => h.weekday === day);
            return (
              <li key={day} className="flex items-center gap-4 py-2.5 text-sm">
                <span className="w-28 font-medium">{weekdays[day]}</span>
                {rows.length === 0 ? <span className="text-fg-subtle">{t('staff.off')}</span> : (
                  <span className="flex flex-wrap gap-2">
                    {rows.map((h, i) => (
                      <Badge key={i} tone="neutral">{h.start_time}–{h.end_time}{session.branches.length > 1 && ` · ${session.branches.find((b) => b.id === h.branch_id)?.code ?? ''}`}</Badge>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function Access({ data }: { data: StaffDetail }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { data: matrix } = useRoleMatrix();
  const p = data.profile;
  const labels = new Map(matrix?.permissions.map((x) => [x.key, x.label]));
  const roleInfo = matrix?.roles.find((r) => r.key === p.role);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('staff.profile.role')} description={roleInfo?.description} />
        <CardContent>
          <p className="mb-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">{t('staff.profile.permissions')}</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {data.permissions.map((perm) => (
              <li key={perm} className="flex items-start gap-2 text-[13px]"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" />{labels.get(perm) ?? perm}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardContent className="pt-5">
            <DetailList items={[
              { label: t('staff.profile.lastLogin'), value: p.last_login_at ? f.instant(p.last_login_at) : t('staff.never') },
              { label: t('staff.profile.passwordChanged'), value: p.password_changed_at ? f.instant(p.password_changed_at) : '—' },
              { label: t('staff.mustChange'), value: p.must_change_password ? <Badge tone="warning">Yes</Badge> : 'No' },
            ]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t('staff.profile.devices')} />
          <CardContent>
            {data.devices.length === 0 ? <p className="text-sm text-fg-muted">{t('staff.profile.noDevices')}</p> : (
              <ul className="divide-y divide-border">
                {data.devices.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                    <Smartphone className="size-4 text-fg-subtle" />
                    <span className="flex-1 font-medium">{d.name}</span>
                    <span className="text-xs text-fg-muted">{t('staff.profile.lastUsed', { date: d.last_used_at ? f.instant(d.last_used_at, 'd MMM, h:mm a') : '—' })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t('staff.profile.activity')} />
          <CardContent>
            {data.activity.length === 0 ? <p className="text-sm text-fg-muted">{t('staff.profile.noActivity')}</p> : (
              <ul className="space-y-2">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span><span className="font-medium capitalize">{a.event.replace(/_/g, ' ')}</span>{a.subject && <span className="text-fg-muted"> · {a.subject} #{a.subject_id}</span>}</span>
                    <span className="shrink-0 text-xs text-fg-muted">{f.instant(a.at, 'd MMM, h:mm a')}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

