import { finalizeEvent, getPublicKey, type Event } from 'nostr-tools/pure';
import * as nip04 from 'nostr-tools/nip04';
import * as nip44 from 'nostr-tools/nip44';
import { NWCWalletInfo, NWCWalletRequest, NWCWalletResponse } from 'nostr-tools/kinds';
import { hexToBytes } from 'nostr-tools/utils';
import { RelayPool, type PoolLike, type Unsubscribe } from '../nostr/relays.js';
import {
  RailsValidationError,
  assertNonEmptyString,
  assertPositiveInteger,
  assertRelayList,
  assertSats,
  assertTimeoutMs,
  isHex64,
} from '../validation.js';
import { isRecord, newestEvent, nowSeconds } from '../util.js';
import { bolt11AmountMsats, normalizeBolt11 } from './bolt11.js';
import { parseLightningAddress } from './lnurl.js';

/*
 * Nostr Wallet Connect (NIP-47) client. The user creates a connection with a
 * spending budget inside their own wallet and pastes the
 * nostr+walletconnect:// string into the app. The app never holds a seed
 * phrase, and the user can revoke the connection from the wallet at any time.
 */

export type NwcEncryption = 'nip44_v2' | 'nip04';

const ENCRYPTIONS: readonly NwcEncryption[] = ['nip44_v2', 'nip04'];
const SCHEMES = ['nostr+walletconnect:', 'nostrwalletconnect:'];
const EOSE_FALLBACK_MS = 1500;
const MAX_RESPONSE_CHARS = 200_000;

/*
 * LOUD WARNING. NIP-04 is used only when the wallet advertises nothing better
 * (NIP-47 says a missing encryption tag means NIP-04 only). NIP-04 is
 * unauthenticated AES-CBC without padding: relays learn exact message sizes,
 * and a malicious relay can alter ciphertext without the decryptor noticing
 * (the outer event signature still proves who sent it). Prefer wallets that
 * advertise nip44_v2.
 */
const NIP04_WARNING =
  'WARNING: this wallet only supports NIP-04 encryption. Requests are still encrypted, but NIP-04 has no ' +
  'padding or authentication, so relays learn exact message sizes. Use a wallet that supports nip44_v2 if you can.';

export interface NwcConnection {
  readonly walletPubkey: string;
  readonly clientPubkey: string;
  readonly relays: readonly string[];
  readonly lud16?: string;
  /** Non-enumerable. Anyone holding it can spend up to the budget set in the wallet. */
  readonly secret: Uint8Array;
}

export class NwcError extends Error {
  /** NIP-47 codes (INSUFFICIENT_BALANCE, QUOTA_EXCEEDED, ...) or TIMEOUT, PUBLISH_FAILED, NO_INFO, BAD_RESPONSE. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'NwcError';
    this.code = code;
  }
}

/** Parses and validates a nostr+walletconnect:// URI. Error messages never include the secret. */
export function parseNwcUri(uri: string): NwcConnection {
  if (typeof uri !== 'string' || uri.length > 4096) {
    throw new RailsValidationError('nwcUri', 'must be a nostr+walletconnect:// string');
  }
  let url: URL;
  try {
    url = new URL(uri.trim());
  } catch {
    throw new RailsValidationError('nwcUri', 'is not a valid nostr+walletconnect:// URI');
  }
  if (!SCHEMES.includes(url.protocol)) {
    throw new RailsValidationError('nwcUri', 'must start with nostr+walletconnect://');
  }
  const walletPubkey = (url.host || url.pathname.replace(/^\/+/, '')).toLowerCase();
  if (!isHex64(walletPubkey)) {
    throw new RailsValidationError('nwcUri', 'wallet public key must be 64 hex characters');
  }
  const relayParams = url.searchParams.getAll('relay');
  if (relayParams.length === 0) {
    throw new RailsValidationError('nwcUri', 'must include at least one relay= parameter');
  }
  const relays = assertRelayList(relayParams);
  const secretHex = (url.searchParams.get('secret') ?? '').toLowerCase();
  if (!isHex64(secretHex)) {
    throw new RailsValidationError('nwcUri', 'secret must be 64 hex characters');
  }
  const secret = hexToBytes(secretHex);
  let clientPubkey: string;
  try {
    clientPubkey = getPublicKey(secret);
  } catch {
    throw new RailsValidationError('nwcUri', 'secret is not a valid key');
  }
  let lud16: string | undefined;
  const lud16Param = url.searchParams.get('lud16');
  if (lud16Param) {
    try {
      const address = parseLightningAddress(lud16Param);
      lud16 = `${address.name}@${address.domain}`;
    } catch {
      lud16 = undefined;
    }
  }
  const connection = { walletPubkey, clientPubkey, relays, ...(lud16 ? { lud16 } : {}) };
  Object.defineProperty(connection, 'secret', { value: secret, enumerable: false });
  return Object.freeze(connection) as unknown as NwcConnection;
}

export interface NwcClientOptions {
  /** Per request. Payments can take a while to route; default 30000. */
  timeoutMs?: number;
  /** Skip negotiation and force a scheme. */
  encryption?: NwcEncryption;
  pool?: PoolLike;
  webSocketImplementation?: unknown;
  /** Receives the NIP-04 warning. Defaults to console.warn. */
  onWarning?: (message: string) => void;
}

export interface NwcInfo {
  readonly methods: readonly string[];
  readonly encryptions: readonly NwcEncryption[];
}

export interface NwcInvoice {
  readonly invoice: string;
  readonly amountSats: number;
  readonly paymentHash?: string;
  readonly expiresAt?: number;
}

export interface NwcPayment {
  readonly preimage: string;
  readonly feesPaidSats?: number;
}

export interface NwcBalance {
  readonly balanceSats: number;
  readonly balanceMsats: number;
}

export class NwcClient {
  readonly connection: NwcConnection;
  private readonly relayPool: RelayPool;
  private readonly timeoutMs: number;
  private readonly warn: (message: string) => void;
  private encryption: NwcEncryption | undefined;
  private conversationKey: Uint8Array | undefined;

  constructor(connection: string | NwcConnection, options: NwcClientOptions = {}) {
    this.connection = typeof connection === 'string' ? parseNwcUri(connection) : connection;
    const { walletPubkey, secret } = this.connection;
    if (!isHex64(walletPubkey) || !(secret instanceof Uint8Array) || secret.length !== 32) {
      throw new RailsValidationError('connection', 'must be a nostr+walletconnect:// URI or come from parseNwcUri');
    }
    if (options.encryption !== undefined && !ENCRYPTIONS.includes(options.encryption)) {
      throw new RailsValidationError('encryption', "must be 'nip44_v2' or 'nip04'");
    }
    this.timeoutMs = assertTimeoutMs('timeoutMs', options.timeoutMs ?? 30_000);
    this.warn = options.onWarning ?? ((message) => console.warn(`[rails/nwc] ${message}`));
    this.relayPool = new RelayPool({
      relays: this.connection.relays,
      pool: options.pool,
      webSocketImplementation: options.webSocketImplementation,
    });
    if (options.encryption) this.useEncryption(options.encryption);
  }

  /** Reads the wallet's kind 13194 capabilities event. */
  async getInfo(): Promise<NwcInfo> {
    const { walletPubkey } = this.connection;
    const events = await this.relayPool.query(
      { kinds: [NWCWalletInfo], authors: [walletPubkey], limit: 1 },
      { maxWaitMs: Math.min(this.timeoutMs, 10_000) },
    );
    const info = newestEvent(events.filter((e) => e.pubkey === walletPubkey));
    if (!info) {
      throw new NwcError('NO_INFO', 'Wallet has not published its capabilities (kind 13194) on the connection relays');
    }
    const tag = info.tags.find((t) => t[0] === 'encryption')?.[1];
    const encryptions = tag
      ? ENCRYPTIONS.filter((scheme) => tag.split(/\s+/).includes(scheme))
      : (['nip04'] as NwcEncryption[]);
    return { methods: info.content.trim().split(/\s+/).filter(Boolean), encryptions };
  }

  async getBalance(): Promise<NwcBalance> {
    const result = await this.request('get_balance', {});
    const msats = result.balance;
    if (typeof msats !== 'number' || !Number.isFinite(msats) || msats < 0) {
      throw new NwcError('BAD_RESPONSE', 'Wallet returned an invalid balance');
    }
    return { balanceMsats: msats, balanceSats: Math.floor(msats / 1000) };
  }

  /** Creates an invoice to receive `amountSats` (e.g. a tip request shown as a QR code). */
  async makeInvoice(input: { amountSats: number; description?: string; expirySeconds?: number }): Promise<NwcInvoice> {
    if (!isRecord(input)) throw new RailsValidationError('input', 'must be an object');
    const amountSats = assertSats('amountSats', input.amountSats);
    const params: Record<string, unknown> = { amount: amountSats * 1000 };
    if (input.description !== undefined) params.description = assertNonEmptyString('description', input.description, 639);
    if (input.expirySeconds !== undefined) params.expiry = assertPositiveInteger('expirySeconds', input.expirySeconds, 604_800);
    const result = await this.request('make_invoice', params);
    let invoice: string;
    try {
      invoice = normalizeBolt11(String(result.invoice ?? ''));
    } catch {
      throw new NwcError('BAD_RESPONSE', 'Wallet did not return a Lightning invoice');
    }
    return {
      invoice,
      amountSats,
      ...(typeof result.payment_hash === 'string' ? { paymentHash: result.payment_hash } : {}),
      ...(typeof result.expires_at === 'number' ? { expiresAt: result.expires_at } : {}),
    };
  }

  /** Pays a BOLT11 invoice. `amountSats` is only for zero-amount invoices, and must match otherwise. */
  async payInvoice(invoice: string, options: { amountSats?: number } = {}): Promise<NwcPayment> {
    const bolt11 = normalizeBolt11(invoice);
    const encodedMsats = bolt11AmountMsats(bolt11);
    const params: Record<string, unknown> = { invoice: bolt11 };
    if (options.amountSats !== undefined) {
      const msats = assertSats('amountSats', options.amountSats) * 1000;
      if (encodedMsats !== null && encodedMsats !== msats) {
        throw new RailsValidationError('amountSats', 'does not match the amount inside the invoice');
      }
      if (encodedMsats === null) params.amount = msats;
    } else if (encodedMsats === null) {
      throw new RailsValidationError('amountSats', 'this invoice has no amount, so amountSats is required');
    }
    const result = await this.request('pay_invoice', params);
    if (typeof result.preimage !== 'string') {
      throw new NwcError('BAD_RESPONSE', 'Wallet did not return a payment preimage');
    }
    const fees = result.fees_paid;
    return {
      preimage: result.preimage,
      ...(typeof fees === 'number' && fees >= 0 ? { feesPaidSats: Math.ceil(fees / 1000) } : {}),
    };
  }

  close(): void {
    this.relayPool.close();
  }

  private useEncryption(scheme: NwcEncryption): NwcEncryption {
    if (scheme === 'nip04' && this.encryption !== 'nip04') this.warn(NIP04_WARNING);
    this.encryption = scheme;
    return scheme;
  }

  private async negotiateEncryption(): Promise<NwcEncryption> {
    if (this.encryption) return this.encryption;
    const { encryptions } = await this.getInfo();
    const preferred = ENCRYPTIONS.find((scheme) => encryptions.includes(scheme));
    if (!preferred) {
      throw new NwcError('UNSUPPORTED_ENCRYPTION', 'Wallet advertises no encryption scheme this client supports');
    }
    return this.useEncryption(preferred);
  }

  private getConversationKey(): Uint8Array {
    this.conversationKey ??= nip44.v2.utils.getConversationKey(this.connection.secret, this.connection.walletPubkey);
    return this.conversationKey;
  }

  private encrypt(plaintext: string, scheme: NwcEncryption): string {
    if (scheme === 'nip04') return nip04.encrypt(this.connection.secret, this.connection.walletPubkey, plaintext);
    return nip44.v2.encrypt(plaintext, this.getConversationKey());
  }

  private decrypt(payload: string, scheme: NwcEncryption): string {
    if (scheme === 'nip04') return nip04.decrypt(this.connection.secret, this.connection.walletPubkey, payload);
    return nip44.v2.decrypt(payload, this.getConversationKey());
  }

  private parseResponse(method: string, scheme: NwcEncryption, event: Event): Record<string, unknown> {
    if (event.content.length > MAX_RESPONSE_CHARS) throw new NwcError('BAD_RESPONSE', 'Wallet response is too large');
    let body: unknown;
    try {
      body = JSON.parse(this.decrypt(event.content, scheme));
    } catch {
      throw new NwcError('BAD_RESPONSE', 'Could not decrypt or parse the wallet response');
    }
    if (!isRecord(body)) throw new NwcError('BAD_RESPONSE', 'Wallet response is not an object');
    if (isRecord(body.error)) {
      const code = typeof body.error.code === 'string' ? body.error.code : 'OTHER';
      const message = typeof body.error.message === 'string' ? body.error.message.slice(0, 300) : 'Wallet returned an error';
      throw new NwcError(code, message);
    }
    if (body.result_type !== method || !isRecord(body.result)) {
      throw new NwcError('BAD_RESPONSE', `Wallet answered ${String(body.result_type)} to a ${method} request`);
    }
    return body.result;
  }

  private async request(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const scheme = await this.negotiateEncryption();
    const { walletPubkey, secret } = this.connection;
    const request = finalizeEvent(
      {
        kind: NWCWalletRequest,
        created_at: nowSeconds(),
        content: this.encrypt(JSON.stringify({ method, params }), scheme),
        tags: [['p', walletPubkey], ['encryption', scheme]],
      },
      secret,
    );

    return new Promise((resolve, reject) => {
      let settled = false;
      let published = false;
      let subscription: Unsubscribe | undefined;
      const finish = (outcome: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(eoseFallback);
        subscription?.close();
        outcome();
      };
      // Responses are ephemeral and never stored, so subscribe first and publish once the REQ is live.
      const publish = (): void => {
        if (published || settled) return;
        published = true;
        this.relayPool.publish(request).then(
          (result) => {
            if (result.okCount > 0) return;
            const reasons = result.acks.map((ack) => ack.message).join('; ');
            finish(() => reject(new NwcError('PUBLISH_FAILED', `No relay accepted the ${method} request (${reasons})`)));
          },
          (error: unknown) => finish(() => reject(error)),
        );
      };
      const timer = setTimeout(
        () => finish(() => reject(new NwcError('TIMEOUT', `Wallet did not answer ${method} within ${this.timeoutMs} ms`))),
        this.timeoutMs,
      );
      const eoseFallback = setTimeout(publish, EOSE_FALLBACK_MS);
      subscription = this.relayPool.subscribe(
        { kinds: [NWCWalletResponse], authors: [walletPubkey], '#e': [request.id] },
        {
          onEvent: (event) => {
            if (event.pubkey !== walletPubkey) return;
            let result: Record<string, unknown>;
            try {
              result = this.parseResponse(method, scheme, event);
            } catch (error) {
              finish(() => reject(error));
              return;
            }
            finish(() => resolve(result));
          },
          onEose: publish,
        },
      );
      if (settled) subscription.close();
    });
  }
}
