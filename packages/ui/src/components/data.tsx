import { ChevronLeft, ChevronRight, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn, initials } from '../utils';
import { Button } from './button';

/* ---------- Table ---------- */

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="scrollbar-thin w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('whitespace-nowrap border-b border-border bg-surface-2 px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-fg-subtle', className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-border px-4 py-3 align-middle', className)} {...props} />;
}

export function Tr({ className, interactive, ...props }: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return <tr className={cn(interactive && 'cursor-pointer transition-colors hover:bg-surface-2', className)} {...props} />;
}

/* ---------- Pagination ---------- */

interface PaginationProps {
  page: number;
  lastPage: number;
  total?: number;
  onChange: (page: number) => void;
  labels?: { previous: string; next: string; page: (p: number, t: number) => string };
}

export function Pagination({ page, lastPage, total, onChange, labels }: PaginationProps) {
  if (lastPage <= 1) return null;
  const l = labels ?? { previous: 'Previous', next: 'Next', page: (p: number, t: number) => `Page ${p} of ${t}` };
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-fg-muted">
      <span>
        {l.page(page, lastPage)}
        {total !== undefined && <span className="ms-1 text-fg-subtle">· {total}</span>}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="rtl:rotate-180" />
          {l.previous}
        </Button>
        <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>
          {l.next}
          <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>
    </nav>
  );
}

/* ---------- Avatar ---------- */

// Each passes 4.5:1 with white initials.
const AVATAR_COLORS = ['#2F7D66', '#3D63B8', '#6E4CB8', '#B8423D', '#8A5A00', '#1F6F7A', '#A3366A', '#4D6B1F'];

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

const MIDNIGHT_L = luminance('#142D36');

/**
 * Background + text colours for initials that meet WCAG AA (4.5:1). Staff colours
 * are user-chosen, so mid-tones are darkened until white text passes.
 */
export function avatarColors(bg: string): { bg: string; fg: string } {
  if (!/^#[0-9a-f]{6}$/i.test(bg)) return { bg: '#2F7D66', fg: '#ffffff' };
  const l = luminance(bg);
  if (1.05 / (l + 0.05) >= 4.5) return { bg, fg: '#ffffff' };
  if ((l + 0.05) / (MIDNIGHT_L + 0.05) >= 4.5) return { bg, fg: '#142D36' };

  let [r, g, b] = [0, 2, 4].map((i) => parseInt(bg.slice(1 + i, 3 + i), 16));
  let out = bg;
  for (let step = 0; step < 20 && 1.05 / (luminance(out) + 0.05) < 4.5; step++) {
    [r, g, b] = [r, g, b].map((c) => Math.round(c * 0.9));
    out = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }
  return { bg: out, fg: '#ffffff' };
}

export function Avatar({ name, color, size = 36, className }: { name: string; color?: string | null; size?: number; className?: string }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const colors = avatarColors(color || AVATAR_COLORS[hash % AVATAR_COLORS.length]);
  return (
    <span
      aria-hidden
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold', className)}
      style={{ width: size, height: size, background: colors.bg, color: colors.fg, fontSize: Math.max(11, size * 0.38) }}
    >
      {initials(name) || '?'}
    </span>
  );
}

/* ---------- Search input ---------- */

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <div className={cn('relative', className)}>
    <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
    <input
      ref={ref}
      type="search"
      className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm placeholder:text-fg-subtle focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/50"
      {...props}
    />
  </div>
));
SearchInput.displayName = 'SearchInput';

/* ---------- Page header ---------- */

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && <div className="mb-1">{back}</div>}
        <h1 className="text-[22px] font-bold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Stat card ---------- */

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon: ReactNode;
  tone?: 'primary' | 'info' | 'violet' | 'warning';
  change?: number | null;
  changeLabel?: ReactNode;
  footer?: ReactNode;
}

const statTones = {
  primary: 'bg-primary-soft text-primary-soft-fg',
  info: 'bg-info-soft text-info-soft-fg',
  violet: 'bg-violet-soft text-violet-soft-fg',
  warning: 'bg-warning-soft text-warning-soft-fg',
};

export function StatCard({ label, value, icon, tone = 'primary', change, changeLabel, footer }: StatCardProps) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl [&_svg]:size-5', statTones[tone])}>{icon}</div>
        <div className="min-w-0">
          {/* Two lines rather than an ellipsis: Malayalam labels run long. */}
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-fg-muted">{label}</p>
          <p className="tabular mt-0.5 text-2xl font-bold tracking-tight text-fg">{value}</p>
        </div>
      </div>
      {(change !== undefined || footer) && (
        <div className="mt-3 text-xs">
          {change !== undefined && change !== null && (
            <span className={cn('inline-flex items-center gap-1 font-medium', up ? 'text-success' : 'text-danger')}>
              {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {up ? '+' : ''}
              {change}% <span className="font-normal text-fg-subtle">{changeLabel}</span>
            </span>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Definition list ---------- */

export function DetailList({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(120px,auto)_1fr]', className)}>
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-fg-muted">{item.label}</dt>
          <dd className="break-words font-medium text-fg">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
