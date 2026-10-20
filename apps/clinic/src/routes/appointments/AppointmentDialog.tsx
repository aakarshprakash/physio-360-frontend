import { api, ApiError, unwrap, type Appointment } from '@physio/api';
import { formatLocal, minutesToTime, todayInZone } from '@physio/core';
import { Alert, Button, Checkbox, cn, Dialog, DialogContent, Field, Input, Label, Segmented, Select, Spinner, Switch, Textarea, toast } from '@physio/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PatientPicker } from '../../components/common';
import type { CalendarResources } from '../../lib/appointments';
import { useServices } from '../../lib/catalog';
import { errorMessage } from '../../lib/errors';
import { useFormat } from '../../lib/format';

export interface AppointmentDraft {
  date?: string;
  time?: string;
  practitionerId?: number;
  patient?: { id: number; full_name: string; mrn?: string };
}

interface Props {
  open: boolean;
  branchId: number;
  draft?: AppointmentDraft;
  appointment?: Appointment; // edit / reschedule mode
  resources?: CalendarResources;
  onClose: () => void;
  onBooked: (appointment: Appointment) => void;
}

const TIMES = Array.from({ length: (22 - 6) * 4 }, (_, i) => minutesToTime(6 * 60 + i * 15));

export function AppointmentDialog({ open, branchId, draft = {}, appointment, resources, onClose, onBooked }: Props) {
  const { t } = useTranslation();
  const f = useFormat();
  const queryClient = useQueryClient();
  const { data: services } = useServices();
  const editing = !!appointment;

  const [patient, setPatient] = useState(appointment?.patient ?? draft.patient ?? null);
  const [practitionerId, setPractitionerId] = useState<number | ''>(appointment?.practitioner?.id ?? draft.practitionerId ?? resources?.practitioners[0]?.id ?? '');
  const [serviceId, setServiceId] = useState<number | ''>(appointment?.service?.id ?? '');
  const [date, setDate] = useState(appointment?.local_start.slice(0, 10) ?? draft.date ?? todayInZone(f.tz));
  const [time, setTime] = useState(appointment?.local_start.slice(11, 16) ?? draft.time ?? '');
  const [duration, setDuration] = useState<number>(appointment?.duration_minutes ?? 45);
  const [roomId, setRoomId] = useState<number | ''>(appointment?.room?.id ?? '');
  const [type, setType] = useState<'clinic' | 'home_visit'>((appointment?.type as 'clinic' | 'home_visit') ?? 'clinic');
  const [address, setAddress] = useState(appointment?.home_visit_address ?? '');
  const [buffer, setBuffer] = useState(appointment?.travel_buffer_minutes || 30);
  const [notes, setNotes] = useState(appointment?.notes ?? '');
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [count, setCount] = useState(6);
  const [skipConflicts, setSkipConflicts] = useState(true);
  const [outsideHours, setOutsideHours] = useState(false);
  const [problem, setProblem] = useState<{ title: string; lines: string[] } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Service determines default duration.
  useEffect(() => {
    if (!editing && serviceId && services) {
      const s = services.find((x) => x.id === serviceId);
      if (s) setDuration(s.duration_minutes);
      if (s?.code === 'HOME') setType('home_visit');
    }
  }, [serviceId, services, editing]);

  useEffect(() => {
    if (!editing && !serviceId && services?.length) setServiceId(services.find((s) => s.code === 'FOLLOW')?.id ?? services[0].id);
  }, [services, serviceId, editing]);

  useEffect(() => {
    if (date) setWeekdays((w) => (w.length ? w : [new Date(`${date}T00:00:00`).getDay()]));
  }, [date]);

  const slots = useQuery({
    queryKey: ['availability', practitionerId, branchId, date, duration],
    queryFn: async () =>
      (await unwrap(api.GET('/availability', { params: { query: { practitioner_id: Number(practitionerId), branch_id: branchId, date, duration_minutes: duration } } }))) as unknown as {
        data: { local_start: string }[];
      },
    enabled: !!practitionerId && !!date && duration >= 10,
    select: (r) => r.data.map((s) => s.local_start.slice(11, 16)),
  });

  const practitioner = useMemo(() => resources?.practitioners.find((p) => p.id === practitionerId), [resources, practitionerId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        practitioner_id: Number(practitionerId),
        branch_id: branchId,
        service_id: serviceId || null,
        room_id: type === 'clinic' && roomId ? Number(roomId) : null,
        type,
        local_start: `${date}T${time}`,
        duration_minutes: duration,
        travel_buffer_minutes: type === 'home_visit' ? buffer : 0,
        home_visit_address: type === 'home_visit' ? address : null,
        notes: notes || null,
        allow_outside_hours: outsideHours,
      };
      if (editing) {
        return unwrap(api.PUT('/appointments/{appointment}', { params: { path: { appointment: appointment!.id } }, body: body as never }));
      }
      return unwrap(
        api.POST('/appointments', {
          body: {
            ...body,
            patient_id: patient!.id,
            ...(repeat ? { recurrence: { weekdays, count }, on_conflict: skipConflicts ? 'skip' : 'fail' } : {}),
          } as never,
        }),
      );
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const r = result as unknown as { data: Appointment | Appointment[]; skipped?: unknown[] };
      if (Array.isArray(r.data)) {
        toast.success(t('appointments.seriesBooked', { count: r.data.length }));
        if (r.skipped?.length) toast.warning(t('appointments.seriesSkipped', { count: r.skipped.length }));
        onBooked(r.data[0]);
      } else {
        toast.success(editing ? t('appointments.updated') : t('appointments.booked'));
        onBooked(r.data);
      }
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setProblem({
          title: t('appointments.conflictTitle'),
          lines: error.conflicts.map((c) =>
            c.resource && c.local_start
              ? t(`appointments.conflictWith.${c.resource}`, { time: formatLocal(c.local_start.replace(' ', 'T'), 'd MMM, h:mm a', f.lang) })
              : formatLocal((c.local_start ?? '').replace(' ', 'T') || date, 'EEE d MMM, h:mm a', f.lang),
          ),
        });
      } else if (error instanceof ApiError && error.isValidation) {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k, v[0]])));
      } else {
        setProblem({ title: errorMessage(error), lines: [] });
      }
    },
  });

  const submit = () => {
    setProblem(null);
    const e: Record<string, string> = {};
    if (!editing && !patient) e.patient_id = t('common:errors.required');
    if (!practitionerId) e.practitioner_id = t('common:errors.required');
    if (!date) e.local_start = t('common:errors.required');
    if (!time) e.time = t('common:errors.required');
    if (type === 'home_visit' && !address.trim()) e.home_visit_address = t('common:errors.required');
    setErrors(e);
    if (Object.keys(e).length === 0) mutation.mutate();
  };

  const freeSlots = slots.data ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={editing ? t('appointments.reschedule') : t('appointments.new')}
        description={editing ? `${appointment!.patient?.full_name} · ${f.local(appointment!.local_start, 'EEE d MMM, h:mm a')}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {t('common:actions.cancel')}
            </Button>
            <Button onClick={submit} loading={mutation.isPending}>
              {editing ? t('common:actions.saveChanges') : t('appointments.book')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {problem && (
            <Alert tone="danger" title={problem.title}>
              {problem.lines.length > 0 && (
                <ul className="list-disc ps-4">
                  {problem.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}

          {!editing && (
            <Field label={t('appointments.patient')} required error={errors.patient_id}>
              <PatientPicker value={patient} onChange={(p) => setPatient(p)} invalid={!!errors.patient_id} autoFocus />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('appointments.practitioner')} required error={errors.practitioner_id}>
              <Select value={practitionerId} onChange={(e) => setPractitionerId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">—</option>
                {resources?.practitioners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('appointments.service')}>
              <Select value={serviceId} onChange={(e) => setServiceId(e.target.value ? Number(e.target.value) : '')}>
                {services?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.duration_minutes} min · {f.money(s.price_minor)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Label>{t('appointments.type')}</Label>
            <Segmented<'clinic' | 'home_visit'>
              label={t('appointments.type')}
              value={type}
              onChange={setType}
              options={[
                { value: 'clinic', label: t('common:appointmentType.clinic') },
                { value: 'home_visit', label: t('common:appointmentType.home_visit') },
              ]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('appointments.date')} required error={errors.local_start}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t('appointments.time')} required error={errors.time}>
              <Select value={time} onChange={(e) => setTime(e.target.value)}>
                <option value="">—</option>
                {TIMES.map((tm) => (
                  <option key={tm} value={tm}>
                    {formatLocal(`2000-01-01T${tm}`, 'h:mm a', f.lang)}
                    {freeSlots.length > 0 && !freeSlots.includes(tm) ? ' ·' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('appointments.duration')} error={errors.duration_minutes}>
              <Input type="number" min={10} max={480} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </Field>
          </div>

          {practitionerId && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-[13px] font-medium">
                {t('appointments.freeSlots')}
                {practitioner && <span className="font-normal text-fg-muted">· {practitioner.name}</span>}
                {slots.isFetching && <Spinner className="size-3.5 text-fg-subtle" />}
              </p>
              {freeSlots.length === 0 && !slots.isFetching ? (
                <p className="text-[13px] text-fg-muted">{t('appointments.noSlots')}</p>
              ) : (
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {freeSlots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTime(s)}
                      aria-pressed={time === s}
                      className={cn(
                        'tabular cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        time === s ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-2 hover:border-primary',
                      )}
                    >
                      {formatLocal(`2000-01-01T${s}`, 'h:mm a', f.lang)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {type === 'clinic' ? (
            <Field label={t('appointments.room')}>
              <Select value={roomId} onChange={(e) => setRoomId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">{t('appointments.noRoom')}</option>
                {resources?.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label={t('appointments.homeAddress')} required error={errors.home_visit_address}>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
              </Field>
              <Field label={t('appointments.travelBuffer')}>
                <Input type="number" min={0} max={180} step={5} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} />
              </Field>
            </div>
          )}

          <Field label={t('appointments.notes')}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {!editing && (
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="repeat">{t('appointments.repeat')}</Label>
                <Switch id="repeat" checked={repeat} onCheckedChange={setRepeat} />
              </div>
              {repeat && (
                <div className="mt-4 space-y-4">
                  <fieldset>
                    <legend className="mb-2 text-[13px] font-medium">{t('appointments.repeatOn')}</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {(t('staff.weekdaysShort', { returnObjects: true }) as string[]).map((label, d) => (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={weekdays.includes(d)}
                          onClick={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()))}
                          className={cn(
                            'cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium',
                            weekdays.includes(d) ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <Field label={t('appointments.occurrences')} className="max-w-40">
                    <Input type="number" min={2} max={52} value={count} onChange={(e) => setCount(Number(e.target.value))} />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Checkbox id="skip" checked={skipConflicts} onCheckedChange={(v) => setSkipConflicts(v === true)} />
                    <Label htmlFor="skip" className="font-normal">
                      {t('appointments.skipConflicts')}
                    </Label>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox id="outside" checked={outsideHours} onCheckedChange={(v) => setOutsideHours(v === true)} />
            <Label htmlFor="outside" className="font-normal text-fg-muted">
              {t('appointments.outsideHours')}
            </Label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
