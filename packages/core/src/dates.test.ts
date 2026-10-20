import { describe, expect, it } from 'vitest';
import { addDays, ageFrom, combine, dayOfWeek, formatInZone, formatLocal, minutesOfDay, minutesToTime, startOfWeek, weekDates } from './dates';

describe('dates', () => {
  it('does local-date arithmetic without timezone drift', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('builds Monday-first weeks', () => {
    expect(dayOfWeek('2026-10-18')).toBe(0); // Sunday
    expect(startOfWeek('2026-10-18', 1)).toBe('2026-10-12');
    expect(weekDates('2026-10-15', 1)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  });

  it('converts wall-clock strings to minutes and back', () => {
    expect(minutesOfDay('2026-10-15T09:30')).toBe(570);
    expect(minutesOfDay('14:15')).toBe(855);
    expect(minutesToTime(570)).toBe('09:30');
    expect(combine('2026-10-15', '09:30:00')).toBe('2026-10-15T09:30');
  });

  it('formats UTC instants in the clinic timezone, not the browser timezone', () => {
    expect(formatInZone('2026-10-15T04:30:00Z', 'Asia/Kolkata', 'HH:mm')).toBe('10:00');
    expect(formatInZone('2026-10-15T04:30:00Z', 'Asia/Kuwait', 'HH:mm')).toBe('07:30');
  });

  it('formats local strings without conversion', () => {
    expect(formatLocal('2026-10-15T09:00', 'h:mm a')).toBe('9:00 AM');
    expect(formatLocal('2026-10-15', 'd MMM yyyy')).toBe('15 Oct 2026');
    // Malayalam month and weekday names (date-fns has no "ml" locale of its own).
    expect(formatLocal('2026-10-15', 'EEEE, d MMMM yyyy', 'ml')).toBe('വ്യാഴാഴ്ച, 15 ഒക്ടോബർ 2026');
    expect(formatLocal('2026-10-15T09:00', 'EEE d MMM, h:mm a', 'ml')).toBe('വ്യാഴം 15 ഒക്ടോ, 9:00 AM');
  });

  it('computes age on the local date', () => {
    expect(ageFrom('1994-03-12', '2026-03-11')).toBe(31);
    expect(ageFrom('1994-03-12', '2026-03-12')).toBe(32);
    expect(ageFrom(null, '2026-03-12')).toBeNull();
  });
});
