import { TZDate } from '@date-fns/tz';
import { format as dfFormat, type Locale } from 'date-fns';
import { arSA, enIN } from 'date-fns/locale';
import { ml } from './locales/ml-date';

/*
 * One place for time handling. Rules:
 *  - The API sends instants as ISO UTC ("…Z") and wall-clock times as
 *    "YYYY-MM-DDTHH:mm" in the branch/clinic timezone ("local_start").
 *  - Everything shown to users is rendered in the *clinic* timezone, never the
 *    browser's, so a receptionist abroad sees the clinic's day.
 *  - The calendar works purely with local strings; no tz math in components.
 */

export type LocalDateString = string; // "2026-10-15"
export type LocalDateTimeString = string; // "2026-10-15T09:00"

export function dateLocale(language: string): Locale {
  return language === 'ar' ? arSA : language === 'ml' ? ml : enIN;
}

/** An instant viewed in a timezone. */
export function inZone(value: string | Date | number, timeZone: string): TZDate {
  const instant = typeof value === 'string' ? new Date(value) : value;
  return new TZDate(instant instanceof Date ? instant.getTime() : instant, timeZone);
}

export function formatInZone(value: string | Date | number, timeZone: string, pattern: string, language = 'en'): string {
  return dfFormat(inZone(value, timeZone), pattern, { locale: dateLocale(language) });
}

/** Format a wall-clock string without any timezone conversion. */
export function formatLocal(local: LocalDateTimeString | LocalDateString, pattern: string, language = 'en'): string {
  const [datePart, timePart = '00:00'] = local.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return dfFormat(new Date(y, m - 1, d, hh, mm), pattern, { locale: dateLocale(language) });
}

export function todayInZone(timeZone: string): LocalDateString {
  return dfFormat(TZDate.tz(timeZone), 'yyyy-MM-dd');
}

export function nowLocalInZone(timeZone: string): LocalDateTimeString {
  return dfFormat(TZDate.tz(timeZone), "yyyy-MM-dd'T'HH:mm");
}

export function addDays(date: LocalDateString, days: number): LocalDateString {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function dayOfWeek(date: LocalDateString): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Start of the week containing `date` (weekStartsOn: 0 = Sunday, 1 = Monday). */
export function startOfWeek(date: LocalDateString, weekStartsOn = 1): LocalDateString {
  const diff = (dayOfWeek(date) - weekStartsOn + 7) % 7;
  return addDays(date, -diff);
}

export function weekDates(date: LocalDateString, weekStartsOn = 1, days = 7): LocalDateString[] {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

export function startOfMonth(date: LocalDateString): LocalDateString {
  return `${date.slice(0, 7)}-01`;
}

/** Minutes since local midnight of "YYYY-MM-DDTHH:mm" (or "HH:mm"). */
export function minutesOfDay(local: string): number {
  const time = local.includes('T') ? local.split('T')[1] : local;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function datePart(local: LocalDateTimeString): LocalDateString {
  return local.slice(0, 10);
}

export function combine(date: LocalDateString, time: string): LocalDateTimeString {
  return `${date}T${time.slice(0, 5)}`;
}

export function ageFrom(dateOfBirth: LocalDateString | null | undefined, today: LocalDateString): number | null {
  if (!dateOfBirth) return null;
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export function greetingKey(timeZone: string): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(dfFormat(TZDate.tz(timeZone), 'H'));
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}
