import i18next, { type BackendModule, type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { commonAr, commonEn, commonMl } from './locales/common';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN', dir: 'ltr' },
  { code: 'ar', label: 'العربية', short: 'ع', dir: 'rtl' },
  { code: 'ml', label: 'മലയാളം', short: 'മ', dir: 'ltr' },
] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const STORAGE_KEY = 'physio360.lang';

export function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.some((l) => l.code === value);
}

function storedLanguage(): Language | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

/** Applies lang + dir to <html>. All layout uses logical CSS properties, so this is the whole RTL switch. */
export function applyDocumentLanguage(language: string): void {
  const dir = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.dir ?? 'ltr';
  document.documentElement.lang = language;
  document.documentElement.dir = dir;
}

type AppStrings = Record<string, unknown>;
/** A dictionary, or a loader for one (dynamic import), so only the active language is downloaded. */
type AppSource = AppStrings | (() => Promise<AppStrings>);

const COMMON: Record<Language, AppStrings> = { en: commonEn, ar: commonAr, ml: commonMl };

/**
 * Initialise i18next with the shared "common" namespace plus app-specific
 * resources under the "app" namespace. English is always bundled (it is the
 * fallback); other languages may be passed as loaders and are fetched the
 * first time they are needed. Resolves once the starting language is ready,
 * so render after it.
 */
export async function createI18n(app: { en: AppStrings } & Partial<Record<Exclude<Language, 'en'>, AppSource>>, fallback: Language = 'en'): Promise<I18n> {
  const sources: Record<Language, AppSource> = { en: app.en, ar: app.ar ?? app.en, ml: app.ml ?? app.en };

  const lazyBackend: BackendModule = {
    type: 'backend',
    init() {},
    read(language, namespace, callback) {
      const lang = isLanguage(language) ? language : 'en';
      if (namespace === 'common') return callback(null, COMMON[lang]);
      const source = sources[lang];
      Promise.resolve(typeof source === 'function' ? source() : source).then(
        (strings) => callback(null, strings),
        (error: Error) => callback(error, false),
      );
    },
  };

  const lng = storedLanguage() ?? fallback;

  await i18next.use(lazyBackend).use(initReactI18next).init({
    resources: { en: { common: commonEn, app: app.en } },
    partialBundledLanguages: true,
    lng,
    fallbackLng: 'en',
    defaultNS: 'app',
    fallbackNS: 'common',
    ns: ['common', 'app'],
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  applyDocumentLanguage(i18next.language);
  i18next.on('languageChanged', (language) => {
    applyDocumentLanguage(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* storage unavailable: language just won't persist */
    }
  });

  return i18next;
}
