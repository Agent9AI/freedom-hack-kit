import { describe, expect, it } from 'vitest';
import { RailsValidationError, RelayPool, aggregateAcks, buildNote, createIdentity } from '../src/index.js';
import { FakePool } from './helpers/fake-pool.js';
import { fakeWebSocket } from './helpers/fake-websocket.js';

describe('aggregateAcks', () => {
  it('counts accepted relays and writes a UI summary', () => {
    const result = aggregateAcks('abc', ['wss://a.example', 'wss://b.example', 'wss://c.example'], [
      { status: 'fulfilled', value: '' },
      { status: 'rejected', reason: new Error('blocked: spam') },
      { status: 'fulfilled', value: 'duplicate: already have this event' },
    ]);
    expect(result.okCount).toBe(2);
    expect(result.total).toBe(3);
    expect(result.summary).toBe('Published to 2 of 3 relays');
    expect(result.acks[0]).toEqual({ relay: 'wss://a.example', ok: true, message: 'ok' });
    expect(result.acks[1]).toEqual({ relay: 'wss://b.example', ok: false, message: 'blocked: spam' });
  });

  it('uses the singular for one relay', () => {
    const result = aggregateAcks('abc', ['wss://a.example'], [{ status: 'rejected', reason: 'connection failure' }]);
    expect(result.summary).toBe('Published to 0 of 1 relay');
    expect(result.acks[0]?.message).toBe('connection failure');
  });
});

describe('RelayPool with an injected pool', () => {
  it('reports accepted, rejected and timed-out relays separately', async () => {
    const fake = new FakePool();
    fake.ack = (relay) => {
      if (relay.includes('good')) return Promise.resolve('');
      if (relay.includes('bad')) return Promise.reject(new Error('blocked: pow required'));
      return new Promise<string>(() => {});
    };
    const pool = new RelayPool({
      pool: fake,
      relays: ['wss://good1.example', 'wss://good2.example', 'wss://bad.example', 'wss://slow.example'],
      publishTimeoutMs: 50,
    });
    const result = await pool.publish(buildNote(createIdentity(), { content: 'hello' }));
    expect(result.summary).toBe('Published to 2 of 4 relays');
    const byRelay = Object.fromEntries(result.acks.map((ack) => [ack.relay, ack]));
    expect(byRelay['wss://bad.example']).toMatchObject({ ok: false, message: 'blocked: pow required' });
    expect(byRelay['wss://slow.example']).toMatchObject({ ok: false, message: 'publish timed out' });
  });

  it('refuses to publish a tampered event', async () => {
    const pool = new RelayPool({ pool: new FakePool(), relays: ['wss://a.example'] });
    const tampered = JSON.parse(JSON.stringify(buildNote(createIdentity(), { content: 'original' })));
    tampered.content = 'changed';
    await expect(pool.publish(tampered)).rejects.toBeInstanceOf(RailsValidationError);
  });

  it('validates and normalizes relay URLs', () => {
    const fake = new FakePool();
    expect(() => new RelayPool({ pool: fake, relays: ['ws://relay.example'] })).toThrow(RailsValidationError);
    expect(() => new RelayPool({ pool: fake, relays: ['https://relay.example'] })).toThrow(RailsValidationError);
    expect(() => new RelayPool({ pool: fake, relays: [] })).toThrow(RailsValidationError);
    const pool = new RelayPool({
      pool: fake,
      relays: ['wss://relay.example/', 'wss://relay.example', 'ws://abcdefghijklmnop.onion', 'wss://relay.example/v1'],
    });
    expect(pool.relays).toEqual(['wss://relay.example', 'ws://abcdefghijklmnop.onion', 'wss://relay.example/v1']);
  });

  it('subscribe returns an idempotent unsubscribe handle', async () => {
    const fake = new FakePool();
    const note = buildNote(createIdentity(), { content: 'stored note' });
    fake.stored.push(note);
    const pool = new RelayPool({ pool: fake, relays: ['wss://a.example'] });
    const seen: string[] = [];
    let eose = false;
    const sub = pool.subscribe({ kinds: [1] }, { onEvent: (e) => seen.push(e.id), onEose: () => (eose = true) });
    await Promise.resolve();
    expect(seen).toEqual([note.id]);
    expect(eose).toBe(true);
    sub.close();
    sub.close();
    expect(fake.subs[0]?.closed).toBe(true);
    expect(() => pool.subscribe({ kinds: [1] }, {} as never)).toThrow(RailsValidationError);
  });

  it('query dedupes and sorts newest first; close releases every relay used', async () => {
    const fake = new FakePool();
    const id = createIdentity();
    const older = buildNote(id, { content: 'older', createdAt: 1_700_000_000 });
    const newer = buildNote(id, { content: 'newer', createdAt: 1_700_000_100 });
    fake.stored.push(older, newer, older);
    const pool = new RelayPool({ pool: fake, relays: ['wss://a.example'] });
    const events = await pool.query({ kinds: [1] }, { relays: ['wss://extra.example'] });
    expect(events.map((e) => e.content)).toEqual(['newer', 'older']);
    pool.close();
    expect(fake.closedRelays).toEqual(expect.arrayContaining(['wss://a.example', 'wss://extra.example']));
  });
});

describe('RelayPool over a fake WebSocket (real nostr-tools relay code, no network)', () => {
  it('aggregates OK true, OK false, refused and silent relays', async () => {
    const WebSocketImpl = fakeWebSocket({
      'yes.example': 'accept',
      'no.example': 'reject',
      'down.example': 'refuse',
      'quiet.example': 'silent',
    });
    const pool = new RelayPool({
      relays: ['wss://yes.example', 'wss://no.example', 'wss://down.example', 'wss://quiet.example'],
      webSocketImplementation: WebSocketImpl,
      connectTimeoutMs: 300,
      publishTimeoutMs: 400,
    });
    const result = await pool.publish(buildNote(createIdentity(), { content: 'over the wire' }));
    pool.close();
    expect(result.summary).toBe('Published to 1 of 4 relays');
    const byRelay = Object.fromEntries(result.acks.map((ack) => [ack.relay, ack]));
    expect(byRelay['wss://yes.example']?.ok).toBe(true);
    expect(byRelay['wss://no.example']?.message).toContain('blocked');
    expect(byRelay['wss://down.example']?.message).toContain('connection');
    expect(byRelay['wss://quiet.example']?.message).toBe('publish timed out');
  });

  it('connect() reports reachable and unreachable relays within the timeout', async () => {
    const pool = new RelayPool({
      relays: ['wss://up.example', 'wss://hang.example'],
      webSocketImplementation: fakeWebSocket({ 'up.example': 'accept', 'hang.example': 'hang' }),
      connectTimeoutMs: 150,
    });
    const started = Date.now();
    const results = await pool.connect();
    pool.close();
    expect(Date.now() - started).toBeLessThan(1500);
    expect(results[0]).toEqual({ relay: 'wss://up.example', connected: true });
    expect(results[1]?.connected).toBe(false);
    expect(results[1]?.error).toMatch(/timed out/);
  });

  it('does not overflow the stack when close() re-fires error (Node 22 undici behavior)', async () => {
    const pool = new RelayPool({
      relays: ['wss://down.example'],
      webSocketImplementation: fakeWebSocket({ 'down.example': 'refuse-reentrant' }),
      connectTimeoutMs: 300,
    });
    const results = await pool.connect();
    pool.close();
    expect(results[0]).toMatchObject({ relay: 'wss://down.example', connected: false });
  });
});
