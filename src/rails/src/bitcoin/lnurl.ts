import { verifyEvent, type Event } from 'nostr-tools/pure';
import { ZapRequest } from 'nostr-tools/kinds';
import { RailsValidationError, assertNonEmptyString, assertSats, assertTimeoutMs, isHex64 } from '../validation.js';
import { errorMessage, isRecord } from '../util.js';
import { bolt11AmountMsats, normalizeBolt11 } from './bolt11.js';

export interface LightningAddress {
  readonly name: string;
  readonly domain: string;
}

const NAME = /^[a-z0-9\-_.+]+$/;
const DOMAIN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/;

/** Validates `name@domain.tld` (LUD-16). IP addresses and localhost are rejected. */
export function parseLightningAddress(input: string): LightningAddress {
  if (typeof input !== 'string') {
    throw new RailsValidationError('lightningAddress', 'must look like name@domain.com');
  }
  const parts = input.trim().toLowerCase().replace(/^lightning:/, '').split('@');
  if (parts.length !== 2) {
    throw new RailsValidationError('lightningAddress', 'must look like name@domain.com');
  }
  const [name, domain] = parts as [string, string];
  if (!name || name.length > 64 || !NAME.test(name) || name.startsWith('.') || name.includes('..')) {
    throw new RailsValidationError('lightningAddress', 'has an invalid name part');
  }
  if (!DOMAIN.test(domain)) {
    throw new RailsValidationError('lightningAddress', 'has an invalid domain');
  }
  return { name, domain };
}

export function lightningAddressUrl(address: string | LightningAddress): string {
  const { name, domain } = typeof address === 'string' ? parseLightningAddress(address) : address;
  const protocol = domain.endsWith('.onion') ? 'http' : 'https';
  return `${protocol}://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`;
}

export type LnurlErrorCode =
  | 'HTTP'
  | 'TIMEOUT'
  | 'BAD_RESPONSE'
  | 'SERVICE_ERROR'
  | 'AMOUNT_TOO_LOW'
  | 'AMOUNT_TOO_HIGH'
  | 'INVOICE_MISMATCH'
  | 'ZAPS_UNSUPPORTED';

export class LnurlError extends Error {
  readonly code: LnurlErrorCode;

  constructor(code: LnurlErrorCode, message: string) {
    super(message);
    this.name = 'LnurlError';
    this.code = code;
  }
}

export interface LnurlPayParams {
  readonly callback: string;
  readonly minSendableMsats: number;
  readonly maxSendableMsats: number;
  /** Smallest whole-sat amount accepted (rounded up). */
  readonly minSats: number;
  /** Largest whole-sat amount accepted (rounded down). */
  readonly maxSats: number;
  readonly metadata: string;
  readonly description?: string;
  readonly commentAllowed: number;
  readonly allowsNostr: boolean;
  readonly nostrPubkey?: string;
}

export interface FetchOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

async function getJson(url: string, options: FetchOptions): Promise<Record<string, unknown>> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new LnurlError('HTTP', 'No fetch implementation available');
  const timeoutMs = assertTimeoutMs('timeoutMs', options.timeoutMs ?? 10_000);
  const host = new URL(url).host;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let status: number;
  let ok: boolean;
  let text: string;
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    status = response.status;
    ok = response.ok;
    text = await response.text();
  } catch (error) {
    if (controller.signal.aborted) throw new LnurlError('TIMEOUT', `No answer from ${host} within ${timeoutMs} ms`);
    throw new LnurlError('HTTP', `Could not reach ${host}: ${errorMessage(error)}`);
  } finally {
    clearTimeout(timer);
  }
  if (text.length > 100_000) throw new LnurlError('BAD_RESPONSE', `${host} sent an oversized response`);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new LnurlError(ok ? 'BAD_RESPONSE' : 'HTTP', ok ? `${host} did not return JSON` : `${host} answered HTTP ${status}`);
  }
  if (isRecord(body) && body.status === 'ERROR') {
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 300) : 'unknown error';
    throw new LnurlError('SERVICE_ERROR', `${host}: ${reason}`);
  }
  if (!ok) throw new LnurlError('HTTP', `${host} answered HTTP ${status}`);
  if (!isRecord(body)) throw new LnurlError('BAD_RESPONSE', `${host} returned unexpected JSON`);
  return body;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function describe(metadata: string): string | undefined {
  try {
    const entries: unknown = JSON.parse(metadata);
    if (!Array.isArray(entries)) return undefined;
    const text = entries.find((e): e is [string, string] => Array.isArray(e) && e[0] === 'text/plain');
    return typeof text?.[1] === 'string' ? text[1] : undefined;
  } catch {
    return undefined;
  }
}

/** Validates a LUD-06 payRequest response. */
export function parsePayParams(body: Record<string, unknown>): LnurlPayParams {
  if (body.tag !== 'payRequest') throw new LnurlError('BAD_RESPONSE', 'Not an LNURL-pay endpoint (tag is not payRequest)');
  let callback: URL;
  try {
    callback = new URL(String(body.callback));
  } catch {
    throw new LnurlError('BAD_RESPONSE', 'LNURL-pay callback is not a valid URL');
  }
  const onionHttp = callback.protocol === 'http:' && callback.hostname.endsWith('.onion');
  if (callback.protocol !== 'https:' && !onionHttp) {
    throw new LnurlError('BAD_RESPONSE', 'LNURL-pay callback must use https');
  }
  const { minSendable, maxSendable } = body;
  if (!isPositiveSafeInteger(minSendable) || !isPositiveSafeInteger(maxSendable) || minSendable > maxSendable) {
    throw new LnurlError('BAD_RESPONSE', 'LNURL-pay minSendable/maxSendable are missing or inconsistent');
  }
  const metadata = typeof body.metadata === 'string' ? body.metadata : '[]';
  const commentAllowed =
    typeof body.commentAllowed === 'number' && Number.isInteger(body.commentAllowed) && body.commentAllowed > 0
      ? Math.min(body.commentAllowed, 2000)
      : 0;
  const nostrPubkey = isHex64(body.nostrPubkey) ? body.nostrPubkey : undefined;
  const description = describe(metadata);
  return {
    callback: callback.href,
    minSendableMsats: minSendable,
    maxSendableMsats: maxSendable,
    minSats: Math.ceil(minSendable / 1000),
    maxSats: Math.floor(maxSendable / 1000),
    metadata,
    ...(description !== undefined ? { description } : {}),
    commentAllowed,
    allowsNostr: body.allowsNostr === true && nostrPubkey !== undefined,
    ...(nostrPubkey !== undefined ? { nostrPubkey } : {}),
  };
}

export async function resolveLightningAddress(address: string, options: FetchOptions = {}): Promise<LnurlPayParams> {
  const url = lightningAddressUrl(parseLightningAddress(address));
  return parsePayParams(await getJson(url, options));
}

export interface InvoiceRequestOptions extends FetchOptions {
  comment?: string;
  /** Signed kind 9734 zap request (see buildZapRequest). */
  zapRequest?: Event;
}

export interface LnurlInvoice {
  readonly invoice: string;
  readonly amountSats: number;
  readonly successAction?: Record<string, unknown>;
}

/**
 * Asks the LNURL-pay service for an invoice. Enforces the service's min/max
 * before any network call, and refuses an invoice whose amount differs from
 * what was requested.
 */
export async function requestInvoice(
  params: LnurlPayParams,
  amountSats: number,
  options: InvoiceRequestOptions = {},
): Promise<LnurlInvoice> {
  const sats = assertSats('amountSats', amountSats);
  const msats = sats * 1000;
  if (msats < params.minSendableMsats) throw new LnurlError('AMOUNT_TOO_LOW', `Minimum is ${params.minSats} sats`);
  if (msats > params.maxSendableMsats) throw new LnurlError('AMOUNT_TOO_HIGH', `Maximum is ${params.maxSats} sats`);
  const url = new URL(params.callback);
  url.searchParams.set('amount', String(msats));
  if (options.comment !== undefined) {
    const comment = assertNonEmptyString('comment', options.comment, 2000);
    if (params.commentAllowed === 0) throw new RailsValidationError('comment', 'this recipient does not accept comments');
    if (comment.length > params.commentAllowed) {
      throw new RailsValidationError('comment', `must be at most ${params.commentAllowed} characters`);
    }
    url.searchParams.set('comment', comment);
  }
  if (options.zapRequest !== undefined) {
    if (!params.allowsNostr) throw new LnurlError('ZAPS_UNSUPPORTED', 'This Lightning address does not accept Nostr zaps');
    const zap = options.zapRequest;
    if (zap.kind !== ZapRequest || !verifyEvent(zap)) {
      throw new RailsValidationError('zapRequest', 'must be a signed kind 9734 event');
    }
    const amountTag = zap.tags.find((t) => t[0] === 'amount')?.[1];
    if (amountTag !== undefined && amountTag !== String(msats)) {
      throw new RailsValidationError('zapRequest', 'amount tag does not match amountSats');
    }
    url.searchParams.set('nostr', JSON.stringify(zap));
  }
  const body = await getJson(url.href, options);
  let invoice: string;
  try {
    invoice = normalizeBolt11(String(body.pr ?? ''));
  } catch {
    throw new LnurlError('BAD_RESPONSE', 'Service did not return a Lightning invoice');
  }
  const invoiceMsats = bolt11AmountMsats(invoice);
  if (invoiceMsats !== msats) {
    throw new LnurlError(
      'INVOICE_MISMATCH',
      `Invoice is for ${invoiceMsats ?? 'any'} msats but ${msats} msats were requested. Do not pay it`,
    );
  }
  return {
    invoice,
    amountSats: sats,
    ...(isRecord(body.successAction) ? { successAction: body.successAction } : {}),
  };
}

/** One call: `name@domain` plus an amount in, BOLT11 invoice out. */
export async function lightningAddressToInvoice(
  address: string,
  amountSats: number,
  options: InvoiceRequestOptions = {},
): Promise<LnurlInvoice & { params: LnurlPayParams }> {
  assertSats('amountSats', amountSats);
  const params = await resolveLightningAddress(address, options);
  return { ...(await requestInvoice(params, amountSats, options)), params };
}
