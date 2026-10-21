import { addDays, formatLocal, formatMoney, todayInZone } from '@physio/core';
import { Alert, Avatar, Button, cn, Field, Input, Select, Skeleton, Spinner, Textarea } from '@physio/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarCheck2, Check, ChevronRight, Clock, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router';

/*
 * The clinic's public booking page: a shareable link, a WhatsApp link and an
 * <iframe> for the clinic website (?embed=1). No account needed; the front
 * desk confirms requests (or they book instantly if the clinic allows it).
 * English only for now, so copy lives here rather than in the dictionaries.
 */

interface BookingPage {
  clinic: { name: string; slug: string; phone: string | null; email: string | null; address: string | null; logo_url: string | null; timezone: string; currency: { code: string; symbol: string; exponent: number }; country_code: string };
  settings: { enabled: boolean; mode: 'request' | 'instant'; max_days_ahead: number; allow_practitioner_choice: boolean; intro: string | null };
  branches: { id: number; name: string; address: string | null; city: string | null; phone: string | null }[];
  services: { id: number; name: string; category: string | null; description: string | null; duration_minutes: number; price_minor: number }[];
  practitioners: { id: number; name: string; title: string | null; specialization: string | null; color: string; branch_ids: number[] }[];
}

interface Result { reference: string; status: 'pending' | 'confirmed'; local_start: string; branch: string; service: string | null; practitioner: string | null; message: string }

class PublicError extends Error {
  constructor(message: string, public fields: Record<string, string[]> = {}) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/public/clinics/${path}`, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) throw new PublicError('This booking page is not available.');
    if (res.status === 429) throw new PublicError('Too many attempts. Please wait a minute and try again.');
    throw new PublicError(body.message ?? 'Something went wrong. Please try again.', body.errors ?? {});
  }
  return body as T;
}

const STEPS = ['Service', 'Therapist', 'Date & time', 'Your details'] as const;

export function PublicBookingPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const embed = params.get('embed') === '1';
  const source = (params.get('src') ?? (embed ? 'website' : 'link')).replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'link';

  const page = useQuery({
    queryKey: ['public-booking', slug],
    queryFn: () => call<{ data: BookingPage }>(`${slug}/booking`).then((r) => r.data),
    retry: false,
  });

  useEffect(() => {
    if (page.data) document.title = `Book an appointment · ${page.data.clinic.name}`;
  }, [page.data]);

  return (
    <div className={cn('min-h-dvh', embed ? 'bg-transparent' : 'bg-gradient-to-b from-primary-soft/60 via-bg to-bg')}>
      <div className={cn('mx-auto max-w-3xl', embed ? 'p-2' : 'px-4 py-6 sm:py-10')}>
        {page.isLoading ? (
          <div className="space-y-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>
        ) : page.error || !page.data ? (
          <Alert tone="danger" title="Booking unavailable">{(page.error as Error)?.message}</Alert>
        ) : (
          <Booking data={page.data} slug={slug} source={source} embed={embed} />
        )}
        {!embed && <p className="mt-6 text-center text-xs text-fg-subtle">Secure booking by Physio360</p>}
      </div>
    </div>
  );
}

function ClinicHeader({ data, embed }: { data: BookingPage; embed: boolean }) {
  const c = data.clinic;
  return (
    <header className={cn('flex items-start gap-4', embed ? 'mb-4' : 'mb-6')}>
      {c.logo_url ? (
        <img src={c.logo_url} alt="" className="size-16 shrink-0 rounded-2xl border border-border bg-white object-contain p-1.5" />
      ) : (
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary text-2xl font-bold text-primary-fg">{c.name.charAt(0)}</span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{c.name}</h1>
        <p className="text-sm text-fg-muted">Book a physiotherapy appointment online</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-muted">
          {c.address && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{c.address}</span>}
          {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone className="size-3.5" />{c.phone}</a>}
        </div>
      </div>
    </header>
  );
}

function Booking({ data, slug, source, embed }: { data: BookingPage; slug: string; source: string; embed: boolean }) {
  const tz = data.clinic.timezone;
  const today = todayInZone(tz);
  const choosePractitioner = data.settings.allow_practitioner_choice && data.practitioners.length > 0;
  const [step, setStep] = useState(0);
  const [branchId, setBranchId] = useState<number>(data.branches[0]?.id ?? 0);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [practitionerId, setPractitionerId] = useState<number | null>(null);
  const [date, setDate] = useState(addDays(today, 1));
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', age: '', gender: '', message: '', website: '' });
  const [result, setResult] = useState<Result | null>(null);

  const service = data.services.find((s) => s.id === serviceId);
  const practitioner = data.practitioners.find((p) => p.id === practitionerId);
  const branch = data.branches.find((b) => b.id === branchId);
  const money = (minor: number) => formatMoney(minor, data.clinic.currency, data.clinic.country_code === 'IN' ? 'en-IN' : 'en');
  const practitioners = data.practitioners.filter((p) => p.branch_ids.includes(branchId));
  const days = useMemo(() => Array.from({ length: Math.min(data.settings.max_days_ahead + 1, 31) }, (_, i) => addDays(today, i)), [today, data.settings.max_days_ahead]);

  const slots = useQuery({
    queryKey: ['public-slots', slug, branchId, serviceId, practitionerId, date],
    queryFn: () => call<{ data: { local_start: string }[] }>(`${slug}/booking/slots?${new URLSearchParams({ branch_id: String(branchId), service_id: String(serviceId), date, ...(practitionerId ? { practitioner_id: String(practitionerId) } : {}) })}`).then((r) => r.data),
    enabled: step === 2 && !!serviceId,
  });

  const submit = useMutation({
    mutationFn: () => call<{ data: Result }>(`${slug}/booking`, {
      method: 'POST',
      body: JSON.stringify({
        branch_id: branchId, service_id: serviceId, practitioner_id: practitionerId, local_start: slot,
        name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || null,
        age: form.age ? Number(form.age) : null, gender: form.gender || null, message: form.message.trim() || null,
        source, website: form.website,
      }),
    }).then((r) => r.data),
    onSuccess: setResult,
    onError: (e) => {
      if (e instanceof PublicError && /no longer available|just taken/.test(e.message)) {
        setSlot(null);
        setStep(2);
        void slots.refetch();
      }
    },
  });

  if (!data.settings.enabled || data.services.length === 0) {
    return (
      <Shell embed={embed}>
        <ClinicHeader data={data} embed={embed} />
        <Alert tone="info" title="Online booking is paused">Please call {data.clinic.phone ?? 'the clinic'} to book your appointment.</Alert>
      </Shell>
    );
  }

  if (result) {
    const confirmed = result.status === 'confirmed';
    return (
      <Shell embed={embed}>
        <div className="py-6 text-center">
          <span className={cn('mx-auto grid size-16 place-items-center rounded-full', confirmed ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary')}>
            {confirmed ? <CalendarCheck2 className="size-8" /> : <Check className="size-8" />}
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">{confirmed ? 'You’re booked!' : 'Request received'}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">{result.message}</p>
          <dl className="mx-auto mt-6 max-w-sm divide-y divide-border rounded-xl border border-border bg-surface-2 text-start text-sm">
            <Row label="Reference" value={<span className="font-mono font-semibold">{result.reference}</span>} />
            <Row label="When" value={formatLocal(result.local_start, 'EEEE d MMMM, h:mm a')} />
            {result.service && <Row label="Service" value={result.service} />}
            {result.practitioner && confirmed && <Row label="Therapist" value={result.practitioner} />}
            <Row label="Clinic" value={`${data.clinic.name}${data.branches.length > 1 ? ` · ${result.branch}` : ''}`} />
          </dl>
          {data.clinic.phone && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="outline" asChild><a href={`tel:${data.clinic.phone}`}><Phone />Call the clinic</a></Button>
              <Button variant="outline" asChild><a href={`https://wa.me/${data.clinic.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello, I just requested an appointment (${result.reference}).`)}`} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></Button>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  const visibleSteps = choosePractitioner ? [0, 1, 2, 3] : [0, 2, 3];
  const next = (from: number) => visibleSteps[visibleSteps.indexOf(from) + 1] ?? 3;
  const prev = (from: number) => visibleSteps[visibleSteps.indexOf(from) - 1] ?? 0;
  const grouped = groupSlots(slots.data ?? []);
  const fieldError = (k: string) => (submit.error instanceof PublicError ? submit.error.fields[k]?.[0] : undefined);
  const canSubmit = form.name.trim().length >= 2 && form.phone.replace(/\D/g, '').length >= 7 && !!slot;

  return (
    <Shell embed={embed}>
      <ClinicHeader data={data} embed={embed} />
      {data.settings.intro && <p className="-mt-2 mb-5 rounded-xl bg-primary-soft/50 px-4 py-3 text-sm text-primary-soft-fg">{data.settings.intro}</p>}

      <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
        {visibleSteps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold', step > s ? 'bg-primary text-primary-fg' : step === s ? 'bg-primary text-primary-fg ring-4 ring-primary-soft' : 'bg-surface-3 text-fg-muted')} aria-current={step === s ? 'step' : undefined}>
              {step > s ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('hidden truncate text-xs font-medium sm:block', step >= s ? 'text-fg' : 'text-fg-subtle')}>{STEPS[s]}</span>
            {i < visibleSteps.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      {step > 0 && (
        <button type="button" onClick={() => setStep(prev(step))} className="mb-3 inline-flex cursor-pointer items-center gap-1 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" />Back
        </button>
      )}

      {step === 0 && (
        <section aria-labelledby="svc-h" className="space-y-4">
          {data.branches.length > 1 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Choose a location</h2>
              <div className="flex flex-wrap gap-2">
                {data.branches.map((b) => (
                  <button key={b.id} type="button" onClick={() => { setBranchId(b.id); setPractitionerId(null); }} className={cn('cursor-pointer rounded-xl border px-4 py-2.5 text-start text-sm', b.id === branchId ? 'border-primary bg-primary-soft/50 font-semibold' : 'border-border bg-surface hover:border-border-strong')}>
                    {b.name}{b.city && <span className="block text-xs font-normal text-fg-muted">{b.city}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <h2 id="svc-h" className="text-sm font-semibold">What would you like to book?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setServiceId(s.id); setSlot(null); setStep(next(0)); }}
                className={cn('group flex cursor-pointer flex-col rounded-2xl border bg-surface p-4 text-start shadow-card transition hover:-translate-y-0.5 hover:border-primary', s.id === serviceId ? 'border-primary' : 'border-border')}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{s.name}</span>
                  <ChevronRight className="size-4 shrink-0 text-fg-subtle group-hover:text-primary" />
                </span>
                {s.description && <span className="mt-1 line-clamp-2 text-[13px] text-fg-muted">{s.description}</span>}
                <span className="mt-3 flex items-center gap-3 text-[13px]">
                  <span className="inline-flex items-center gap-1 text-fg-muted"><Clock className="size-3.5" />{s.duration_minutes} min</span>
                  {s.price_minor > 0 && <span className="font-semibold text-primary">{money(s.price_minor)}</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Who would you like to see?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard active={practitionerId === null} onClick={() => { setPractitionerId(null); setStep(2); }} icon={<span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary"><Sparkles className="size-5" /></span>} title="Any available therapist" subtitle="Shows the most open times" />
            {practitioners.map((p) => (
              <ChoiceCard key={p.id} active={practitionerId === p.id} onClick={() => { setPractitionerId(p.id); setSlot(null); setStep(2); }} icon={<Avatar name={p.name} color={p.color} size={44} />} title={p.name} subtitle={p.specialization ?? p.title ?? 'Physiotherapist'} />
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <Summary service={service} practitioner={practitioner?.name} branch={data.branches.length > 1 ? branch?.name : undefined} money={money} />
          <div>
            <h2 className="mb-2 text-sm font-semibold">Pick a day</h2>
            <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="listbox" aria-label="Day">
              {days.map((d) => (
                <button key={d} type="button" role="option" aria-selected={d === date} onClick={() => { setDate(d); setSlot(null); }}
                  className={cn('flex w-16 shrink-0 cursor-pointer flex-col items-center rounded-xl border py-2 text-center', d === date ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface hover:border-border-strong')}>
                  <span className="text-[11px] uppercase opacity-80">{d === today ? 'Today' : formatLocal(d, 'EEE')}</span>
                  <span className="text-lg font-bold leading-tight">{formatLocal(d, 'd')}</span>
                  <span className="text-[11px] opacity-80">{formatLocal(d, 'MMM')}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Available times · {formatLocal(date, 'EEEE d MMMM')}</h2>
            {slots.isLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : !slots.data?.length ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">No free times on this day. Please try another day.</p>
            ) : (
              <div className="space-y-3">
                {grouped.map(([label, list]) => (
                  <div key={label}>
                    <p className="mb-1.5 text-xs font-medium text-fg-muted">{label}</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {list.map((s) => (
                        <button key={s} type="button" onClick={() => { setSlot(s); setStep(3); }}
                          className={cn('cursor-pointer rounded-lg border py-2 text-sm font-medium tabular', s === slot ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface hover:border-primary hover:text-primary')}>
                          {formatLocal(s, 'h:mm a')}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {step === 3 && slot && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (canSubmit) submit.mutate(); }}>
          <Summary service={service} practitioner={practitioner?.name} branch={data.branches.length > 1 ? branch?.name : undefined} money={money} when={formatLocal(slot, 'EEEE d MMMM, h:mm a')} />
          {submit.error && !Object.keys((submit.error as PublicError).fields ?? {}).length && <Alert tone="danger">{submit.error.message}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={fieldError('name')}><Input autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Mobile number" required error={fieldError('phone')} hint="We will confirm on this number (call or WhatsApp)."><Input type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98xxx xxxxx" /></Field>
            <Field label="Email" error={fieldError('email')}><Input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age" error={fieldError('age')}><Input type="number" min={1} max={120} inputMode="numeric" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></Field>
              <Field label="Gender">
                <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">—</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                </Select>
              </Field>
            </div>
            <Field label="What brings you in?" className="sm:col-span-2" hint="Optional. E.g. knee pain after running, post-surgery rehab."><Textarea rows={3} maxLength={1000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
            {/* Honeypot: hidden from people, irresistible to bots. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -start-[9999px] size-0 opacity-0" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <p className="flex items-start gap-2 text-xs text-fg-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />Your details are shared only with {data.clinic.name} to arrange your appointment.</p>
          <Button type="submit" size="lg" className="w-full" loading={submit.isPending} disabled={!canSubmit}>
            {data.settings.mode === 'instant' ? 'Confirm booking' : 'Request appointment'}
          </Button>
        </form>
      )}
    </Shell>
  );
}

function Shell({ embed, children }: { embed: boolean; children: ReactNode }) {
  return <div className={cn('rounded-3xl bg-surface', embed ? 'p-4 sm:p-6' : 'border border-border p-5 shadow-pop sm:p-8')}>{children}</div>;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-fg-muted">{label}</dt><dd className="text-end font-medium">{value}</dd></div>;
}

function ChoiceCard({ active, onClick, icon, title, subtitle }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; subtitle: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex cursor-pointer items-center gap-3 rounded-2xl border bg-surface p-3.5 text-start shadow-card transition hover:border-primary', active ? 'border-primary' : 'border-border')}>
      {icon}
      <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="block truncate text-[13px] text-fg-muted">{subtitle}</span></span>
      <ChevronRight className="size-4 text-fg-subtle" />
    </button>
  );
}

function Summary({ service, practitioner, branch, when, money }: { service?: BookingPage['services'][number]; practitioner?: string; branch?: string; when?: string; money: (m: number) => string }) {
  if (!service) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface-2 px-4 py-3 text-sm">
      <span className="font-semibold">{service.name}</span>
      <span className="inline-flex items-center gap-1 text-fg-muted"><Clock className="size-3.5" />{service.duration_minutes} min</span>
      {service.price_minor > 0 && <span className="text-fg-muted">{money(service.price_minor)}</span>}
      <span className="inline-flex items-center gap-1 text-fg-muted"><UserRound className="size-3.5" />{practitioner ?? 'Any therapist'}</span>
      {branch && <span className="inline-flex items-center gap-1 text-fg-muted"><MapPin className="size-3.5" />{branch}</span>}
      {when && <span className="inline-flex items-center gap-1 font-medium text-primary"><CalendarCheck2 className="size-3.5" />{when}</span>}
    </div>
  );
}

function groupSlots(slots: { local_start: string }[]): [string, string[]][] {
  const groups: Record<string, string[]> = { Morning: [], Afternoon: [], Evening: [] };
  for (const s of slots) {
    const h = Number(s.local_start.slice(11, 13));
    groups[h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening']!.push(s.local_start);
  }
  return Object.entries(groups).filter(([, v]) => v.length > 0);
}
