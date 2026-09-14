import { finalizeEvent, type Event, type VerifiedEvent } from 'nostr-tools/pure';
import { Metadata, ShortTextNote } from 'nostr-tools/kinds';
import type { Filter } from 'nostr-tools/filter';
import { npubEncode } from 'nostr-tools/nip19';
import { parsePublicKey, type NostrIdentity } from './keys.js';
import type { PublishResult, RelayPool, Unsubscribe } from './relays.js';
import { RailsValidationError, assertNonEmptyString, assertPositiveInteger } from '../validation.js';
import { isRecord, newestEvent, nowSeconds } from '../util.js';

export const MAX_NOTE_LENGTH = 32_000;

export interface NoteInput {
  content: string;
  /** Raw Nostr tags, e.g. [["e", eventId, "", "reply"]]. */
  tags?: string[][];
  /** Adds ["t", tag] tags so the note shows up in hashtag feeds. */
  hashtags?: string[];
  createdAt?: number;
}

const HASHTAG = /^[\p{L}\p{N}_-]{1,64}$/u;

function normalizeHashtag(tag: unknown): string {
  const value = typeof tag === 'string' ? tag.trim().replace(/^#/, '').toLowerCase() : '';
  if (!HASHTAG.test(value)) {
    throw new RailsValidationError('hashtags', 'each hashtag must be 1-64 letters, digits, _ or -');
  }
  return value;
}

function assertTags(tags: unknown): string[][] {
  if (tags === undefined) return [];
  if (!Array.isArray(tags) || tags.length > 200) {
    throw new RailsValidationError('tags', 'must be an array of at most 200 tags');
  }
  return tags.map((tag) => {
    const valid =
      Array.isArray(tag) &&
      tag.length > 0 &&
      tag.every((part) => typeof part === 'string' && part.length <= 4096);
    if (!valid) throw new RailsValidationError('tags', 'each tag must be a non-empty array of strings');
    return [...(tag as string[])];
  });
}

export function buildNote(identity: NostrIdentity, input: NoteInput): VerifiedEvent {
  const content = assertNonEmptyString('content', input?.content, MAX_NOTE_LENGTH);
  const tags = assertTags(input.tags);
  for (const hashtag of input.hashtags ?? []) tags.push(['t', normalizeHashtag(hashtag)]);
  const created_at =
    input.createdAt === undefined ? nowSeconds() : assertPositiveInteger('createdAt', input.createdAt, 2 ** 32);
  return finalizeEvent({ kind: ShortTextNote, content, tags, created_at }, identity.secretKey);
}

export async function publishNote(
  pool: RelayPool,
  identity: NostrIdentity,
  input: NoteInput,
): Promise<{ event: VerifiedEvent; result: PublishResult }> {
  const event = buildNote(identity, input);
  return { event, result: await pool.publish(event) };
}

export interface FeedQuery {
  /** npub or hex public keys. */
  authors?: string[];
  hashtags?: string[];
  since?: number;
  limit?: number;
}

export function feedFilter(query: FeedQuery = {}): Filter {
  const filter: Filter = {
    kinds: [ShortTextNote],
    limit: assertPositiveInteger('limit', query.limit ?? 50, 500),
  };
  if (query.authors?.length) filter.authors = query.authors.map(parsePublicKey);
  if (query.hashtags?.length) filter['#t'] = query.hashtags.map(normalizeHashtag);
  if (query.since !== undefined) filter.since = assertPositiveInteger('since', query.since, 2 ** 32);
  return filter;
}

/** Live feed: stored notes arrive first, then `onEose`, then new notes as they are published. */
export function subscribeFeed(
  pool: RelayPool,
  query: FeedQuery,
  onNote: (event: Event) => void,
  onEose?: () => void,
): Unsubscribe {
  return pool.subscribe(feedFilter(query), { onEvent: onNote, onEose });
}

export async function fetchFeed(pool: RelayPool, query: FeedQuery = {}, maxWaitMs?: number): Promise<Event[]> {
  return pool.query(feedFilter(query), { maxWaitMs });
}

export interface NostrProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  nip05?: string;
  /** Lightning address for tips, e.g. name@getalby.com. */
  lud16?: string;
}

export interface FetchedProfile extends NostrProfile {
  publicKey: string;
  npub: string;
  updatedAt: number;
}

const PROFILE_FIELDS = ['name', 'display_name', 'about', 'picture', 'banner', 'website', 'nip05', 'lud16'] as const;

export function buildProfile(identity: NostrIdentity, profile: NostrProfile): VerifiedEvent {
  if (!isRecord(profile)) throw new RailsValidationError('profile', 'must be an object');
  const clean: NostrProfile = {};
  for (const field of PROFILE_FIELDS) {
    const value = profile[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > 2000) {
      throw new RailsValidationError(`profile.${field}`, 'must be a string of at most 2000 characters');
    }
    clean[field] = value;
  }
  return finalizeEvent(
    { kind: Metadata, content: JSON.stringify(clean), tags: [], created_at: nowSeconds() },
    identity.secretKey,
  );
}

/** Newest kind 0 profile for a public key, or null if no relay has one. Malformed JSON returns null. */
export async function fetchProfile(
  pool: RelayPool,
  publicKey: string,
  options: { maxWaitMs?: number } = {},
): Promise<FetchedProfile | null> {
  const pubkey = parsePublicKey(publicKey);
  const events = await pool.query({ kinds: [Metadata], authors: [pubkey], limit: 5 }, options);
  const latest = newestEvent(events.filter((e) => e.kind === Metadata && e.pubkey === pubkey));
  if (!latest) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(latest.content);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const profile: FetchedProfile = { publicKey: pubkey, npub: npubEncode(pubkey), updatedAt: latest.created_at };
  for (const field of PROFILE_FIELDS) {
    const value = parsed[field];
    if (typeof value === 'string') profile[field] = value.slice(0, 2000);
  }
  return profile;
}
