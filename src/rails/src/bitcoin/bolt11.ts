import { RailsValidationError } from '../validation.js';

// Network prefix, optional amount, separator "1", bech32 data (the charset has no "1").
const BOLT11 = /^ln(?:bcrt|bc|tbs|tb|sb)(?:\d+[munp]?)?1[02-9ac-hj-np-z]{50,}$/;
const HRP_AMOUNT = /^ln(?:bcrt|bc|tbs|tb|sb)(\d+)?([munp])?$/;

/** Lowercases, strips a `lightning:` prefix, and checks the invoice looks like BOLT11. */
export function normalizeBolt11(input: string): string {
  if (typeof input !== 'string') {
    throw new RailsValidationError('invoice', 'must be a BOLT11 invoice string');
  }
  let value = input.trim().toLowerCase();
  if (value.startsWith('lightning:')) value = value.slice('lightning:'.length);
  if (value.length > 4096 || !BOLT11.test(value)) {
    throw new RailsValidationError('invoice', 'is not a BOLT11 Lightning invoice');
  }
  return value;
}

const MSATS_PER_UNIT: Record<string, bigint> = { m: 100_000_000n, u: 100_000n, n: 100n };

/**
 * Amount encoded in the invoice's human-readable part, in millisats, or null
 * for a zero-amount ("any amount") invoice. Does not verify the signature.
 */
export function bolt11AmountMsats(invoice: string): number | null {
  const value = normalizeBolt11(invoice);
  const match = HRP_AMOUNT.exec(value.slice(0, value.lastIndexOf('1')));
  if (!match) throw new RailsValidationError('invoice', 'has an unreadable amount');
  const [, digits, multiplier] = match;
  if (digits === undefined) {
    if (multiplier) throw new RailsValidationError('invoice', 'has an unreadable amount');
    return null;
  }
  const units = BigInt(digits);
  let msats: bigint;
  if (!multiplier) {
    msats = units * 100_000_000_000n;
  } else if (multiplier === 'p') {
    if (units % 10n !== 0n) throw new RailsValidationError('invoice', 'has a sub-millisat amount');
    msats = units / 10n;
  } else {
    msats = units * (MSATS_PER_UNIT[multiplier] as bigint);
  }
  if (msats > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RailsValidationError('invoice', 'amount is too large');
  }
  return Number(msats);
}
