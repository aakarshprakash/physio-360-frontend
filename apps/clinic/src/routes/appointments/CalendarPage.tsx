import type { Appointment } from '@physio/api';
import { addDays, dayOfWeek, formatLocal, minutesOfDay, minutesToTime, nowLocalInZone, todayInZone, weekDates } from '@physio/core';
import { Avatar, Button, Card, cn, EmptyState, PageHeader, Segmented, Select, Skeleton, Table, Td, Th, Tr } from '@physio/ui';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { StatusBadge } from '../../components/common';
import { useAppointments, useCalendarResources, type CalendarResources } from '../../lib/appointments';
import { isWithinWorkingHours, layoutDay, snapToGrid, visibleHours } from '../../lib/calendar';
import { useFormat } from '../../lib/format';
import { useDefaultBranchId, useSession } from '../../lib/session';
import { AppointmentDialog, type AppointmentDraft } from './AppointmentDialog';
import { AppointmentDrawer } from './AppointmentDrawer';

type View = 'day' | 'week' | 'list';
const HOUR_PX = 64;
const PX_PER_MIN = HOUR_PX / 60;

export function CalendarPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useSession();
  const branchId = useDefaultBranchId();
  const [params, setParams] = useSearchParams();

  const today = todayInZone(f.tz);
  const date = params.get('date') ?? today;
  const view = (params.get('view') as View) ?? (typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week');
  const practitionerFilter = params.get('practitioner') ? Number(params.get('practitioner')) : null;
  const openId = params.get('open') ? Number(params.get('open')) : null;

  const [draft, setDraft] = useState<AppointmentDraft | null>(params.get('new') ? {} : null);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        Object.entries(patch).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v)));
        return p;
      },
      { replace: true },
    );

  useEffect(() => {
    if (params.get('new')) update({ new: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = view === 'day' ? [date] : weekDates(date, 1, 7);
  const { data: resources } = useCalendarResources(branchId);
  const { data: appointments, isLoading } = useAppointments({
    from: days[0],
    to: days[days.length - 1],
    branchId,
    practitionerIds: practitionerFilter ? [practitionerFilter] : undefined,
  });

  const visibleAppointments = useMemo(() => (appointments ?? []).filter((a) => a.status !== 'cancelled'), [appointments]);
  const practitioners = (resources?.practitioners ?? []).filter((p) => !practitionerFilter || p.id === practitionerFilter);
  const step = view === 'day' ? 1 : 7;

  const rangeLabel =
    view === 'day' ? f.local(date, 'EEEE, d MMMM yyyy') : `${f.local(days[0], 'd MMM')} – ${f.local(days[6], 'd MMM yyyy')}`;

  const openSlot = (day: string, minutes: number, practitionerId?: number) => {
    if (!can('appointments.manage')) return;
    setDraft({ date: day, time: minutesToTime(minutes), practitionerId: practitionerId ?? practitionerFilter ?? undefined });
  };

  return (
    <div>
      <PageHeader
        title={t('appointments.title')}
        actions={
          can('appointments.manage') && (
            <Button onClick={() => setDraft({ date, practitionerId: practitionerFilter ?? undefined })}>
              <CalendarPlus />
              {t('appointments.new')}
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <Button variant="outline" size="sm" onClick={() => update({ date: today })}>
            {t('appointments.today')}
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon-sm" aria-label="Previous" onClick={() => update({ date: addDays(date, -step) })}>
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Next" onClick={() => update({ date: addDays(date, step) })}>
              <ChevronRight className="rtl:rotate-180" />
            </Button>
          </div>
          <h2 className="me-auto text-[15px] font-semibold" aria-live="polite">
            {rangeLabel}
          </h2>
          <Select
            aria-label={t('appointments.practitioner')}
            className="h-8 min-w-44 text-[13px]"
            value={practitionerFilter ?? ''}
            onChange={(e) => update({ practitioner: e.target.value || null })}
          >
            <option value="">{t('appointments.allPractitioners')}</option>
            {resources?.practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Segmented<View>
            label="View"
            value={view}
            onChange={(v) => update({ view: v })}
            options={[
              { value: 'day', label: t('appointments.day') },
              { value: 'week', label: t('appointments.week') },
              { value: 'list', label: t('appointments.list') },
            ]}
          />
        </div>

        {isLoading || !resources ? (
          <div className="p-4">
            <Skeleton className="h-[520px]" />
          </div>
        ) : view === 'list' ? (
          <ListView appointments={appointments ?? []} onOpen={(id) => update({ open: String(id) })} />
        ) : (
          <TimeGrid
            columns={
              view === 'day'
                ? practitioners.map((p) => ({ key: `p-${p.id}`, date, practitioner: p, label: p.name }))
                : days.map((d) => ({ key: d, date: d, practitioner: practitionerFilter ? practitioners[0] : undefined, label: d }))
            }
            resources={resources}
            appointments={visibleAppointments}
            view={view}
            today={today}
            onOpen={(id) => update({ open: String(id) })}
            onSlot={openSlot}
          />
        )}
      </Card>

      {draft && (
        <AppointmentDialog
          open
          branchId={branchId}
          draft={draft}
          resources={resources}
          onClose={() => setDraft(null)}
          onBooked={(a) => {
            setDraft(null);
            update({ date: a.local_start.slice(0, 10) });
          }}
        />
      )}
      {editing && (
        <AppointmentDialog
          open
          branchId={editing.branch_id}
          appointment={editing}
          resources={resources}
          onClose={() => setEditing(null)}
          onBooked={() => setEditing(null)}
        />
      )}
      <AppointmentDrawer
        appointmentId={openId}
        onClose={() => update({ open: null })}
        onReschedule={(a) => {
          update({ open: null });
          setEditing(a);
        }}
      />
    </div>
  );
}

interface Column {
  key: string;
  date: string;
  label: string;
  practitioner?: CalendarResources['practitioners'][number];
}

function TimeGrid({
  columns,
  resources,
  appointments,
  view,
  today,
  onOpen,
  onSlot,
}: {
  columns: Column[];
  resources: CalendarResources;
  appointments: Appointment[];
  view: View;
  today: string;
  onOpen: (id: number) => void;
  onSlot: (date: string, minutes: number, practitionerId?: number) => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const scroller = useRef<HTMLDivElement>(null);
  const allHours = resources.practitioners.flatMap((p) => p.working_hours);
  const [fromHour, toHour] = visibleHours(allHours, appointments);
  const dayStart = fromHour * 60;
  const totalMinutes = (toHour - fromHour) * 60;
  const [now, setNow] = useState(nowLocalInZone(f.tz));

  useEffect(() => {
    const id = setInterval(() => setNow(nowLocalInZone(f.tz)), 60_000);
    return () => clearInterval(id);
  }, [f.tz]);

  useEffect(() => {
    // Start scrolled near the current time (or 8:00).
    const target = (Math.max(minutesOfDay(now), dayStart + 60) - dayStart - 60) * PX_PER_MIN;
    scroller.current?.scrollTo({ top: Math.max(0, target) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  if (columns.length === 0) {
    return <EmptyState icon={<CalendarDays />} title={t('appointments.empty')} />;
  }

  return (
    <div ref={scroller} className="scrollbar-thin max-h-[calc(100dvh-240px)] min-h-[480px] overflow-auto">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(140px, 1fr))` }}>
        {/* Header row */}
        <div className="sticky top-0 z-20 border-b border-border bg-surface" />
        {columns.map((col) => (
          <div key={col.key} className={cn('sticky top-0 z-20 border-b border-s border-border bg-surface px-2 py-2.5 text-center', col.date === today && view === 'week' && 'bg-primary-soft/60')}>
            {view === 'day' && col.practitioner ? (
              <div className="flex items-center justify-center gap-2">
                <Avatar name={col.practitioner.name} color={col.practitioner.color} size={26} />
                <span className="truncate text-[13px] font-semibold">{col.practitioner.name}</span>
              </div>
            ) : (
              <>
                <div className="text-xs font-medium uppercase text-fg-subtle">{formatLocal(col.date, 'EEE', f.lang)}</div>
                <div className={cn('mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-base font-semibold', col.date === today && 'bg-primary text-primary-fg')}>
                  {formatLocal(col.date, 'd', f.lang)}
                </div>
              </>
            )}
          </div>
        ))}

        {/* Time gutter */}
        <div className="relative" style={{ height: totalMinutes * PX_PER_MIN }}>
          {Array.from({ length: toHour - fromHour }, (_, i) => (
            <div key={i} className="absolute end-2 -translate-y-2 text-[11px] text-fg-subtle tabular" style={{ top: i * HOUR_PX }}>
              {i === 0 ? '' : f.local(`2000-01-01T${minutesToTime((fromHour + i) * 60)}`, 'h a')}
            </div>
          ))}
        </div>

        {columns.map((col) => {
          const weekday = dayOfWeek(col.date);
          const colItems = appointments.filter(
            (a) => a.local_start.slice(0, 10) === col.date && (!col.practitioner || a.practitioner?.id === col.practitioner.id),
          );
          const hours = col.practitioner ? col.practitioner.working_hours : allHours;
          const positioned = layoutDay(colItems, dayStart);
          const nowMinutes = minutesOfDay(now);
          const isToday = col.date === now.slice(0, 10);

          return (
            <div
              key={col.key}
              className="relative cursor-crosshair border-s border-border"
              style={{ height: totalMinutes * PX_PER_MIN }}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const offset = (e.nativeEvent.offsetY / PX_PER_MIN) | 0;
                onSlot(col.date, dayStart + snapToGrid(offset), col.practitioner?.id);
              }}
            >
              {/* Hour lines + non-working shading */}
              {Array.from({ length: toHour - fromHour }, (_, i) => {
                const minutes = (fromHour + i) * 60;
                const working = isWithinWorkingHours(weekday, minutes, hours) || isWithinWorkingHours(weekday, minutes + 30, hours);
                return (
                  <div
                    key={i}
                    aria-hidden
                    className={cn('pointer-events-none absolute inset-x-0 border-t border-border/70', !working && 'bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--surface-3)_6px,var(--surface-3)_7px)]')}
                    style={{ top: i * HOUR_PX, height: HOUR_PX }}
                  >
                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/50" />
                  </div>
                );
              })}

              {isToday && nowMinutes >= dayStart && nowMinutes <= toHour * 60 && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger" style={{ top: (nowMinutes - dayStart) * PX_PER_MIN }}>
                  <span className="absolute -start-1 -top-[5px] size-2 rounded-full bg-danger" />
                </div>
              )}

              {positioned.map(({ item, top, height, lane, lanes }) => {
                const color = item.practitioner?.color ?? '#2F7D66';
                const width = 100 / lanes;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpen(item.id)}
                    className={cn(
                      'absolute z-[5] cursor-pointer overflow-hidden rounded-md border-s-[3px] px-2 py-1 text-start text-xs shadow-sm transition-shadow hover:z-10 hover:shadow-md focus-visible:z-10',
                      item.status === 'no_show' && 'line-through decoration-fg-muted',
                    )}
                    style={{
                      top: top * PX_PER_MIN + 1,
                      height: Math.max(height * PX_PER_MIN - 2, 22),
                      insetInlineStart: `calc(${lane * width}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                      // Past visits get a neutral fill instead of transparency, keeping text contrast intact.
                      background: ['completed', 'no_show'].includes(item.status) ? 'var(--surface-3)' : `color-mix(in oklab, ${color} 14%, var(--surface))`,
                      borderInlineStartColor: color,
                    }}
                  >
                    <span className="flex items-center gap-1 truncate font-semibold text-fg">
                      {item.type === 'home_visit' && <Home className="size-3 shrink-0" />}
                      {item.patient?.full_name}
                      <span className="sr-only">, {f.local(item.local_start, 'h:mm a')}, {t(`common:status.${item.status}`)}</span>
                    </span>
                    {height >= 30 && (
                      <span className="block truncate text-[11px] text-fg-muted">
                        {f.local(item.local_start, 'h:mm')} · {item.service?.name ?? ''}
                      </span>
                    )}
                    {height >= 50 && view === 'week' && !col.practitioner && (
                      <span className="block truncate text-[11px] text-fg-muted">{item.practitioner?.name}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ appointments, onOpen }: { appointments: Appointment[]; onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  if (appointments.length === 0) return <EmptyState icon={<CalendarDays />} title={t('appointments.empty')} />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t('appointments.date')}</Th>
          <Th>{t('appointments.patient')}</Th>
          <Th>{t('appointments.practitioner')}</Th>
          <Th>{t('appointments.service')}</Th>
          <Th>{t('appointments.type')}</Th>
          <Th>{t('patients.status')}</Th>
        </tr>
      </thead>
      <tbody>
        {appointments.map((a) => (
          <Tr key={a.id} interactive onClick={() => onOpen(a.id)}>
            <Td className="tabular whitespace-nowrap">{f.local(a.local_start, 'EEE d MMM, h:mm a')}</Td>
            <Td>
              <button type="button" className="cursor-pointer font-medium hover:underline" onClick={() => onOpen(a.id)}>
                {a.patient?.full_name}
              </button>
              <div className="text-xs text-fg-muted">{a.patient?.mrn}</div>
            </Td>
            <Td>{a.practitioner?.name}</Td>
            <Td>{a.service?.name ?? '—'}</Td>
            <Td>{t(`common:appointmentType.${a.type}`)}</Td>
            <Td>
              <StatusBadge status={a.status} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
