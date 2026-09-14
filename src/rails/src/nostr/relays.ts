import { SimplePool } from 'nostr-tools/pool';
import { AbstractSimplePool, type SubCloser, type SubscribeManyParams } from 'nostr-tools/abstract-pool';
import { verifyEvent, type Event } from 'nostr-tools/pure';
import type { Filter } from 'nostr-tools/filter';
import { RailsValidationError, assertRelayList, assertTimeoutMs } from '../validation.js';
import { errorMessage, withTimeout } from '../util.js';

/**
 * General-purpose public relays with long track records. Relay operators come
 * and go: re-check this list on event day (scripts/live-smoke.mjs).
 */
export const DEFAULT_RELAYS: readonly string[] = Object.freeze([
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.mom',
]);

/** The slice of nostr-tools' SimplePool that RelayPool uses. Tests pass a fake. */
export interface PoolLike {
  ensureRelay(url: string, params?: { connectionTimeout?: number }): Promise<unknown>;
  publish(relays: string[], event: Event, params?: { maxWait?: number }): Promise<string>[];
  subscribeMany(relays: string[], filter: Filter, params: SubscribeManyParams): SubCloser;
  querySync(relays: string[], filter: Filter, params?: { maxWait?: number }): Promise<Event[]>;
  close(relays: string[]): void;
}

export interface RelayAck {
  readonly relay: string;
  readonly ok: boolean;
  readonly message: string;
}

export interface PublishResult {
  readonly eventId: string;
  readonly acks: readonly RelayAck[];
  readonly okCount: number;
  readonly total: number;
  /** Ready for the UI, e.g. "Published to 3 of 5 relays". */
  readonly summary: string;
}

export interface ConnectResult {
  readonly relay: string;
  readonly connected: boolean;
  readonly error?: string;
}

export interface RelayPoolOptions {
  relays?: readonly string[];
  connectTimeoutMs?: number;
  publishTimeoutMs?: number;
  /** Inject a pool (tests, or a shared SimplePool). */
  pool?: PoolLike;
  /** Node 20 only: pass `WebSocket` from the `ws` package. Browsers and Node 22+ have one built in. */
  webSocketImplementation?: unknown;
}

export interface SubscriptionHandlers {
  onEvent: (event: Event) => void;
  onEose?: () => void;
  onClose?: (reasons: string[]) => void;
}

export interface Unsubscribe {
  close(): void;
}

export function aggregateAcks(
  eventId: string,
  relays: readonly string[],
  settled: readonly PromiseSettledResult<string>[],
): PublishResult {
  const acks = relays.map((relay, i): RelayAck => {
    const outcome = settled[i];
    if (!outcome) return { relay, ok: false, message: 'no result' };
    if (outcome.status === 'fulfilled') return { relay, ok: true, message: outcome.value || 'ok' };
    return { relay, ok: false, message: errorMessage(outcome.reason) };
  });
  const okCount = acks.filter((ack) => ack.ok).length;
  const noun = relays.length === 1 ? 'relay' : 'relays';
  return { eventId, acks, okCount, total: relays.length, summary: `Published to ${okCount} of ${relays.length} ${noun}` };
}

/*
 * Node 22+'s built-in WebSocket (undici) fires "error" synchronously when
 * close() is called on a socket that is still connecting, and nostr-tools
 * calls close() from inside onerror. Without this guard every unreachable
 * relay recurses until the stack overflows and the process crashes with an
 * uncaught RangeError. Letting close() run once breaks the loop.
 */
function closeOnce(Base: typeof WebSocket): typeof WebSocket {
  return class CloseOnceWebSocket extends Base {
    #closeCalled = false;

    override close(code?: number, reason?: string): void {
      if (this.#closeCalled) return;
      this.#closeCalled = true;
      super.close(code, reason);
    }
  };
}

function createPool(webSocketImplementation: unknown, connectTimeoutMs: number): PoolLike {
  const impl = webSocketImplementation ?? (typeof WebSocket === 'function' ? WebSocket : undefined);
  if (typeof impl !== 'function') {
    // No WebSocket at all (Node 20 without `ws`): connections will fail with a clear error.
    const pool = new SimplePool();
    pool.maxWaitForConnection = connectTimeoutMs;
    return pool;
  }
  return new AbstractSimplePool({
    verifyEvent,
    websocketImplementation: closeOnce(impl as typeof WebSocket),
    maxWaitForConnection: connectTimeoutMs,
  });
}

export class RelayPool {
  readonly relays: readonly string[];
  private readonly pool: PoolLike;
  private readonly connectTimeoutMs: number;
  private readonly publishTimeoutMs: number;
  private readonly used = new Set<string>();

  constructor(options: RelayPoolOptions = {}) {
    this.relays = Object.freeze(assertRelayList(options.relays ?? DEFAULT_RELAYS));
    this.connectTimeoutMs = assertTimeoutMs('connectTimeoutMs', options.connectTimeoutMs ?? 4000);
    this.publishTimeoutMs = assertTimeoutMs('publishTimeoutMs', options.publishTimeoutMs ?? 8000);
    this.pool = options.pool ?? createPool(options.webSocketImplementation, this.connectTimeoutMs);
  }

  private track(relays: readonly string[]): string[] {
    const urls = assertRelayList(relays);
    urls.forEach((url) => this.used.add(url));
    return urls;
  }

  /** Opens connections up front so the UI can show which relays are reachable. */
  async connect(relays: readonly string[] = this.relays): Promise<ConnectResult[]> {
    const urls = this.track(relays);
    const settled = await Promise.allSettled(
      urls.map((url) =>
        withTimeout(
          this.pool.ensureRelay(url, { connectionTimeout: this.connectTimeoutMs }),
          this.connectTimeoutMs + 500,
          'connection timed out',
        ),
      ),
    );
    return urls.map((relay, i): ConnectResult => {
      const outcome = settled[i];
      if (outcome?.status === 'fulfilled') return { relay, connected: true };
      return { relay, connected: false, error: errorMessage(outcome?.reason) };
    });
  }

  /** Publishes to every relay and reports each relay's answer. Never throws on relay failure. */
  async publish(event: Event, relays: readonly string[] = this.relays): Promise<PublishResult> {
    if (!event || !verifyEvent(event)) {
      throw new RailsValidationError('event', 'is not a validly signed Nostr event');
    }
    const urls = this.track(relays);
    const pending = this.pool.publish(urls, event, { maxWait: this.publishTimeoutMs });
    const settled = await Promise.allSettled(
      pending.map((promise) => withTimeout(promise, this.publishTimeoutMs, 'publish timed out')),
    );
    return aggregateAcks(event.id, urls, settled);
  }

  subscribe(filter: Filter, handlers: SubscriptionHandlers, relays: readonly string[] = this.relays): Unsubscribe {
    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
      throw new RailsValidationError('filter', 'must be a single filter object');
    }
    if (typeof handlers?.onEvent !== 'function') {
      throw new RailsValidationError('handlers.onEvent', 'must be a function');
    }
    const urls = this.track(relays);
    const closer = this.pool.subscribeMany(urls, filter, {
      onevent: handlers.onEvent,
      oneose: handlers.onEose,
      onclose: (reasons) => handlers.onClose?.(reasons.map((r) => `${r.url}: ${r.reason}`)),
    });
    let closed = false;
    return {
      close: () => {
        if (closed) return;
        closed = true;
        closer.close();
      },
    };
  }

  /** One-shot fetch: waits for EOSE (or maxWaitMs) and returns unique events, newest first. */
  async query(filter: Filter, options: { maxWaitMs?: number; relays?: readonly string[] } = {}): Promise<Event[]> {
    const urls = this.track(options.relays ?? this.relays);
    const maxWait = assertTimeoutMs('maxWaitMs', options.maxWaitMs ?? 5000);
    const events = await withTimeout(this.pool.querySync(urls, filter, { maxWait }), maxWait + 1000, 'query timed out');
    const unique = new Map<string, Event>();
    for (const event of events) unique.set(event.id, event);
    return [...unique.values()].sort((a, b) => b.created_at - a.created_at);
  }

  /** Closes every connection this pool opened, including one-off relays used for DMs. */
  close(): void {
    this.pool.close([...this.used, ...this.relays]);
    this.used.clear();
  }
}
