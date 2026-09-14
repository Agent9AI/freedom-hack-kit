/**
 * Runtime settings, validated at the storage boundary and kept only in this browser.
 * The API key goes to sessionStorage (gone when the tab closes) unless the user ticks "remember".
 */
import { isLocale, matchLocale, type Locale } from '../i18n';
import { DEFAULT_PROVIDER, PROVIDERS, isProviderId, type ProviderId } from '../llm/providers';

export interface Settings {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  rememberKey: boolean;
  systemPrompt: string;
  locale: Locale;
}

export const SETTINGS_KEY = 'starter.settings';
export const API_KEY_KEY = 'starter.apiKey';
const MAX_FIELD = 2000;
const MAX_PROMPT = 8000;

export const DEFAULT_SYSTEM_PROMPT =
  'You are a careful, concise assistant. Answer in the language the user writes in. If you are not sure, say so.';

function text(value: unknown, fallback: string, max = MAX_FIELD): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language ?? 'en'];
}

export function defaultSettings(languages: readonly string[] = browserLanguages()): Settings {
  return {
    provider: DEFAULT_PROVIDER,
    baseUrl: PROVIDERS[DEFAULT_PROVIDER].baseUrl,
    model: '',
    apiKey: '',
    rememberKey: false,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    locale: matchLocale(languages),
  };
}

export function loadSettings(local: Storage = localStorage, session: Storage = sessionStorage): Settings {
  const defaults = defaultSettings();
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(safeGet(local, SETTINGS_KEY) ?? '{}');
    if (parsed && typeof parsed === 'object') raw = parsed as Record<string, unknown>;
  } catch {
    // Corrupted settings: fall back to defaults.
  }
  const rememberKey = raw.rememberKey === true;
  return {
    provider: isProviderId(raw.provider) ? raw.provider : defaults.provider,
    baseUrl: text(raw.baseUrl, defaults.baseUrl),
    model: text(raw.model, defaults.model),
    apiKey: text(safeGet(rememberKey ? local : session, API_KEY_KEY), ''),
    rememberKey,
    systemPrompt: text(raw.systemPrompt, defaults.systemPrompt, MAX_PROMPT),
    locale: isLocale(raw.locale) ? raw.locale : defaults.locale,
  };
}

export function saveSettings(settings: Settings, local: Storage = localStorage, session: Storage = sessionStorage): void {
  const { apiKey, ...rest } = settings;
  try {
    local.setItem(SETTINGS_KEY, JSON.stringify(rest));
    local.removeItem(API_KEY_KEY);
    session.removeItem(API_KEY_KEY);
    if (apiKey) (settings.rememberKey ? local : session).setItem(API_KEY_KEY, apiKey);
  } catch {
    // Storage blocked (for example some private modes): settings last for this page view only.
  }
}
