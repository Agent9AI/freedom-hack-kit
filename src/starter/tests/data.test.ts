import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildExport } from '../src/data/export';
import { LocalStore } from '../src/data/store';
import { API_KEY_KEY, SETTINGS_KEY, defaultSettings, loadSettings, saveSettings, type Settings } from '../src/settings/settings';

let dbCounter = 0;

describe('LocalStore', () => {
  it('stores records and lists them oldest first, optionally by kind', async () => {
    const store = new LocalStore(`test-db-${++dbCounter}`);
    await store.put({ id: 'b', kind: 'message', createdAt: 20, data: 'second' });
    await store.put({ id: 'a', kind: 'message', createdAt: 10, data: 'first' });
    await store.put({ id: 'n', kind: 'note', createdAt: 5, data: 'note' });
    expect((await store.list()).map((r) => r.id)).toEqual(['n', 'a', 'b']);
    expect((await store.list('message')).map((r) => r.data)).toEqual(['first', 'second']);
    await store.clear();
    expect(await store.list()).toEqual([]);
    store.destroy();
  });
});

describe('settings', () => {
  const sample = (): Settings => ({ ...defaultSettings(['en']), model: 'llama3.2:3b', apiKey: 'sk-test' });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the API key in sessionStorage unless the user asks to remember it', () => {
    saveSettings(sample());
    expect(sessionStorage.getItem(API_KEY_KEY)).toBe('sk-test');
    expect(localStorage.getItem(API_KEY_KEY)).toBeNull();
    expect(localStorage.getItem(SETTINGS_KEY)).not.toContain('sk-test');

    saveSettings({ ...sample(), rememberKey: true });
    expect(localStorage.getItem(API_KEY_KEY)).toBe('sk-test');
    expect(sessionStorage.getItem(API_KEY_KEY)).toBeNull();
    expect(loadSettings()).toMatchObject({ apiKey: 'sk-test', rememberKey: true, model: 'llama3.2:3b' });
  });

  it('falls back to defaults for corrupted or hostile stored values', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings()).toMatchObject({ provider: 'local-ollama', model: '' });

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ provider: '__proto__', locale: 'xx', model: 42, baseUrl: 'x'.repeat(5000) }));
    const loaded = loadSettings();
    expect(loaded.provider).toBe('local-ollama');
    expect(['en', 'es', 'fa', 'ar', 'ru']).toContain(loaded.locale);
    expect(loaded.model).toBe('');
    expect(loaded.baseUrl).toHaveLength(2000);
  });
});

describe('export', () => {
  it('never includes the API key', () => {
    const settings = { ...defaultSettings(['en']), apiKey: 'sk-secret' };
    const bundle = buildExport(settings, [{ id: '1', kind: 'message', createdAt: 1, data: 'hi' }], new Date('2026-09-24T09:00:00Z'));
    expect(JSON.stringify(bundle)).not.toContain('sk-secret');
    expect(bundle).toMatchObject({ format: 'private-ai-starter/v1', exportedAt: '2026-09-24T09:00:00.000Z', records: [{ id: '1' }] });
  });
});
