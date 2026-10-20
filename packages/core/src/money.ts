/**
 * Money is always integer minor units on the wire. The exponent comes from the
 * clinic currency (INR 2, KWD/BHD/OMR 3) and is never assumed to be 2.
 * Parsing works on strings so floats never touch stored amounts.
 */
export interface CurrencyInfo {
  code: string;
  symbol: string;
  exponent: number;
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, currency: CurrencyInfo): Intl.NumberFormat {
  const key = `${locale}|${currency.code}|${currency.exponent}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.exponent,
      maximumFractionDigits: currency.exponent,
    });
    formatters.set(key, f);
  }
  return f;
}

/** Locale used for number formatting: Indian digit grouping for INR, Latin digits for Arabic UI. */
export function numberLocale(uiLanguage: string, countryCode = 'IN'): string {
  if (uiLanguage === 'ar') return `ar-${countryCode}-u-nu-latn`;
  return countryCode === 'IN' ? 'en-IN' : 'en';
}

export function formatMoney(minor: number, currency: CurrencyInfo, locale = 'en-IN'): string {
  return formatter(locale, currency).format(Number(toMajorString(minor, currency.exponent)));
}

/** Compact form for KPI tiles: ₹24.6K, KWD 1.2K. */
export function formatMoneyCompact(minor: number, currency: CurrencyInfo, locale = 'en-IN'): string {
  const major = minor / 10 ** currency.exponent;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.code,
    notation: Math.abs(major) >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(major) >= 100_000 ? 1 : 0,
  }).format(major);
}

/** 123450, 2 -> "1234.50" (exact, no floating point). */
export function toMajorString(minor: number, exponent: number): string {
  const negative = minor < 0;
  let digits = Math.abs(Math.trunc(minor)).toString();
  if (exponent === 0) return (negative ? '-' : '') + digits;
  digits = digits.padStart(exponent + 1, '0');
  const whole = digits.slice(0, -exponent);
  const fraction = digits.slice(-exponent);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * Parses user input in major units ("1,234.5", "₹ 800") into minor units.
 * Returns null for invalid input or more decimals than the currency allows.
 */
export function toMinor(input: string, exponent: number): number | null {
  const cleaned = input.replace(/[\s,٬]/g, '').replace(/^[^\d.-]+/, '');
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || cleaned === '' || cleaned === '-' || cleaned === '.') return null;

  const [, sign, whole = '', fraction = ''] = match;
  if (fraction.length > exponent) return null;
  if (whole === '' && fraction === '') return null;

  const value = Number((whole || '0') + fraction.padEnd(exponent, '0'));
  if (!Number.isSafeInteger(value)) return null;
  return sign ? -value : value;
}

/** Tax in basis points, rounded half-up (mirrors the server's Money::taxFor). */
export function taxFor(amountMinor: number, rateBasisPoints: number): number {
  return Math.floor((amountMinor * rateBasisPoints + 5000) / 10000);
}

export function formatBasisPoints(bp: number): string {
  return `${Number((bp / 100).toFixed(2))}%`;
}
