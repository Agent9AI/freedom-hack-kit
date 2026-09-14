/**
 * Panic wipe: erase everything this origin stored in the browser, then reload to a blank app.
 * Every step runs independently with a time cap, so one stuck browser API cannot stop the rest.
 * It cannot erase what lives outside the browser profile: see "What this kit does NOT protect against" in README.md.
 */

export type WipeStep = 'localStorage' | 'sessionStorage' | 'cookies' | 'indexedDB' | 'cacheStorage' | 'serviceWorkers';

export interface WipeReport {
  cleared: WipeStep[];
  failed: Array<{ step: WipeStep; error: string }>;
}

export interface WipeOptions {
  /** Databases to delete even where indexedDB.databases() is unsupported. */
  knownDatabases?: string[];
  /** Runs first, for example to abort requests and close open database connections. */
  beforeWipe?: () => void | Promise<void>;
  /** Navigation after wiping. Default: replace this history entry with the bare app root. Pass null to skip. */
  reload?: (() => void) | null;
  /** Per-step time cap in ms. */
  stepTimeoutMs?: number;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timed out')), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    // Blocked means another tab still holds a connection. Deletion finishes when that tab closes or reloads.
    request.onblocked = () => resolve();
  });
}

async function wipeIndexedDb(known: string[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const names = new Set(known);
  if (typeof indexedDB.databases === 'function') {
    for (const info of await indexedDB.databases()) if (info.name) names.add(info.name);
  }
  await Promise.all([...names].map(deleteDatabase));
}

async function wipeCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

async function wipeServiceWorkers(): Promise<void> {
  // navigator.serviceWorker is missing on plain-HTTP origins.
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

function wipeCookies(): void {
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

function defaultReload(): void {
  // Drops any query string or hash, which could itself hold sensitive text.
  location.replace(import.meta.env.BASE_URL);
}

export async function panicWipe(options: WipeOptions = {}): Promise<WipeReport> {
  const stepTimeoutMs = options.stepTimeoutMs ?? 2000;
  const report: WipeReport = { cleared: [], failed: [] };

  try {
    await withTimeout(Promise.resolve().then(options.beforeWipe), stepTimeoutMs);
  } catch {
    // Keep wiping even if cleanup failed.
  }

  const steps: Array<[WipeStep, () => void | Promise<void>]> = [
    ['localStorage', () => localStorage.clear()],
    ['sessionStorage', () => sessionStorage.clear()],
    ['cookies', wipeCookies],
    ['indexedDB', () => wipeIndexedDb(options.knownDatabases ?? [])],
    ['cacheStorage', wipeCaches],
    ['serviceWorkers', wipeServiceWorkers],
  ];

  await Promise.all(
    steps.map(async ([step, run]) => {
      try {
        await withTimeout(Promise.resolve().then(run), stepTimeoutMs);
        report.cleared.push(step);
      } catch (err) {
        report.failed.push({ step, error: err instanceof Error ? err.message : String(err) });
      }
    }),
  );

  const reload = options.reload === undefined ? defaultReload : options.reload;
  reload?.();
  return report;
}
