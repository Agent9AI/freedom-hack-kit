import { getEventHash, type Event, type NostrEvent } from 'nostr-tools/pure';
import * as nip59 from 'nostr-tools/nip59';
import { DirectMessageRelaysList, GiftWrap, PrivateDirectMessage } from 'nostr-tools/kinds';
import { npubEncode } from 'nostr-tools/nip19';
import { parsePublicKey, type NostrIdentity } from './keys.js';
import type { PublishResult, RelayPool, Unsubscribe } from './relays.js';
import { RailsValidationError, assertNonEmptyString, assertRelayList, assertRelayUrl, isHex64 } from '../validation.js';
import { errorMessage, newestEvent, nowSeconds } from '../util.js';

/*
 * Private messages use NIP-17. The message (kind 14 "rumor", unsigned) is
 * sealed (kind 13, NIP-44 encrypted, signed by the sender) and then gift
 * wrapped (kind 1059, NIP-44 encrypted again, signed by a throwaway key with a
 * timestamp randomized up to two days back). Relays learn only the recipient's
 * public key: not the sender, not the content, not the real send time.
 *
 * There is deliberately NO NIP-04 fallback. NIP-04 DMs expose sender,
 * recipient and exact timing to every relay, which is exactly the metadata an
 * adversary watching activists wants.
 */

/** UTF-8 bytes. Keeps the double NIP-44 wrap under NIP-44's 65535-byte plaintext limit. */
export const MAX_DM_BYTES = 30_000;
const MAX_WRAP_CONTENT_CHARS = 100_000;
const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;

export interface DirectMessage {
  /** Rumor id. Identical for the recipient's copy and the sender's own copy. */
  readonly id: string;
  readonly wrapId: string;
  readonly from: string;
  readonly fromNpub: string;
  readonly to: readonly string[];
  readonly content: string;
  readonly createdAt: number;
  readonly subject?: string;
}

export interface WrappedDm {
  readonly rumorId: string;
  readonly toRecipient: NostrEvent;
  /** Copy for the sender's other devices, so sent messages show up in their inbox too. */
  readonly toSelf: NostrEvent;
}

export function wrapDm(
  sender: NostrIdentity,
  recipient: string,
  message: string,
  options: { subject?: string } = {},
): WrappedDm {
  const recipientPubkey = parsePublicKey(recipient);
  assertNonEmptyString('message', message, MAX_DM_BYTES);
  if (new TextEncoder().encode(message).length > MAX_DM_BYTES) {
    throw new RailsValidationError('message', `must be at most ${MAX_DM_BYTES} bytes`);
  }
  const tags: string[][] = [['p', recipientPubkey]];
  if (options.subject !== undefined) tags.push(['subject', assertNonEmptyString('subject', options.subject, 200)]);
  const rumor = nip59.createRumor(
    { kind: PrivateDirectMessage, content: message, tags, created_at: nowSeconds() },
    sender.secretKey,
  );
  return {
    rumorId: rumor.id,
    toRecipient: nip59.createWrap(nip59.createSeal(rumor, sender.secretKey, recipientPubkey), recipientPubkey),
    toSelf: nip59.createWrap(nip59.createSeal(rumor, sender.secretKey, sender.publicKey), sender.publicKey),
  };
}

/** Decrypts a gift wrap addressed to `recipient`. Throws if it is not for them or was tampered with. */
export function unwrapDm(wrap: Event, recipient: NostrIdentity): DirectMessage {
  if (!wrap || wrap.kind !== GiftWrap) {
    throw new RailsValidationError('wrap', 'is not a kind 1059 gift wrap');
  }
  if (typeof wrap.content !== 'string' || wrap.content.length > MAX_WRAP_CONTENT_CHARS) {
    throw new RailsValidationError('wrap', 'content is missing or too large');
  }
  let rumor: ReturnType<typeof nip59.unwrapEvent>;
  try {
    // Verifies the seal signature and that the rumor author matches the seal signer.
    rumor = nip59.unwrapEvent(wrap, recipient.secretKey);
  } catch {
    throw new RailsValidationError('wrap', 'cannot be decrypted by this identity (not addressed to it, or tampered)');
  }
  if (rumor.kind !== PrivateDirectMessage) {
    throw new RailsValidationError('wrap', `contains kind ${rumor.kind}, not a kind 14 private message`);
  }
  const to = rumor.tags.filter((t) => t[0] === 'p' && isHex64(t[1])).map((t) => t[1] as string);
  const subject = rumor.tags.find((t) => t[0] === 'subject')?.[1];
  return {
    id: getEventHash(rumor),
    wrapId: wrap.id,
    from: rumor.pubkey,
    fromNpub: npubEncode(rumor.pubkey),
    to,
    content: rumor.content,
    createdAt: rumor.created_at,
    ...(subject !== undefined ? { subject } : {}),
  };
}

/** Reads the recipient's preferred DM inbox relays (kind 10050). Empty array if none are published. */
export async function fetchDmRelays(
  pool: RelayPool,
  publicKey: string,
  options: { maxWaitMs?: number } = {},
): Promise<string[]> {
  const pubkey = parsePublicKey(publicKey);
  const events = await pool.query({ kinds: [DirectMessageRelaysList], authors: [pubkey], limit: 3 }, options);
  const latest = newestEvent(events.filter((e) => e.pubkey === pubkey));
  if (!latest) return [];
  const relays = new Set<string>();
  for (const tag of latest.tags) {
    if (tag[0] !== 'relay' || relays.size >= 10) continue;
    try {
      relays.add(assertRelayUrl(tag[1]));
    } catch {
      // ignore malformed or plaintext relay entries
    }
  }
  return [...relays];
}

export interface SendDmOptions {
  subject?: string;
  /** Skip the kind 10050 lookup and publish the recipient's copy here. */
  recipientRelays?: readonly string[];
}

export interface SendDmResult {
  readonly rumorId: string;
  readonly recipientRelays: readonly string[];
  readonly toRecipient: PublishResult;
  readonly toSelf: PublishResult;
}

export async function sendDm(
  pool: RelayPool,
  sender: NostrIdentity,
  recipient: string,
  message: string,
  options: SendDmOptions = {},
): Promise<SendDmResult> {
  const recipientPubkey = parsePublicKey(recipient);
  const wrapped = wrapDm(sender, recipientPubkey, message, { subject: options.subject });
  let recipientRelays = options.recipientRelays?.length ? assertRelayList(options.recipientRelays) : [];
  if (recipientRelays.length === 0) {
    recipientRelays = await fetchDmRelays(pool, recipientPubkey).catch(() => []);
  }
  if (recipientRelays.length === 0) recipientRelays = [...pool.relays];
  const [toRecipient, toSelf] = await Promise.all([
    pool.publish(wrapped.toRecipient, recipientRelays),
    pool.publish(wrapped.toSelf),
  ]);
  return { rumorId: wrapped.rumorId, recipientRelays, toRecipient, toSelf };
}

export interface SubscribeDmOptions {
  /** Only deliver messages written at or after this unix time. Default: everything relays still hold. */
  since?: number;
  relays?: readonly string[];
  onEose?: () => void;
  /** Wraps that fail to decrypt. Usually spam or someone else's mail; safe to ignore. */
  onError?: (error: Error, wrap: Event) => void;
}

export function subscribeDms(
  pool: RelayPool,
  identity: NostrIdentity,
  onMessage: (message: DirectMessage) => void,
  options: SubscribeDmOptions = {},
): Unsubscribe {
  const filter: { kinds: number[]; '#p': string[]; since?: number } = {
    kinds: [GiftWrap],
    '#p': [identity.publicKey],
  };
  // Wrap timestamps are randomized up to two days into the past, so widen the relay filter.
  if (options.since !== undefined) filter.since = Math.max(0, options.since - TWO_DAYS_SECONDS);
  const seen = new Set<string>();
  return pool.subscribe(
    filter,
    {
      onEvent: (wrap) => {
        if (seen.has(wrap.id)) return;
        seen.add(wrap.id);
        let message: DirectMessage;
        try {
          message = unwrapDm(wrap, identity);
        } catch (error) {
          options.onError?.(error instanceof Error ? error : new Error(errorMessage(error)), wrap);
          return;
        }
        if (options.since === undefined || message.createdAt >= options.since) onMessage(message);
      },
      onEose: options.onEose,
    },
    options.relays ?? pool.relays,
  );
}
