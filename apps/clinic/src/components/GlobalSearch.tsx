import { api, unwrap } from '@physio/api';
import { Avatar, cn, SearchInput, Spinner } from '@physio/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useDebounced } from '../lib/hooks';
import { useSession } from '../lib/session';

/** Header quick-search across patients (name, phone, email, MRN) with keyboard navigation. */
export function GlobalSearch({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounced(term.trim(), 250);
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['patients', 'quick-search', debounced],
    queryFn: () => unwrap(api.GET('/patients', { params: { query: { search: debounced, per_page: 6 } } })),
    enabled: debounced.length >= 2 && can('patients.view'),
    staleTime: 10_000,
  });
  const results = data?.data ?? [];

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => setActive(0), [debounced]);

  if (!can('patients.view')) return <div className={className} />;

  const go = (id: number) => {
    setOpen(false);
    setTerm('');
    navigate(`/patients/${id}`);
  };

  return (
    <div ref={wrapper} className={cn('relative', className)}>
      <SearchInput
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={t('nav.searchPlaceholder')}
        placeholder={t('nav.searchPlaceholder')}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && results[active]) {
            go(results[active].id);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {isFetching && <Spinner className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />}
      {open && debounced.length >= 2 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-12 z-50 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-pop">
          {results.length === 0 && !isFetching && <li className="px-3 py-3 text-sm text-fg-muted">{t('patients.empty')}</li>}
          {results.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(p.id)}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2', i === active && 'bg-surface-3')}
            >
              <Avatar name={p.full_name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.full_name}</span>
                <span className="block truncate text-xs text-fg-muted">
                  {p.mrn} · {p.phone}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
