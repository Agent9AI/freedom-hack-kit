export type RelayMode = 'accept' | 'reject' | 'refuse' | 'refuse-reentrant' | 'hang' | 'silent';

/**
 * Minimal WebSocket stand-in that speaks just enough NIP-01 for nostr-tools'
 * real AbstractRelay code. Behavior is chosen per host:
 * accept = OK true, reject = OK false, refuse = connection error,
 * refuse-reentrant = connection error that fires again from close() the way
 * Node 22's undici WebSocket does, hang = never opens,
 * silent = opens but never answers EVENT.
 */
export function fakeWebSocket(modes: Record<string, RelayMode>) {
  return class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readyState = 0;
    onopen: (() => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    readonly mode: RelayMode;

    constructor(readonly url: string) {
      this.mode = modes[new URL(url).host] ?? 'refuse';
      setTimeout(() => {
        if (this.mode === 'hang') return;
        if (this.mode === 'refuse' || this.mode === 'refuse-reentrant') {
          this.onerror?.({});
          return;
        }
        this.readyState = 1;
        this.onopen?.();
      }, 1);
    }

    send(data: string): void {
      const message = JSON.parse(data) as unknown[];
      if (message[0] === 'EVENT') {
        const event = message[1] as { id: string };
        if (this.mode === 'accept') this.reply(['OK', event.id, true, '']);
        if (this.mode === 'reject') this.reply(['OK', event.id, false, 'blocked: not allowed to post here']);
      } else if (message[0] === 'REQ') {
        this.reply(['EOSE', message[1]]);
      }
    }

    close(): void {
      // undici fails the pending connection and fires "error" before readyState changes.
      if (this.mode === 'refuse-reentrant' && this.readyState === 0) this.onerror?.({});
      this.readyState = 3;
    }

    reply(message: unknown[]): void {
      setTimeout(() => this.onmessage?.({ data: JSON.stringify(message) }), 1);
    }
  };
}
