/** Tiny promise wrapper around one IndexedDB object store. Replace the schema as the app grows. */

export const DB_NAME = 'private-ai-starter';
const DB_VERSION = 1;
const STORE = 'records';

export interface AppRecord<T = unknown> {
  id: string;
  kind: string;
  createdAt: number;
  data: T;
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export class LocalStore {
  readonly name: string;
  private connection: Promise<IDBDatabase> | null = null;
  private destroyed = false;

  constructor(name: string = DB_NAME) {
    this.name = name;
  }

  private open(): Promise<IDBDatabase> {
    if (this.destroyed) return Promise.reject(new Error('Store was destroyed'));
    this.connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.name, DB_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('kind', 'kind');
      };
      request.onsuccess = () => {
        const db = request.result;
        // Let a panic wipe (in this tab or another) delete the database instead of being blocked by us.
        db.onversionchange = () => {
          db.close();
          this.connection = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        this.connection = null;
        reject(request.error);
      };
    });
    return this.connection;
  }

  async put(record: AppRecord): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    await done(tx);
  }

  /** All records (optionally of one kind), oldest first. */
  async list(kind?: string): Promise<AppRecord[]> {
    const db = await this.open();
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    const records = await result<AppRecord[]>(kind === undefined ? store.getAll() : store.index('kind').getAll(kind));
    return records.sort((a, b) => a.createdAt - b.createdAt);
  }

  async clear(): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await done(tx);
  }

  /** Closes the connection and refuses every later call, so an in-flight reply cannot recreate data after a wipe. */
  destroy(): void {
    this.destroyed = true;
    const pending = this.connection;
    this.connection = null;
    pending?.then((db) => db.close(), () => undefined);
  }
}
