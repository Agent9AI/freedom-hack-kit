import type en from './locales/en';

export type MessageKey = keyof typeof en;
export type Dictionary = Record<MessageKey, string>;
export type Locale = 'en' | 'es' | 'fa' | 'ar' | 'ru';

export interface LocaleInfo {
  /** Language name written in that language, for the picker. */
  name: string;
  /** True until a native speaker has reviewed the dictionary. */
  machineDrafted: boolean;
}
