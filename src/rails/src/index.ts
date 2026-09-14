export { RailsValidationError } from './validation.js';

export {
  createIdentity,
  importIdentity,
  exportNsec,
  parsePublicKey,
  toNpub,
  redact,
  exportEncryptedKey,
  importEncryptedKey,
  type NostrIdentity,
} from './nostr/keys.js';

export {
  DEFAULT_RELAYS,
  RelayPool,
  aggregateAcks,
  type PoolLike,
  type RelayAck,
  type PublishResult,
  type ConnectResult,
  type RelayPoolOptions,
  type SubscriptionHandlers,
  type Unsubscribe,
} from './nostr/relays.js';

export {
  MAX_NOTE_LENGTH,
  buildNote,
  publishNote,
  feedFilter,
  subscribeFeed,
  fetchFeed,
  buildProfile,
  fetchProfile,
  type NoteInput,
  type FeedQuery,
  type NostrProfile,
  type FetchedProfile,
} from './nostr/notes.js';

export {
  MAX_DM_BYTES,
  wrapDm,
  unwrapDm,
  fetchDmRelays,
  sendDm,
  subscribeDms,
  type DirectMessage,
  type WrappedDm,
  type SendDmOptions,
  type SendDmResult,
  type SubscribeDmOptions,
} from './nostr/dm.js';

export {
  NwcClient,
  NwcError,
  parseNwcUri,
  type NwcConnection,
  type NwcClientOptions,
  type NwcEncryption,
  type NwcInfo,
  type NwcInvoice,
  type NwcPayment,
  type NwcBalance,
} from './bitcoin/nwc.js';

export {
  LnurlError,
  parseLightningAddress,
  lightningAddressUrl,
  resolveLightningAddress,
  parsePayParams,
  requestInvoice,
  lightningAddressToInvoice,
  type LightningAddress,
  type LnurlPayParams,
  type LnurlErrorCode,
  type FetchOptions,
  type InvoiceRequestOptions,
  type LnurlInvoice,
} from './bitcoin/lnurl.js';

export { buildZapRequest, requestZapInvoice, type ZapRequestInput, type ZapInvoiceInput } from './bitcoin/zap.js';

export { normalizeBolt11, bolt11AmountMsats } from './bitcoin/bolt11.js';

export type { Event, VerifiedEvent } from 'nostr-tools/pure';
export type { Filter } from 'nostr-tools/filter';
