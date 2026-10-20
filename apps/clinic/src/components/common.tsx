import { api, unwrap, type PatientSummary } from '@physio/api';
import { toMajorString, toMinor } from '@physio/core';
import { Avatar, Badge, cn, Input, SearchInput, Spinner, STATUS_TONES } from '@physio/ui';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { forwardRef, useEffect, useId, useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounced } from '../lib/hooks';
import { useSession } from '../lib/session';

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const { t } = useTranslation();
  if (!status) return null;
  return (
    <Badge tone={STATUS_TONES[status] ?? 'neutral'} className={className}>
      {t(`common:status.${status}`, { defaultValue: status.replace(/_/g, ' ') })}
    </Badge>
  );
}

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  /** Integer minor units (or null when empty). */
  value: number | null;
  onChange: (minor: number | null) => void;
}

/**
 * Amount entry in major units with the clinic currency's exponent (2 for INR,
 * 3 for KWD/BHD/OMR). Emits integer minor units; never uses floats.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(({ value, onChange, className, ...props }, ref) => {
  const { session } = useSession();
  const { exponent, symbol } = session.tenant.currency;
  const [text, setText] = useState(value == null ? '' : toMajorString(value, exponent));

  useEffect(() => {
    const current = toMinor(text, exponent);
    if (value !== current) setText(value == null ? '' : toMajorString(value, exponent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, exponent]);

  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">
        {symbol}
      </span>
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        className={cn('tabular text-end', symbol.length > 1 ? 'ps-12' : 'ps-7', className)}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^[\d.,]*$/.test(raw)) return;
          setText(raw);
          onChange(raw.trim() === '' ? null : toMinor(raw, exponent));
        }}
        onBlur={() => {
          const minor = toMinor(text, exponent);
          if (minor != null) setText(toMajorString(minor, exponent));
        }}
        {...props}
      />
    </div>
  );
});
MoneyInput.displayName = 'MoneyInput';

interface PatientPickerProps {
  value: { id: number; full_name: string; mrn?: string } | null;
  onChange: (patient: PatientSummary | null) => void;
  invalid?: boolean;
  id?: string;
  autoFocus?: boolean;
}

/** Searchable patient selector (name / phone / MRN). */
export function PatientPicker({ value, onChange, invalid, id, autoFocus }: PatientPickerProps) {
  const { t } = useTranslation();
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term.trim(), 250);
  const listId = useId();

  const { data, isFetching } = useQuery({
    queryKey: ['patients', 'picker', debounced],
    queryFn: () => unwrap(api.GET('/patients', { params: { query: { search: debounced, per_page: 8, sort: 'name' } } })),
    enabled: !value,
    staleTime: 15_000,
  });

  if (value) {
    return (
      <div className={cn('flex h-10 items-center gap-2.5 rounded-lg border border-border-strong bg-surface-2 ps-2 pe-1', invalid && 'border-danger')}>
        <Avatar name={value.full_name} size={26} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {value.full_name}
          {value.mrn && <span className="ms-2 text-xs font-normal text-fg-muted">{value.mrn}</span>}
        </span>
        <button type="button" onClick={() => onChange(null)} className="grid size-8 cursor-pointer place-items-center rounded-md text-fg-subtle hover:bg-surface-3" aria-label={t('common:actions.clear')}>
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <SearchInput
        id={id}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        placeholder={t('patients.search')}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      <ul id={listId} role="listbox" className="scrollbar-thin mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface p-1">
        {isFetching && !data && (
          <li className="flex justify-center p-3 text-fg-subtle">
            <Spinner className="size-4" />
          </li>
        )}
        {data?.data.length === 0 && <li className="px-3 py-2.5 text-sm text-fg-muted">{t('patients.empty')}</li>}
        {data?.data.map((p) => (
          <li key={p.id} role="option" aria-selected={false}>
            <button type="button" onClick={() => onChange(p)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-start hover:bg-surface-3">
              <Avatar name={p.full_name} size={28} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.full_name}</span>
                <span className="block truncate text-xs text-fg-muted">
                  {p.mrn} · {p.phone}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
