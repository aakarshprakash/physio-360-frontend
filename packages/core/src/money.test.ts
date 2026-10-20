import { describe, expect, it } from 'vitest';
import { formatMoney, numberLocale, taxFor, toMajorString, toMinor } from './money';

const INR = { code: 'INR', symbol: '₹', exponent: 2 };
const KWD = { code: 'KWD', symbol: 'KWD', exponent: 3 };

describe('money (mirrors App\\Support\\Money on the server)', () => {
  it.each([
    ['1200', 2, 120000],
    ['1,200.5', 2, 120050],
    ['₹ 800', 2, 80000],
    ['0.07', 2, 7],
    ['32.5', 3, 32500],
    ['0.125', 3, 125],
    ['.5', 2, 50],
  ])('parses %s with exponent %i', (input, exponent, minor) => {
    expect(toMinor(input, exponent)).toBe(minor);
  });

  it('rejects ambiguous or over-precise input', () => {
    expect(toMinor('10.123', 2)).toBeNull();
    expect(toMinor('abc', 2)).toBeNull();
    expect(toMinor('', 2)).toBeNull();
    expect(toMinor('.', 2)).toBeNull();
    expect(toMinor('1.2.3', 2)).toBeNull();
  });

  it('never uses floating point when converting back', () => {
    expect(toMajorString(120050, 2)).toBe('1200.50');
    expect(toMajorString(5, 2)).toBe('0.05');
    expect(toMajorString(32500, 3)).toBe('32.500');
    expect(toMajorString(-7, 3)).toBe('-0.007');
    expect(toMajorString(10, 0)).toBe('10');
    // 0.1 + 0.2 style traps
    expect(toMinor(toMajorString(30, 2), 2)).toBe(30);
  });

  it('formats with the currency exponent', () => {
    expect(formatMoney(2458000, INR, 'en-IN')).toBe('₹24,580.00');
    expect(formatMoney(37250, KWD, 'en')).toMatch(/37\.250/);
  });

  it('rounds tax half-up exactly like the server', () => {
    expect(taxFor(10000, 1800)).toBe(1800);
    expect(taxFor(333, 500)).toBe(17);
    expect(taxFor(310, 500)).toBe(16);
    expect(taxFor(4750, 500)).toBe(238);
  });

  it('chooses number locales per language and region', () => {
    expect(numberLocale('en', 'IN')).toBe('en-IN');
    expect(numberLocale('en', 'KW')).toBe('en');
    expect(numberLocale('ar', 'KW')).toBe('ar-KW-u-nu-latn');
  });
});
