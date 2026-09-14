import { describe, expect, it } from 'vitest';
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import {
  RailsValidationError,
  RelayPool,
  buildNote,
  buildProfile,
  createIdentity,
  feedFilter,
  fetchProfile,
  publishNote,
} from '../src/index.js';
import { FakePool } from './helpers/fake-pool.js';

describe('notes', () => {
  it('builds a signed kind 1 note with hashtag tags', () => {
    const id = createIdentity();
    const note = buildNote(id, { content: 'Water is back in district 4', hashtags: ['#Outage', 'district4'] });
    expect(note.kind).toBe(1);
    expect(note.pubkey).toBe(id.publicKey);
    expect(note.tags).toEqual([
      ['t', 'outage'],
      ['t', 'district4'],
    ]);
    expect(verifyEvent(JSON.parse(JSON.stringify(note)))).toBe(true);
  });

  it('rejects empty content and malformed tags', () => {
    const id = createIdentity();
    expect(() => buildNote(id, { content: '   ' })).toThrow(RailsValidationError);
    expect(() => buildNote(id, { content: 'x', tags: [[1 as unknown as string]] })).toThrow(RailsValidationError);
    expect(() => buildNote(id, { content: 'x', hashtags: ['has space'] })).toThrow(RailsValidationError);
    expect(() => buildNote(id, { content: 'x', createdAt: -1 })).toThrow(RailsValidationError);
  });

  it('publishNote returns the event and relay summary', async () => {
    const fake = new FakePool();
    const pool = new RelayPool({ pool: fake, relays: ['wss://a.example', 'wss://b.example'] });
    const { event, result } = await publishNote(pool, createIdentity(), { content: 'hello' });
    expect(result.summary).toBe('Published to 2 of 2 relays');
    expect(fake.published[0]?.event.id).toBe(event.id);
  });

  it('feedFilter converts npubs to hex and hashtags to #t', () => {
    const id = createIdentity();
    expect(feedFilter({ authors: [id.npub], hashtags: ['#News'], limit: 20, since: 1_700_000_000 })).toEqual({
      kinds: [1],
      authors: [id.publicKey],
      '#t': ['news'],
      limit: 20,
      since: 1_700_000_000,
    });
    expect(() => feedFilter({ authors: ['npub1broken'] })).toThrow(RailsValidationError);
    expect(() => feedFilter({ limit: 0 })).toThrow(RailsValidationError);
  });

  it('fetchProfile returns the newest profile by the right author', async () => {
    const fake = new FakePool();
    const id = createIdentity();
    const other = createIdentity();
    const old = finalizeEvent(
      { kind: 0, content: JSON.stringify({ name: 'old' }), tags: [], created_at: 1_700_000_000 },
      id.secretKey,
    );
    fake.stored.push(old, buildProfile(id, { name: 'Amina', lud16: 'amina@pay.example.com' }));
    fake.stored.push(buildProfile(other, { name: 'impostor' }));
    const pool = new RelayPool({ pool: fake, relays: ['wss://a.example'] });
    const profile = await fetchProfile(pool, id.npub);
    expect(profile).toMatchObject({ name: 'Amina', lud16: 'amina@pay.example.com', publicKey: id.publicKey });
    expect(await fetchProfile(pool, createIdentity().publicKey)).toBeNull();
  });

  it('fetchProfile returns null for malformed profile JSON', async () => {
    const fake = new FakePool();
    const id = createIdentity();
    fake.stored.push(finalizeEvent({ kind: 0, content: '{not json', tags: [], created_at: 1_700_000_000 }, id.secretKey));
    const pool = new RelayPool({ pool: fake, relays: ['wss://a.example'] });
    expect(await fetchProfile(pool, id.publicKey)).toBeNull();
  });
});
