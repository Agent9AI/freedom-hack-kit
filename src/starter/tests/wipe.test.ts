import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, LocalStore } from '../src/data/store';
import { panicWipe, type WipeStep } from '../src/data/wipe';

const ALL_STEPS: WipeStep[] = ['cacheStorage', 'cookies', 'indexedDB', 'localStorage', 'serviceWorkers', 'sessionStorage'];

function installFakeCaches(): Map<string, unknown> {
  const entries = new Map<string, unknown>([['shell-abc123', {}]]);
  vi.stubGlobal('caches', {
    keys: vi.fn(async () => [...entries.keys()]),
    delete: vi.fn(async (key: string) => entries.delete(key)),
  });
  return entries;
}

function installFakeServiceWorker(getRegistrations: () => Promise<Array<{ unregister: () => Promise<boolean> }>>): void {
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistrations } });
}

function createRawDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('notes');
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((db) => db.name ?? '');
}

describe('panicWipe', () => {
  let store: LocalStore;
  let cacheEntries: Map<string, unknown>;
  let unregister: ReturnType<typeof vi.fn<() => Promise<boolean>>>;

  beforeEach(async () => {
    localStorage.setItem('starter.settings', '{"model":"m"}');
    localStorage.setItem('starter.apiKey', 'secret-key');
    sessionStorage.setItem('draft', 'sensitive draft');
    document.cookie = 'session=abc; path=/';
    store = new LocalStore();
    await store.put({ id: '1', kind: 'message', createdAt: 1, data: { role: 'user', content: 'sensitive' } });
    await createRawDatabase('other-db');
    cacheEntries = installFakeCaches();
    unregister = vi.fn(async () => true);
    installFakeServiceWorker(async () => [{ unregister }]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
    store.destroy();
    for (const name of await databaseNames()) indexedDB.deleteDatabase(name);
  });

  it('clears storage, cookies, IndexedDB, Cache Storage and service workers, then reloads', async () => {
    expect(await databaseNames()).toEqual(expect.arrayContaining([DB_NAME, 'other-db']));
    const reload = vi.fn();

    const report = await panicWipe({ knownDatabases: [DB_NAME], beforeWipe: () => store.destroy(), reload });

    expect(report.failed).toEqual([]);
    expect([...report.cleared].sort()).toEqual(ALL_STEPS);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain('session=abc');
    expect(await databaseNames()).toEqual([]);
    expect(cacheEntries.size).toBe(0);
    expect(unregister).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(await new LocalStore().list()).toEqual([]);
  });

  it('is not blocked by a database connection the app left open', async () => {
    await panicWipe({ knownDatabases: [DB_NAME], reload: null });
    expect(await databaseNames()).toEqual([]);
  });

  it('refuses writes after destroy, so an in-flight reply cannot recreate data', async () => {
    store.destroy();
    await expect(store.put({ id: '2', kind: 'message', createdAt: 2, data: {} })).rejects.toThrow('destroyed');
  });

  it('keeps going when one step fails, and still reloads', async () => {
    vi.stubGlobal('caches', {
      keys: vi.fn(async () => {
        throw new Error('denied');
      }),
    });
    const reload = vi.fn();
    const report = await panicWipe({ knownDatabases: [DB_NAME], reload });
    expect(report.failed).toEqual([{ step: 'cacheStorage', error: 'denied' }]);
    expect(localStorage.length).toBe(0);
    expect(await databaseNames()).toEqual([]);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('caps a step that never finishes', async () => {
    installFakeServiceWorker(() => new Promise(() => undefined));
    const report = await panicWipe({ reload: null, stepTimeoutMs: 30 });
    expect(report.failed).toEqual([{ step: 'serviceWorkers', error: 'timed out' }]);
    expect(report.cleared).toContain('localStorage');
  });

  it('deletes known databases where indexedDB.databases() is unsupported', async () => {
    const original = indexedDB.databases;
    Object.defineProperty(indexedDB, 'databases', { configurable: true, value: undefined });
    try {
      await panicWipe({ knownDatabases: [DB_NAME], reload: null });
    } finally {
      Object.defineProperty(indexedDB, 'databases', { configurable: true, value: original });
    }
    expect(await databaseNames()).toEqual(['other-db']);
  });
});
