import { describe, expect, it } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import {
  RailsValidationError,
  RelayPool,
  buildNote,
  createIdentity,
  sendDm,
  subscribeDms,
  unwrapDm,
  wrapDm,
  type DirectMessage,
} from '../src/index.js';
import { FakePool } from './helpers/fake-pool.js';

describe('NIP-17 private DMs (NIP-44 encryption)', () => {
  it('encrypts then decrypts a message for the recipient', () => {
    const alice = createIdentity();
    const bob = createIdentity();
    const wrapped = wrapDm(alice, bob.npub, 'meet at 6', { subject: 'plan' });

    expect(wrapped.toRecipient.kind).toBe(1059);
    expect(wrapped.toRecipient.pubkey).not.toBe(alice.publicKey);
    expect(wrapped.toRecipient.tags).toEqual([['p', bob.publicKey]]);
    expect(wrapped.toRecipient.content).not.toContain('meet at 6');

    const message = unwrapDm(wrapped.toRecipient, bob);
    expect(message).toMatchObject({
      id: wrapped.rumorId,
      from: alice.publicKey,
      fromNpub: alice.npub,
      to: [bob.publicKey],
      content: 'meet at 6',
      subject: 'plan',
    });
  });

  it('gives the sender a readable copy that still names the recipient', () => {
    const alice = createIdentity();
    const bob = createIdentity();
    const wrapped = wrapDm(alice, bob.publicKey, 'copy for my other phone');
    expect(wrapped.toSelf.tags).toEqual([['p', alice.publicKey]]);
    const copy = unwrapDm(wrapped.toSelf, alice);
    expect(copy).toMatchObject({ id: wrapped.rumorId, from: alice.publicKey, to: [bob.publicKey] });
  });

  it('cannot be read by a third party', () => {
    const wrapped = wrapDm(createIdentity(), createIdentity().npub, 'secret');
    expect(() => unwrapDm(wrapped.toRecipient, createIdentity())).toThrow(RailsValidationError);
  });

  it('rejects tampered wraps, wrong kinds and bad input', () => {
    const alice = createIdentity();
    const bob = createIdentity();
    const tampered = JSON.parse(JSON.stringify(wrapDm(alice, bob.npub, 'hello').toRecipient));
    tampered.content = `${tampered.content.slice(0, 40)}AAAA${tampered.content.slice(44)}`;
    expect(() => unwrapDm(tampered, bob)).toThrow(RailsValidationError);
    expect(() => unwrapDm(buildNote(alice, { content: 'public' }), bob)).toThrow(/1059/);
    expect(() => wrapDm(alice, bob.npub, 'x'.repeat(30_001))).toThrow(RailsValidationError);
    expect(() => wrapDm(alice, bob.npub, '\u{1F510}'.repeat(8_000))).toThrow(/bytes/);
    expect(() => wrapDm(alice, 'npub1bad', 'hi')).toThrow(RailsValidationError);
    expect(() => wrapDm(alice, bob.npub, '')).toThrow(RailsValidationError);
  });

  it('sendDm uses the recipient inbox relays (kind 10050) and sends a self copy to own relays', async () => {
    const fake = new FakePool();
    const alice = createIdentity();
    const bob = createIdentity();
    fake.stored.push(
      finalizeEvent(
        {
          kind: 10050,
          tags: [
            ['relay', 'wss://inbox.example'],
            ['relay', 'ws://plaintext.example'],
          ],
          content: '',
          created_at: 1_700_000_000,
        },
        bob.secretKey,
      ),
    );
    const pool = new RelayPool({ pool: fake, relays: ['wss://mine.example'] });
    const result = await sendDm(pool, alice, bob.npub, 'hello bob');

    expect(result.recipientRelays).toEqual(['wss://inbox.example']);
    expect(result.toRecipient.summary).toBe('Published to 1 of 1 relay');
    expect(fake.published[0]?.relays).toEqual(['wss://inbox.example']);
    expect(fake.published[1]?.relays).toEqual(['wss://mine.example']);
    expect(unwrapDm(fake.published[0]!.event, bob).content).toBe('hello bob');
    expect(unwrapDm(fake.published[1]!.event, alice).content).toBe('hello bob');
  });

  it('sendDm falls back to the pool relays when the recipient has no inbox list', async () => {
    const fake = new FakePool();
    const pool = new RelayPool({ pool: fake, relays: ['wss://mine.example'] });
    const result = await sendDm(pool, createIdentity(), createIdentity().npub, 'hi');
    expect(result.recipientRelays).toEqual(['wss://mine.example']);
  });

  it('subscribeDms decrypts, dedupes, and reports wraps it cannot open', () => {
    const fake = new FakePool();
    const alice = createIdentity();
    const bob = createIdentity();
    const pool = new RelayPool({ pool: fake, relays: ['wss://mine.example'] });
    const received: DirectMessage[] = [];
    const errors: Error[] = [];
    const sub = subscribeDms(pool, bob, (m) => received.push(m), { onError: (e) => errors.push(e) });

    expect(fake.subs[0]?.filter).toEqual({ kinds: [1059], '#p': [bob.publicKey] });
    const wrap = wrapDm(alice, bob.publicKey, 'one').toRecipient;
    fake.emit(wrap);
    fake.emit(wrap);
    const notForBob = JSON.parse(JSON.stringify(wrapDm(alice, createIdentity().publicKey, 'x').toRecipient));
    notForBob.tags = [['p', bob.publicKey]];
    fake.emit(notForBob);

    expect(received.map((m) => m.content)).toEqual(['one']);
    expect(errors).toHaveLength(1);
    sub.close();
    expect(fake.subs[0]?.closed).toBe(true);
  });

  it('widens the since filter by two days for randomized wrap timestamps', () => {
    const fake = new FakePool();
    const pool = new RelayPool({ pool: fake, relays: ['wss://mine.example'] });
    subscribeDms(pool, createIdentity(), () => {}, { since: 1_800_000_000 });
    expect(fake.subs[0]?.filter.since).toBe(1_800_000_000 - 2 * 24 * 60 * 60);
  });
});
