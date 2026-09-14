import { finalizeEvent, verifyEvent, type Event, type EventTemplate, type VerifiedEvent } from 'nostr-tools/pure';
import * as nip57 from 'nostr-tools/nip57';
import { parsePublicKey, type NostrIdentity } from '../nostr/keys.js';
import { RailsValidationError, assertRelayList, assertSats } from '../validation.js';
import { isRecord } from '../util.js';
import { requestInvoice, resolveLightningAddress, type FetchOptions, type LnurlInvoice } from './lnurl.js';

export interface ZapRequestInput {
  /** npub or hex of the person being tipped. */
  recipient: string;
  amountSats: number;
  /** Relays where the recipient's wallet should publish the zap receipt (kind 9735). */
  relays: readonly string[];
  comment?: string;
  /** Zap a specific note instead of the profile. Must be written by `recipient`. */
  event?: Event;
  /** The recipient's bech32 lnurl1... if you have it. Optional per NIP-57. */
  lnurl?: string;
}

/** Signed NIP-57 zap request (kind 9734). It is sent to the LNURL server, never published to relays. */
export function buildZapRequest(sender: NostrIdentity, input: ZapRequestInput): VerifiedEvent {
  if (!isRecord(input)) throw new RailsValidationError('input', 'must be an object');
  const recipient = parsePublicKey(input.recipient);
  const msats = assertSats('amountSats', input.amountSats) * 1000;
  const relays = assertRelayList(input.relays);
  if (input.comment !== undefined && (typeof input.comment !== 'string' || input.comment.length > 2000)) {
    throw new RailsValidationError('comment', 'must be a string of at most 2000 characters');
  }
  let template: EventTemplate;
  if (input.event !== undefined) {
    if (!verifyEvent(input.event)) throw new RailsValidationError('event', 'is not a validly signed Nostr event');
    if (input.event.pubkey !== recipient) throw new RailsValidationError('event', 'was not written by the zap recipient');
    template = nip57.makeZapRequest({ event: input.event, amount: msats, comment: input.comment, relays });
  } else {
    template = nip57.makeZapRequest({ pubkey: recipient, amount: msats, comment: input.comment, relays });
  }
  if (input.lnurl !== undefined) {
    if (typeof input.lnurl !== 'string' || !/^lnurl1[02-9ac-hj-np-z]+$/i.test(input.lnurl)) {
      throw new RailsValidationError('lnurl', 'must be a bech32 lnurl1... string');
    }
    template.tags.push(['lnurl', input.lnurl.toLowerCase()]);
  }
  return finalizeEvent(template, sender.secretKey);
}

export interface ZapInvoiceInput extends ZapRequestInput {
  /** The recipient's Lightning address, usually `fetchProfile(...).lud16`. */
  lightningAddress: string;
}

/** Builds the zap request, resolves the address, and returns an invoice to pay (e.g. with NwcClient.payInvoice). */
export async function requestZapInvoice(
  sender: NostrIdentity,
  input: ZapInvoiceInput,
  options: FetchOptions = {},
): Promise<LnurlInvoice & { zapRequest: VerifiedEvent }> {
  const zapRequest = buildZapRequest(sender, input);
  const params = await resolveLightningAddress(input.lightningAddress, options);
  const invoice = await requestInvoice(params, input.amountSats, { ...options, zapRequest });
  return { ...invoice, zapRequest };
}
