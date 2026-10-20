import { openFile } from '@physio/api';
import { SUPPORTED_LANGUAGES } from '@physio/core';
import i18n from 'i18next';
import { toastError } from './errors';

/** Open a server-rendered PDF, in the interface language unless another is asked for. */
export function openPdf(path: string, lang: string = i18n.language): void {
  const code = SUPPORTED_LANGUAGES.some((l) => l.code === lang) ? lang : 'en';
  openFile(`${path}${path.includes('?') ? '&' : '?'}lang=${code}`).catch(toastError);
}
