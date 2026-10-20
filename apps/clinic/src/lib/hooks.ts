import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** A single URL search param as state, so filters survive reloads and can be shared. */
export function useUrlState(key: string, fallback = ''): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;
  const setValue = (next: string) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === '' || next === fallback) p.delete(key);
        else p.set(key, next);
        if (key !== 'page') p.delete('page');
        return p;
      },
      { replace: true },
    );
  return [value, setValue];
}
