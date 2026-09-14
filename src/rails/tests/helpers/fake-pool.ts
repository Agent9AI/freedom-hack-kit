import { matchFilter, type Filter } from 'nostr-tools/filter';
import type { Event } from 'nostr-tools/pure';
import type { SubCloser, SubscribeManyParams } from 'nostr-tools/abstract-pool';
import type { PoolLike } from '../../src/index.js';

interface FakeSubscription {
  relays: string[];
  filter: Filter;
  params: SubscribeManyParams;
  closed: boolean;
}

/** In-memory stand-in for nostr-tools' SimplePool. No sockets, no network. */
export class FakePool implements PoolLike {
  readonly published: { relays: string[]; event: Event }[] = [];
  readonly stored: Event[] = [];
  readonly subs: FakeSubscription[] = [];
  readonly closedRelays: string[] = [];
  /** Per-relay publish outcome. Default: every relay accepts. */
  ack: (relay: string, event: Event) => Promise<string> = async () => '';
  /** Called after each publish, e.g. to play a wallet service. */
  onPublish?: (event: Event) => void;

  async ensureRelay(url: string): Promise<unknown> {
    return { url };
  }

  publish(relays: string[], event: Event): Promise<string>[] {
    this.published.push({ relays, event });
    queueMicrotask(() => this.onPublish?.(event));
    return relays.map((relay) => this.ack(relay, event));
  }

  subscribeMany(relays: string[], filter: Filter, params: SubscribeManyParams): SubCloser {
    const sub: FakeSubscription = { relays, filter, params, closed: false };
    this.subs.push(sub);
    queueMicrotask(() => {
      for (const event of this.stored) {
        if (!sub.closed && matchFilter(filter, event)) params.onevent?.(event);
      }
      if (!sub.closed) params.oneose?.();
    });
    return {
      close: () => {
        sub.closed = true;
      },
    };
  }

  async querySync(_relays: string[], filter: Filter): Promise<Event[]> {
    return this.stored.filter((event) => matchFilter(filter, event));
  }

  /** Delivers a live event to every open matching subscription. */
  emit(event: Event): void {
    for (const sub of this.subs) {
      if (!sub.closed && matchFilter(sub.filter, event)) sub.params.onevent?.(event);
    }
  }

  close(relays: string[]): void {
    this.closedRelays.push(...relays);
  }
}
