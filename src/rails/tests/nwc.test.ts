import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey, type Event } from 'nostr-tools/pure';
import * as nip04 from 'nostr-tools/nip04';
import * as nip44 from 'nostr-tools/nip44';
import { bytesToHex } from 'nostr-tools/utils';
import { NwcClient, NwcError, RailsValidationError, parseNwcUri } from '../src/index.js';
import { FakePool } from './helpers/fake-pool.js';

const INVOICE_1000_SATS = `lnbc10u1p${'q'.repeat(60)}`;
const INVOICE_ANY_AMOUNT = `lnbc1p${'q'.repeat(60)}`;

const walletPubkey = getPublicKey(generateSecretKey());
const clientHex = bytesToHex(generateSecretKey());

describe('parseNwcUri', () => {
  it('parses a valid connection string', () => {
    const relay = encodeURIComponent('wss://relay.example/v1');
    const connection = parseNwcUri(
      `nostr+walletconnect://${walletPubkey}?relay=${relay}&secret=${clientHex}&lud16=Tips@Pay.Example.com`,
    );
    expect(connection.walletPubkey).toBe(walletPubkey);
    expect(connection.relays).toEqual(['wss://relay.example/v1']);
    expect(connection.lud16).toBe('tips@pay.example.com');
    expect(bytesToHex(connection.secret)).toBe(clientHex);
    expect(connection.clientPubkey).toBe(getPublicKey(connection.secret));
    expect(JSON.stringify(connection)).not.toContain(clientHex);
  });

  it('accepts several unencoded relays', () => {
    const connection = parseNwcUri(
      `nostr+walletconnect://${walletPubkey}?relay=wss://a.example&relay=wss://b.example&secret=${clientHex}`,
    );
    expect(connection.relays).toEqual(['wss://a.example', 'wss://b.example']);
  });

  it.each([
    ['a wrong scheme', `https://${walletPubkey}?relay=wss://r.example&secret=${clientHex}`],
    ['a short wallet key', `nostr+walletconnect://abc123?relay=wss://r.example&secret=${clientHex}`],
    ['no relay', `nostr+walletconnect://${walletPubkey}?secret=${clientHex}`],
    ['a plaintext relay', `nostr+walletconnect://${walletPubkey}?relay=ws://r.example&secret=${clientHex}`],
    ['no secret', `nostr+walletconnect://${walletPubkey}?relay=wss://r.example`],
    ['a short secret', `nostr+walletconnect://${walletPubkey}?relay=wss://r.example&secret=abcd`],
    ['plain text', 'hello'],
  ])('rejects %s', (_label, uri) => {
    expect(() => parseNwcUri(uri)).toThrow(RailsValidationError);
  });

  it('never echoes the secret in error messages', () => {
    try {
      parseNwcUri(`nostr+walletconnect://nothex?relay=wss://r.example&secret=${clientHex}`);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(clientHex);
    }
  });
});

type WalletBehavior = { encryption: string | null; failPayments?: boolean; silent?: boolean };

function setup(behavior: WalletBehavior) {
  const fake = new FakePool();
  const walletSecret = generateSecretKey();
  const walletKey = getPublicKey(walletSecret);
  const handled: { scheme: string; method: string; params: Record<string, unknown>; tags: string[][] }[] = [];
  const warnings: string[] = [];

  fake.stored.push(
    finalizeEvent(
      {
        kind: 13194,
        content: 'get_balance make_invoice pay_invoice',
        tags: behavior.encryption ? [['encryption', behavior.encryption]] : [],
        created_at: 1_700_000_000,
      },
      walletSecret,
    ),
  );

  fake.onPublish = (event: Event) => {
    if (event.kind !== 23194 || behavior.silent) return;
    const scheme = event.tags.find((t) => t[0] === 'encryption')?.[1] ?? 'nip04';
    const key = nip44.v2.utils.getConversationKey(walletSecret, event.pubkey);
    const decrypt = (c: string) =>
      scheme === 'nip44_v2' ? nip44.v2.decrypt(c, key) : nip04.decrypt(walletSecret, event.pubkey, c);
    const encrypt = (p: string) =>
      scheme === 'nip44_v2' ? nip44.v2.encrypt(p, key) : nip04.encrypt(walletSecret, event.pubkey, p);
    const request = JSON.parse(decrypt(event.content)) as { method: string; params: Record<string, unknown> };
    handled.push({ scheme, ...request, tags: event.tags });

    let body: Record<string, unknown>;
    if (request.method === 'get_balance') {
      body = { result_type: 'get_balance', result: { balance: 21_000_500 } };
    } else if (request.method === 'make_invoice') {
      body = {
        result_type: 'make_invoice',
        result: { type: 'incoming', invoice: INVOICE_1000_SATS, payment_hash: 'ab'.repeat(32), amount: request.params.amount },
      };
    } else if (behavior.failPayments) {
      body = { result_type: 'pay_invoice', error: { code: 'INSUFFICIENT_BALANCE', message: 'not enough sats' } };
    } else {
      body = { result_type: 'pay_invoice', result: { preimage: 'cd'.repeat(32), fees_paid: 2_000 } };
    }
    fake.emit(
      finalizeEvent(
        {
          kind: 23195,
          content: encrypt(JSON.stringify(body)),
          tags: [
            ['p', event.pubkey],
            ['e', event.id],
          ],
          created_at: 1_700_000_001,
        },
        walletSecret,
      ),
    );
  };

  const client = new NwcClient(
    `nostr+walletconnect://${walletKey}?relay=wss://relay.example&secret=${bytesToHex(generateSecretKey())}`,
    { pool: fake, timeoutMs: 1_000, onWarning: (m) => warnings.push(m) },
  );
  return { fake, client, handled, warnings, walletKey };
}

describe('NwcClient against an in-memory wallet service', () => {
  it('negotiates NIP-44 and reads the balance', async () => {
    const { client, handled, warnings, walletKey, fake } = setup({ encryption: 'nip44_v2 nip04' });
    expect(await client.getBalance()).toEqual({ balanceMsats: 21_000_500, balanceSats: 21_000 });
    expect(handled[0]?.scheme).toBe('nip44_v2');
    expect(handled[0]?.tags).toEqual([
      ['p', walletKey],
      ['encryption', 'nip44_v2'],
    ]);
    expect(warnings).toEqual([]);
    expect(fake.subs.every((s) => s.closed)).toBe(true);
  });

  it('makes an invoice in millisats and returns it', async () => {
    const { client, handled } = setup({ encryption: 'nip44_v2' });
    const invoice = await client.makeInvoice({ amountSats: 1000, description: 'Tip for the reporter' });
    expect(handled[0]).toMatchObject({ method: 'make_invoice', params: { amount: 1_000_000, description: 'Tip for the reporter' } });
    expect(invoice).toMatchObject({ invoice: INVOICE_1000_SATS, amountSats: 1000, paymentHash: 'ab'.repeat(32) });
  });

  it('pays an invoice and reports fees in sats', async () => {
    const { client, handled } = setup({ encryption: 'nip44_v2' });
    expect(await client.payInvoice(`lightning:${INVOICE_1000_SATS.toUpperCase()}`)).toEqual({
      preimage: 'cd'.repeat(32),
      feesPaidSats: 2,
    });
    expect(handled[0]?.params).toEqual({ invoice: INVOICE_1000_SATS });
  });

  it('surfaces wallet error codes', async () => {
    const { client } = setup({ encryption: 'nip44_v2', failPayments: true });
    await expect(client.payInvoice(INVOICE_1000_SATS)).rejects.toMatchObject({
      name: 'NwcError',
      code: 'INSUFFICIENT_BALANCE',
    });
  });

  it('falls back to NIP-04 only when the wallet advertises nothing else, with a warning', async () => {
    const { client, handled, warnings } = setup({ encryption: null });
    await client.getBalance();
    await client.getBalance();
    expect(handled.map((h) => h.scheme)).toEqual(['nip04', 'nip04']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('NIP-04');
  });

  it('fails clearly when the wallet has no info event', async () => {
    const { client, fake } = setup({ encryption: 'nip44_v2' });
    fake.stored.length = 0;
    await expect(client.getBalance()).rejects.toMatchObject({ code: 'NO_INFO' });
  });

  it('times out when the wallet never answers', async () => {
    const { fake } = setup({ encryption: 'nip44_v2', silent: true });
    const walletKey = (fake.stored[0] as Event).pubkey;
    const client = new NwcClient(
      `nostr+walletconnect://${walletKey}?relay=wss://relay.example&secret=${clientHex}`,
      { pool: fake, timeoutMs: 100 },
    );
    const error = await client.getBalance().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NwcError);
    expect((error as NwcError).code).toBe('TIMEOUT');
  });

  it('validates amounts and invoices before touching the network', async () => {
    const { client, fake } = setup({ encryption: 'nip44_v2' });
    await expect(client.makeInvoice({ amountSats: -5 })).rejects.toBeInstanceOf(RailsValidationError);
    await expect(client.makeInvoice({ amountSats: 0 })).rejects.toBeInstanceOf(RailsValidationError);
    await expect(client.makeInvoice({ amountSats: 1.5 })).rejects.toBeInstanceOf(RailsValidationError);
    await expect(client.payInvoice('not an invoice')).rejects.toBeInstanceOf(RailsValidationError);
    await expect(client.payInvoice(INVOICE_ANY_AMOUNT)).rejects.toThrow(/amountSats is required/);
    await expect(client.payInvoice(INVOICE_1000_SATS, { amountSats: 5 })).rejects.toThrow(/does not match/);
    expect(fake.published).toHaveLength(0);
  });

  it('passes an explicit amount for zero-amount invoices', async () => {
    const { client, handled } = setup({ encryption: 'nip44_v2' });
    await client.payInvoice(INVOICE_ANY_AMOUNT, { amountSats: 21 });
    expect(handled[0]?.params).toEqual({ invoice: INVOICE_ANY_AMOUNT, amount: 21_000 });
  });
});
