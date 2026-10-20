import { formatInZone, formatLocal, formatMoney, formatMoneyCompact, numberLocale, toMajorString } from '@physio/core';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from './session';

/**
 * All money and time rendering goes through here so the clinic's currency
 * exponent and timezone are applied consistently.
 */
export function useFormat() {
  const { session } = useSession();
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const tz = session.tenant.timezone;
  const currency = session.tenant.currency;
  const locale = numberLocale(lang, session.tenant.country_code);

  const money = useCallback((minor: number | null | undefined) => (minor == null ? '—' : formatMoney(minor, currency, locale)), [currency, locale]);
  const moneyCompact = useCallback((minor: number) => formatMoneyCompact(minor, currency, locale), [currency, locale]);
  const major = useCallback((minor: number) => toMajorString(minor, currency.exponent), [currency.exponent]);
  const instant = useCallback((iso: string | null | undefined, pattern = 'd MMM yyyy, h:mm a') => (iso ? formatInZone(iso, tz, pattern, lang) : '—'), [tz, lang]);
  const local = useCallback((value: string | null | undefined, pattern = 'd MMM yyyy') => (value ? formatLocal(value, pattern, lang) : '—'), [lang]);
  const number = useCallback((n: number) => new Intl.NumberFormat(locale).format(n), [locale]);

  return useMemo(() => ({ money, moneyCompact, major, instant, local, number, tz, currency, locale, lang }), [money, moneyCompact, major, instant, local, number, tz, currency, locale, lang]);
}
