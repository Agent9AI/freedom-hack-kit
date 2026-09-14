import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import * as nip49 from 'nostr-tools/nip49';
import { hexToBytes } from 'nostr-tools/utils';
import { RailsValidationError, assertNonEmptyString, assertPositiveInteger, isHex64 } from '../validation.js';

/**
 * A Nostr identity. `secretKey` is non-enumerable, so JSON.stringify and
 * Node's console.log / util.inspect never print it. Browser devtools can still
 * show it if someone expands the object by hand, so never log identities anyway.
 */
export interface NostrIdentity {
  readonly publicKey: string;
  readonly npub: string;
  readonly secretKey: Uint8Array;
}

const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');

function makeIdentity(secretKey: Uint8Array): NostrIdentity {
  const publicKey = getPublicKey(secretKey);
  const npub = nip19.npubEncode(publicKey);
  const identity = { publicKey, npub };
  Object.defineProperty(identity, 'secretKey', { value: secretKey, enumerable: false });
  Object.defineProperty(identity, inspectSymbol, {
    value: () => `NostrIdentity { npub: '${npub}', secretKey: [redacted] }`,
    enumerable: false,
  });
  return Object.freeze(identity) as NostrIdentity;
}

export function createIdentity(): NostrIdentity {
  return makeIdentity(generateSecretKey());
}

/** Import from an nsec1... string or 64 hex characters. */
export function importIdentity(input: string): NostrIdentity {
  if (typeof input !== 'string') {
    throw new RailsValidationError('secretKey', 'must be an nsec or 64-character hex string');
  }
  const value = input.trim();
  let bytes: Uint8Array;
  if (value.startsWith('npub1')) {
    throw new RailsValidationError('secretKey', 'this is a public key (npub), not a secret key (nsec)');
  } else if (value.startsWith('nsec1')) {
    let decoded: nip19.DecodedResult;
    try {
      decoded = nip19.decode(value);
    } catch {
      throw new RailsValidationError('secretKey', 'invalid nsec (checksum or length is wrong)');
    }
    if (decoded.type !== 'nsec') {
      throw new RailsValidationError('secretKey', 'invalid nsec');
    }
    bytes = decoded.data;
  } else if (isHex64(value.toLowerCase())) {
    bytes = hexToBytes(value.toLowerCase());
  } else {
    throw new RailsValidationError('secretKey', 'must be an nsec or 64-character hex string');
  }
  try {
    return makeIdentity(bytes);
  } catch {
    throw new RailsValidationError('secretKey', 'is not a valid secp256k1 secret key');
  }
}

export function exportNsec(identity: NostrIdentity): string {
  return nip19.nsecEncode(identity.secretKey);
}

/** Accepts npub1..., nprofile1... or 64 hex characters. Returns lowercase hex. */
export function parsePublicKey(input: string): string {
  if (typeof input !== 'string') {
    throw new RailsValidationError('publicKey', 'must be an npub or 64-character hex string');
  }
  const value = input.trim();
  if (value.startsWith('nsec1')) {
    throw new RailsValidationError('publicKey', 'this is a SECRET key (nsec). Never share it. Use the npub instead');
  }
  if (value.startsWith('npub1') || value.startsWith('nprofile1')) {
    try {
      const decoded = nip19.decode(value);
      if (decoded.type === 'npub') return decoded.data;
      if (decoded.type === 'nprofile') return decoded.data.pubkey;
    } catch {
      // fall through to the shared error below
    }
    throw new RailsValidationError('publicKey', 'invalid npub (checksum or length is wrong)');
  }
  const hex = value.toLowerCase();
  if (isHex64(hex)) return hex;
  throw new RailsValidationError('publicKey', 'must be an npub or 64-character hex string');
}

export function toNpub(publicKey: string): string {
  return nip19.npubEncode(parsePublicKey(publicKey));
}

const NSEC_PATTERN = /nsec1[02-9ac-hj-np-z]{20,}/gi;
const NCRYPTSEC_PATTERN = /ncryptsec1[02-9ac-hj-np-z]{20,}/gi;
const NWC_SECRET_PATTERN = /([?&]secret=)[^&\s"']+/gi;

/**
 * Makes a value safe to log. Give it a secret (bytes, nsec, 64-char hex) and
 * you get a placeholder. Give it any other text, like an error message or a
 * connection URI, and embedded nsec, ncryptsec and NWC `secret=` values are masked.
 */
export function redact(value: unknown): string {
  if (value instanceof Uint8Array) return '[redacted secret key]';
  if (typeof value !== 'string') return '[redacted]';
  if (isHex64(value.trim().toLowerCase())) return '[redacted hex key]';
  return value
    .replace(NCRYPTSEC_PATTERN, 'ncryptsec1[redacted]')
    .replace(NSEC_PATTERN, 'nsec1[redacted]')
    .replace(NWC_SECRET_PATTERN, '$1[redacted]');
}

/**
 * Password-encrypted backup (NIP-49, ncryptsec1...). Safe to store in a notes
 * app or print on paper; useless without the password. `logn` sets scrypt
 * cost: 16 is the floor, raise it on fast devices.
 */
export function exportEncryptedKey(identity: NostrIdentity, password: string, logn = 16): string {
  assertNonEmptyString('password', password, 1024);
  if (password.length < 8) {
    throw new RailsValidationError('password', 'must be at least 8 characters');
  }
  if (assertPositiveInteger('logn', logn, 22) < 16) {
    throw new RailsValidationError('logn', 'must be at least 16');
  }
  return nip49.encrypt(identity.secretKey, password, logn);
}

export function importEncryptedKey(ncryptsec: string, password: string): NostrIdentity {
  if (typeof ncryptsec !== 'string' || !ncryptsec.trim().startsWith('ncryptsec1')) {
    throw new RailsValidationError('ncryptsec', 'must start with ncryptsec1');
  }
  assertNonEmptyString('password', password, 1024);
  try {
    return makeIdentity(nip49.decrypt(ncryptsec.trim(), password));
  } catch {
    throw new RailsValidationError('ncryptsec', 'wrong password or damaged backup');
  }
}
