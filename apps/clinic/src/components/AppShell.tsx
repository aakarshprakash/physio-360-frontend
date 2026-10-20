import { api, type Permission } from '@physio/api';
import { isLanguage, resolvedTheme, setThemePreference, SUPPORTED_LANGUAGES } from '@physio/core';
import {
  Avatar,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Logo,
} from '@physio/ui';
import {
  Wallet,
  BarChart3,
  BellRing,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarOff,
  Check,
  ChevronDown,
  ClipboardList,
  Dumbbell,
  ExternalLink,
  FileText,
  Inbox,
  Languages,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  Stethoscope,
  Sun,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { useSession } from '../lib/session';
import { GlobalSearch } from './GlobalSearch';

interface NavItem {
  /** Path, optionally with a query string (e.g. a settings section). */
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  permissions?: Permission[];
  end?: boolean;
}

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

const COLLAPSED_KEY = 'physio360.nav.collapsed';

function readCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/** Active when the path matches and every query param in `to` matches the current URL. */
function isActive(item: NavItem, pathname: string, search: URLSearchParams): boolean {
  const [path, query] = item.to.split('?');
  const pathMatches = item.end || path === '/' ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  if (!pathMatches) return false;
  if (!query) return true;
  return [...new URLSearchParams(query)].every(([k, v]) => search.get(k) === v);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { canAny, session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  const location = useLocation();
  const search = new URLSearchParams(location.search);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const groups: NavGroup[] = [
    {
      key: 'overview',
      label: t('nav.groups.overview'),
      items: [{ to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true }],
    },
    {
      key: 'practice',
      label: t('nav.groups.practice'),
      items: [
        { to: '/appointments', label: t('nav.appointments'), icon: CalendarDays, permissions: ['appointments.view'] },
        { to: '/patients', label: t('nav.patients'), icon: Users, permissions: ['patients.view'] },
        { to: '/enquiries', label: t('nav.enquiries'), icon: Inbox, permissions: ['enquiries.manage'] },
        { to: '/consultations', label: t('nav.consultations'), icon: Stethoscope, permissions: ['clinical.view'] },
      ],
    },
    {
      key: 'clinical',
      label: t('nav.groups.clinical'),
      items: [
        { to: '/treatment-plans', label: t('nav.treatmentPlans'), icon: ClipboardList, permissions: ['clinical.view'] },
        { to: '/prescriptions', label: t('nav.prescriptions'), icon: FileText, permissions: ['clinical.view'] },
        { to: '/exercises', label: t('nav.exercises'), icon: Dumbbell, permissions: ['clinical.view', 'exercises.manage'] },
      ],
    },
    {
      key: 'finance',
      label: t('nav.groups.finance'),
      items: [
        { to: '/billing', label: t('nav.billing'), icon: ReceiptText, permissions: ['billing.view'] },
        { to: '/packages', label: t('nav.packages'), icon: Package, permissions: ['billing.view'] },
        { to: '/payment-reminders', label: t('nav.paymentReminders'), icon: BellRing, permissions: ['messages.send'] },
        { to: '/reports', label: t('nav.reports'), icon: BarChart3, permissions: ['reports.view'] },
      ],
    },
    {
      key: 'communication',
      label: t('nav.groups.communication'),
      items: [{ to: '/messages', label: t('nav.messages'), icon: MessageSquareText, permissions: ['messages.send'] }],
    },
    {
      key: 'team',
      label: t('nav.groups.team'),
      items: [
        { to: '/staff', label: t('nav.staff'), icon: UserCog, permissions: ['staff.manage'] },
        { to: '/attendance', label: t('nav.attendance'), icon: CalendarCheck2 },
        { to: '/leave', label: t('nav.leave'), icon: CalendarOff },
        { to: '/payroll', label: t('nav.payroll'), icon: Wallet },
      ],
    },
    {
      key: 'admin',
      label: t('nav.groups.admin'),
      items: [
        { to: '/settings?section=branches', label: t('nav.branches'), icon: Building2, permissions: ['settings.manage'] },
        { to: '/settings', label: t('nav.settings'), icon: Settings, permissions: ['settings.manage'] },
        { to: '/audit', label: t('nav.audit'), icon: ScrollText, permissions: ['audit.view'] },
      ],
    },
  ];

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permissions || canAny(...i.permissions)) }))
    .filter((g) => g.items.length > 0);

  // "Settings" must not light up while its Branches section is open.
  const activeTo =
    visibleGroups
      .flatMap((g) => g.items)
      .filter((i) => isActive(i, location.pathname, search))
      .sort((a, b) => b.to.length - a.to.length)[0]?.to ?? null;

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: collapse state just won't persist */
      }
      return next;
    });

  const portalUrl = `/my/?clinic=${encodeURIComponent(session.tenant.slug)}`;
  const footerLink = 'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-fg transition-colors hover:bg-sidebar-hover hover:text-white';

  const sidebar = (
    <nav aria-label={t('nav.mainNav')} className="flex h-full flex-col bg-sidebar text-sidebar-fg">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link to="/" className="rounded-md">
          <Logo inverted />
        </Link>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-3">
        {visibleGroups.map((group) => {
          const containsActive = group.items.some((i) => i.to === activeTo);
          const open = containsActive || !collapsed.includes(group.key);
          const listId = `nav-group-${group.key}`;
          return (
            <div key={group.key} className="pt-3 first:pt-1">
              {group.key === 'overview' ? null : (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  title={open ? t('nav.collapse') : t('nav.expand')}
                  onClick={() => !containsActive && toggle(group.key)}
                  className="group flex w-full cursor-pointer items-center justify-between rounded-md px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted hover:text-white/90"
                >
                  <span className="truncate">{group.label}</span>
                  <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', !open && '-rotate-90 rtl:rotate-90')} />
                </button>
              )}
              <ul id={listId} hidden={!open} className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.to === activeTo;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active ? 'bg-sidebar-active text-white shadow-sm' : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-white',
                        )}
                      >
                        <item.icon className="size-[18px] shrink-0" />
                        <span className="line-clamp-2 leading-snug">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="shrink-0 space-y-0.5 border-t border-white/10 p-3">
        <Link to="/support" aria-current={location.pathname === '/support' ? 'page' : undefined} className={cn(footerLink, location.pathname === '/support' && 'bg-sidebar-active text-white')}>
          <LifeBuoy className="size-[18px] shrink-0" />
          <span className="truncate">{t('nav.support')}</span>
        </Link>
        <a href={portalUrl} target="_blank" rel="noopener" className={footerLink}>
          <UserRound className="size-[18px] shrink-0" />
          <span className="flex-1 truncate">{t('nav.patientPortal')}</span>
          <ExternalLink className="size-3.5 shrink-0 opacity-60" />
        </a>
        <p className="px-3 pt-2 text-[11px] text-sidebar-muted">{t('auth.tagline')} · Physio360 by SYSNAC</p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:ps-64">
      <a href="#main" className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
        {t('nav.skipToContent')}
      </a>

      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label={t('common:actions.close')} className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="animate-slide-in-end absolute inset-y-0 start-0 w-72 max-w-[85vw] shadow-pop">
            {sidebar}
            <Button variant="ghost" size="icon" className="absolute end-2 top-3 text-white hover:bg-white/10" aria-label={t('common:actions.close')} onClick={() => setMobileOpen(false)}>
              <X />
            </Button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/75 sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('nav.openMenu')} onClick={() => setMobileOpen(true)}>
          <Menu />
        </Button>
        <GlobalSearch className="max-w-xl flex-1" />
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <BranchSwitcher />
          <LanguageMenu />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-4 py-6 outline-none sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function BranchSwitcher() {
  const { t } = useTranslation();
  const { session, branchId, setBranchId } = useSession();
  if (session.branches.length < 2) return null;
  const current = session.branches.find((b) => b.id === branchId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden md:inline-flex" title={t('nav.branch')}>
          <Building2 />
          <span className="max-w-32 truncate">{current?.name ?? t('nav.allBranches')}</span>
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{t('nav.branch')}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setBranchId(null)}>{t('nav.allBranches')}</DropdownMenuItem>
        {session.branches.map((b) => (
          <DropdownMenuItem key={b.id} onSelect={() => setBranchId(b.id)}>
            {b.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Interface language. Also saved to the profile so it follows the user across devices. */
export function LanguageMenu({ persist = true }: { persist?: boolean }) {
  const { i18n, t } = useTranslation();
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  const choose = (code: string) => {
    if (!isLanguage(code) || code === i18n.language) return;
    void i18n.changeLanguage(code);
    if (persist) void api.PUT('/auth/profile', { body: { locale: code } as never }).catch(() => undefined);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`${t('common:language')}: ${current.label}`}>
          <Languages />
          <span className="hidden sm:inline">{current.label}</span>
          <ChevronDown className="hidden opacity-60 sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{t('common:language')}</DropdownMenuLabel>
        {SUPPORTED_LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.code} onSelect={() => choose(l.code)} lang={l.code} dir={l.dir}>
            <Check className={cn('size-4', l.code !== current.code && 'invisible')} />
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeToggle() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(resolvedTheme());
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('common:theme.toggle')}
      onClick={() => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setThemePreference(next);
        setTheme(next);
      }}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

function UserMenu() {
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const { user } = session;
  const roleKey = user.roles?.[0] ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 text-start hover:bg-surface-3">
          <span className="sr-only xl:hidden">{user.name}</span>
          <Avatar name={user.name} color={user.color} size={34} />
          <span className="hidden min-w-0 leading-tight xl:block">
            <span className="block max-w-40 truncate text-[13px] font-semibold">{user.name}</span>
            <span className="block max-w-40 truncate text-xs text-fg-muted">{user.title || t(`staff.roles.${roleKey}`, { defaultValue: roleKey })}</span>
          </span>
          <ChevronDown className="hidden size-4 text-fg-subtle xl:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-semibold text-fg">{user.name}</span>
          <span className="block truncate font-normal">{session.tenant.name}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <UserRound />
          {t('nav.profile')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/attendance')}>
          <CalendarCheck2 />
          {t('attendance.myDay')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/support')}>
          <LifeBuoy />
          {t('nav.support')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          tone="danger"
          onSelect={async () => {
            await signOut();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut />
          {t('common:actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
