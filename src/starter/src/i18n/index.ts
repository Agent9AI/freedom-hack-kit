/**
 * Tiny dictionary i18n: no library, no runtime fetches. Dictionaries are bundled.
 * Mark elements with data-i18n="key" (text), data-i18n-placeholder, data-i18n-aria-label
 * or data-i18n-title, and setLocale() retranslates them and flips dir for RTL languages.
 */
import ar from './locales/ar';
import en from './locales/en';
import es from './locales/es';
import fa from './locales/fa';
import ru from './locales/ru';
import type { Dictionary, Locale, LocaleInfo, MessageKey } from './types';

export type { Dictionary, Locale, LocaleInfo, MessageKey } from './types';

export const LOCALES: Record<Locale, LocaleInfo> = {
  en: { name: 'English', machineDrafted: false },
  es: { name: 'Español', machineDrafted: true },
  fa: { name: 'فارسی', machineDrafted: true },
  ar: { name: 'العربية', machineDrafted: true },
  ru: { name: 'Русский', machineDrafted: true },
};

export const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = { en, es, fa, ar, ru };

/** Base language subtags written right to left. Direction is derived from this, never set per locale by hand. */
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ckb', 'dv', 'ug', 'yi']);

const ATTRIBUTES: Array<[selectorAttr: string, datasetKey: 'i18nPlaceholder' | 'i18nAriaLabel' | 'i18nTitle', target: string]> = [
  ['data-i18n-placeholder', 'i18nPlaceholder', 'placeholder'],
  ['data-i18n-aria-label', 'i18nAriaLabel', 'aria-label'],
  ['data-i18n-title', 'i18nTitle', 'title'],
];

let current: Locale = 'en';

function baseLanguage(tag: string): string {
  return tag.trim().toLowerCase().split(/[-_]/)[0] ?? '';
}

export function isRtl(tag: string): boolean {
  return RTL_LANGUAGES.has(baseLanguage(tag));
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && Object.hasOwn(LOCALES, value);
}

/** First supported language from a preference list such as navigator.languages, else English. */
export function matchLocale(preferences: readonly string[]): Locale {
  for (const tag of preferences) {
    const base = baseLanguage(tag);
    if (isLocale(base)) return base;
  }
  return 'en';
}

export function getLocale(): Locale {
  return current;
}

/** Translates a key, falling back to English, and fills {name} placeholders. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template = DICTIONARIES[current][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : match));
}

export function applyTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as MessageKey);
  });
  for (const [selectorAttr, datasetKey, target] of ATTRIBUTES) {
    root.querySelectorAll<HTMLElement>(`[${selectorAttr}]`).forEach((el) => {
      el.setAttribute(target, t(el.dataset[datasetKey] as MessageKey));
    });
  }
}

/** Switches language: sets <html lang> and dir, then retranslates the page. */
export function setLocale(locale: Locale, doc: Document = document): void {
  current = locale;
  doc.documentElement.lang = locale;
  doc.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
  applyTranslations(doc);
}
