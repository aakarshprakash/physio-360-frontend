import { api, unwrap } from '@physio/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Td,
  Th,
  Tr,
  toast,
  type BadgeTone,
} from '@physio/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, Check, Clock3, KeyRound, LogOut, MoreHorizontal, Pencil, ShieldCheck, UserPlus, UserRound, Users, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toastError } from '../../lib/errors';
import { useFormat } from '../../lib/format';
import { useUrlState } from '../../lib/hooks';
import { useSession } from '../../lib/session';
import { PasswordDialog } from './PasswordDialog';
import { HoursTab, RoomsTab } from './ScheduleTabs';
import { StaffFormDialog } from './StaffFormDialog';
import { ROLES, useRoleMatrix, useTeam, useTeamSummary, type Presence, type StaffProfile } from './staffApi';

export const ROLE_TONES: Record<string, BadgeTone> = { owner: 'violet', admin: 'info', therapist: 'primary', receptionist: 'warning', accountant: 'neutral' };

export function StaffPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useUrlState('tab', 'team');
  const [hoursUser] = useUrlState('user', '');
  const [adding, setAdding] = useState(false);
  const created = useRef<number | null>(null);
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title={t('staff.title')}
        description={t('staff.subtitle')}
        actions={<Button onClick={() => setAdding(true)}><UserPlus />{t('staff.add')}</Button>}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="team">{t('staff.directory')}</TabsTrigger>
          <TabsTrigger value="roles">{t('staff.rolesTab')}</TabsTrigger>
          <TabsTrigger value="hours">{t('staff.hours')}</TabsTrigger>
          <TabsTrigger value="rooms">{t('staff.rooms')}</TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="pt-5"><Directory /></TabsContent>
        <TabsContent value="roles" className="pt-5"><RolesMatrix /></TabsContent>
        <TabsContent value="hours" className="pt-5"><HoursTab initialUserId={hoursUser ? Number(hoursUser) : undefined} /></TabsContent>
        <TabsContent value="rooms" className="pt-5"><RoomsTab /></TabsContent>
      </Tabs>
      {adding && (
        <StaffFormDialog
          onSaved={(u) => { created.current = u.id; }}
          onClose={() => {
            setAdding(false);
            // Open the new member's profile once the sign-in details have been shared.
            if (created.current) void navigate(`/staff/${created.current}`);
            created.current = null;
          }}
        />
      )}
    </div>
  );
}

export function PresenceBadge({ presence }: { presence?: Presence }) {
  const { t } = useTranslation();
  if (!presence) return <span className="text-fg-subtle">—</span>;
  const tone: Record<Presence['state'], BadgeTone> = { in: 'success', out: 'neutral', leave: 'warning', absent: 'neutral' };
  const label =
    presence.state === 'in' ? t('staff.presence.in', { time: presence.check_in }) :
    presence.state === 'out' ? t('staff.presence.out', { time: presence.check_out }) :
    t(`staff.presence.${presence.state}`);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={tone[presence.state]} dot={presence.state === 'in'}>{label}</Badge>
      {presence.is_late && <Badge tone="danger">{t('staff.presence.late')}</Badge>}
    </span>
  );
}

function Directory() {
  const { t } = useTranslation();
  const f = useFormat();
  const { session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useTeam();
  const { data: summary } = useTeamSummary();
  const [q, setQ] = useUrlState('q', '');
  const [role, setRole] = useUrlState('role', '');
  const [branch, setBranch] = useUrlState('branch', '');
  const [status, setStatus] = useUrlState('status', 'active');
  const [editing, setEditing] = useState<StaffProfile | null>(null);
  const [resetting, setResetting] = useState<StaffProfile | null>(null);

  const signOut = useMutation({
    mutationFn: (u: StaffProfile) => unwrap(api.POST('/staff/{user}/sign-out', { params: { path: { user: u.id } } })),
    onSuccess: () => {
      toast.success(t('staff.signedOut'));
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: toastError,
  });

  const members = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.members ?? []).filter((u) =>
      (status === 'all' || (status === 'active' ? u.is_active : !u.is_active)) &&
      (!role || u.roles?.includes(role)) &&
      (!branch || u.branch_ids?.includes(Number(branch))) &&
      (!term || [u.name, u.email, u.phone, u.employee_code, u.title].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [data, q, role, branch, status]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('staff.summary.team')} value={summary?.total ?? '—'} icon={<Users />} footer={summary && <span className="text-fg-muted">{t('staff.summary.practitioners', { count: summary.practitioners })}</span>} />
        <StatCard label={t('staff.summary.in')} value={summary ? `${summary.clocked_in}/${summary.total}` : '—'} icon={<Clock3 />} tone="info" footer={summary && summary.late > 0 && <span className="text-danger">{t('staff.summary.late', { count: summary.late })}</span>} />
        <StatCard label={t('staff.summary.leave')} value={summary?.on_leave ?? '—'} icon={<CalendarOff />} tone="warning" footer={summary && summary.pending_leave > 0 && <a href="/leave" className="font-medium text-primary hover:underline">{t('staff.summary.pendingLeave', { count: summary.pending_leave })}</a>} />
        <StatCard label={t('staff.summary.notIn')} value={summary?.not_in ?? '—'} icon={<UserRound />} tone="violet" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <SearchInput className="min-w-60 flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('staff.searchPlaceholder')} aria-label={t('common:actions.search')} />
          <Select className="w-44" value={role} onChange={(e) => setRole(e.target.value)} aria-label={t('staff.role')}>
            <option value="">{t('staff.allRoles')}</option>
            {ROLES.map((r) => <option key={r} value={r}>{t(`staff.roles.${r}`)}</option>)}
          </Select>
          {session.branches.length > 1 && (
            <Select className="w-44" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label={t('staff.branches')}>
              <option value="">{t('staff.allBranches')}</option>
              {session.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <Select className="w-36" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('patients.status')}>
            {(['active', 'inactive', 'all'] as const).map((s) => <option key={s} value={s}>{t(`staff.statusFilter.${s}`)}</option>)}
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : members.length === 0 ? (
          <EmptyState icon={<Users />} title={t('staff.noResults')} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>{t('staff.employee')}</Th>
                  <Th>{t('staff.role')}</Th>
                  <Th>{t('staff.contact')}</Th>
                  <Th>{t('staff.branches')}</Th>
                  <Th>{t('staff.today')}</Th>
                  <Th>{t('staff.lastLogin')}</Th>
                  <Th><span className="sr-only">{t('common:actions.more')}</span></Th>
                </tr>
              </thead>
              <tbody>
                {members.map((u) => (
                  <Tr key={u.id} interactive className={u.is_active ? '' : 'opacity-60'} onClick={() => void navigate(`/staff/${u.id}`)}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} color={u.color} size={38} />
                        <div className="min-w-0">
                          <p className="font-semibold">{u.name}</p>
                          <p className="text-xs text-fg-muted">{[u.employee_code, u.title].filter(Boolean).join(' · ') || u.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {u.roles?.map((r) => <Badge key={r} tone={ROLE_TONES[r] ?? 'neutral'}>{t(`staff.roles.${r}`)}</Badge>)}
                        {!u.is_active && <Badge tone="neutral">{t('common:status.inactive')}</Badge>}
                      </div>
                    </Td>
                    <Td className="text-[13px]">
                      <p>{u.phone ?? '—'}</p>
                      <p className="text-xs text-fg-muted">{u.email}</p>
                    </Td>
                    <Td className="text-[13px] text-fg-muted">{session.branches.filter((b) => u.branch_ids?.includes(b.id)).map((b) => b.name).join(', ') || '—'}</Td>
                    <Td>{u.is_active ? <PresenceBadge presence={data?.presence[String(u.id)]} /> : '—'}</Td>
                    <Td className="whitespace-nowrap text-[13px] text-fg-muted">{u.last_login_at ? f.instant(u.last_login_at, 'd MMM, h:mm a') : t('staff.never')}</Td>
                    <Td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`${t('common:actions.more')}: ${u.name}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => void navigate(`/staff/${u.id}`)}><UserRound className="size-4" />{t('staff.viewProfile')}</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setEditing(u)}><Pencil className="size-4" />{t('common:actions.edit')}</DropdownMenuItem>
                          {u.id !== session.user.id && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => setResetting(u)}><KeyRound className="size-4" />{t('staff.resetPassword')}</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => signOut.mutate(u)}><LogOut className="size-4" />{t('staff.signOutEverywhere')}</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
      {editing && <StaffFormDialog user={editing} onClose={() => setEditing(null)} />}
      {resetting && <PasswordDialog user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

/** Read-only matrix: what each role can do and how many people hold it. */
function RolesMatrix() {
  const { t } = useTranslation();
  const { data } = useRoleMatrix();
  if (!data) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.roles.map((r) => (
          <Card key={r.key} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <Badge tone={ROLE_TONES[r.key] ?? 'neutral'}><ShieldCheck className="size-3.5" />{t(`staff.roles.${r.key}`)}</Badge>
              <span className="text-xs text-fg-muted">{t('staff.roleMembers', { count: r.members })}</span>
            </div>
            <p className="mt-2 text-sm text-fg-muted">{r.description}</p>
          </Card>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th className="min-w-64">{t('staff.profile.permissions')}</Th>
              {data.roles.map((r) => <Th key={r.key} className="text-center">{t(`staff.roles.${r.key}`)}</Th>)}
            </tr>
          </thead>
          <tbody>
            {data.permissions.map((p) => (
              <tr key={p.key}>
                <Td className="text-[13px]">{p.label}</Td>
                {data.roles.map((r) => (
                  <Td key={r.key} className="text-center">
                    {r.permissions.includes(p.key)
                      ? <Check className="mx-auto size-4 text-success" aria-label="yes" />
                      : <X className="mx-auto size-4 text-fg-subtle/50" aria-label="no" />}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
