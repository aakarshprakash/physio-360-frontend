import { ApiError } from '@physio/api';
import { toast } from '@physio/ui';
import i18n from 'i18next';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/** Human message for any error thrown by the API layer. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return error.message && error.message !== 'This action is unauthorized.' ? error.message : i18n.t('common:errors.forbidden');
    if (error.status === 404) return i18n.t('common:errors.notFound');
    if (error.status >= 500) return i18n.t('common:errors.generic');
    // Business-rule errors carry a stable code; show it in the user's language when we know it.
    if (error.code && i18n.exists(`errorCodes.${error.code}`)) return i18n.t(`errorCodes.${error.code}`);
    return error.message;
  }
  if (error instanceof TypeError) return i18n.t('common:errors.network');
  return i18n.t('common:errors.generic');
}

export function toastError(error: unknown): void {
  toast.error(errorMessage(error));
}

/**
 * Maps Laravel 422 validation errors onto react-hook-form fields.
 * Returns true when at least one field error was applied.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields?: readonly string[]): boolean {
  if (!(error instanceof ApiError) || !error.isValidation) return false;
  let applied = false;
  for (const [field, messages] of Object.entries(error.errors)) {
    if (!fields || fields.includes(field)) {
      setError(field as Path<T>, { type: 'server', message: messages[0] });
      applied = true;
    }
  }
  return applied;
}

/** Standard mutation error handler: field errors inline, everything else as a toast. */
export function handleFormError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields?: readonly string[]): void {
  if (!applyServerErrors(error, setError, fields)) toastError(error);
}
