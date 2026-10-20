import { ApiError } from '@physio/api';
import i18n from 'i18next';

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.status >= 500 ? i18n.t('common:errors.generic') : e.message;
  return i18n.t('common:errors.network');
}
