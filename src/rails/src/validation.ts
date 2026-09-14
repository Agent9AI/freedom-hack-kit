/**
 * Boundary validation shared by every module. Error messages are written for
 * app developers and never echo secret material back.
 */
export class RailsValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'RailsValidationError';
    this.field = field;
  }
}

const HEX64 = /^[0-9a-f]{64}$/;

export function isHex64(value: unknown): value is string {
  return typeof value === 'string' && HEX64.test(value);
}

export function assertNonEmptyString(field: string, value: unknown, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RailsValidationError(field, 'must be a non-empty string');
  }
  if (value.length > maxLength) {
    throw new RailsValidationError(field, `must be at most ${maxLength} characters`);
  }
  return value;
}

export function assertPositiveInteger(field: string, value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new RailsValidationError(field, 'must be a positive whole number');
  }
  if (value > max) {
    throw new RailsValidationError(field, `must be at most ${max}`);
  }
  return value;
}

/** Whole sats, strictly positive, small enough that the millisat value stays a safe integer. */
export function assertSats(field: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new RailsValidationError(field, 'must be a positive whole number of sats');
  }
  if (!Number.isSafeInteger(value * 1000)) {
    throw new RailsValidationError(field, 'is too large');
  }
  return value;
}

export function assertTimeoutMs(field: string, value: unknown): number {
  return assertPositiveInteger(field, value, 600_000);
}

function isPlaintextAllowed(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.onion');
}

/** Accepts wss:// everywhere, ws:// only for localhost and .onion. Returns a normalized URL. */
export function assertRelayUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 512) {
    throw new RailsValidationError('relay', 'must be a relay URL string');
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new RailsValidationError('relay', `not a valid URL: ${value}`);
  }
  const secure = url.protocol === 'wss:';
  const plainOk = url.protocol === 'ws:' && isPlaintextAllowed(url.hostname);
  if (!secure && !plainOk) {
    throw new RailsValidationError('relay', `must use wss:// (ws:// only for localhost or .onion): ${value}`);
  }
  if (url.username || url.password) {
    throw new RailsValidationError('relay', 'must not contain credentials');
  }
  if (url.pathname === '/' && !url.search && !url.hash) {
    return `${url.protocol}//${url.host}`;
  }
  return url.href;
}

export function assertRelayList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RailsValidationError('relays', 'must be a non-empty array of relay URLs');
  }
  if (value.length > 30) {
    throw new RailsValidationError('relays', 'must list at most 30 relays');
  }
  return [...new Set(value.map(assertRelayUrl))];
}
