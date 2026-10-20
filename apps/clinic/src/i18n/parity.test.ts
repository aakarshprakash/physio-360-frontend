import { commonAr, commonEn, commonMl } from '@physio/core';
import { describe, expect, it } from 'vitest';
import { en as patientEn } from '../../../patient/src/i18n/en';
import { ar as patientAr } from '../../../patient/src/i18n/ar';
import { ml as patientMl } from '../../../patient/src/i18n/ml';
import { ar } from './ar';
import { en } from './en';
import { ml } from './ml';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

function placeholders(obj: unknown, prefix = ''): Record<string, string[]> {
  if (typeof obj === 'string') return { [prefix]: (obj.match(/{{\w+}}/g) ?? []).sort() };
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return {};
  return Object.assign({}, ...Object.entries(obj).map(([k, v]) => placeholders(v, prefix ? `${prefix}.${k}` : k)));
}

const MALAYALAM = /[ഀ-ൿ]/;

describe.each([
  ['clinic', 'Arabic', en, ar],
  ['clinic', 'Malayalam', en, ml],
  ['patient', 'Arabic', patientEn, patientAr],
  ['patient', 'Malayalam', patientEn, patientMl],
  ['common', 'Arabic', commonEn, commonAr],
  ['common', 'Malayalam', commonEn, commonMl],
])('%s translations (%s)', (_app, _language, english, translated) => {
  it('covers every English key', () => {
    expect(keys(translated).sort()).toEqual(keys(english).sort());
  });

  it('keeps interpolation placeholders intact', () => {
    expect(placeholders(translated)).toEqual(placeholders(english));
  });

  it('has no empty strings', () => {
    const empty = Object.entries(placeholders(translated)).filter(([k]) => {
      const value = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], translated);
      return typeof value === 'string' && value.trim() === '';
    });
    expect(empty).toEqual([]);
  });
});

describe('Malayalam coverage', () => {
  it('actually translates the navigation and new modules rather than copying English', () => {
    for (const value of [ml.nav.dashboard, ml.nav.groups.practice, ml.consultations.title, ml.leave.apply, ml.payroll.title, ml.support.title, ml.attendance.clockIn, patientMl.home.bookNow, commonMl.actions.save]) {
      expect(value).toMatch(MALAYALAM);
    }
  });
});
