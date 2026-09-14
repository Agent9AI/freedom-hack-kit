import { describe, expect, it } from 'vitest';
import {
  LnurlError,
  RailsValidationError,
  bolt11AmountMsats,
  lightningAddressToInvoice,
  lightningAddressUrl,
  normalizeBolt11,
  parseLightningAddress,
  parsePayParams,
  requestInvoice,
  resolveLightningAddress,
} from '../src/index.js';

const DATA = 'q'.repeat(60);
const WELL_KNOWN = 'https://pay.example.com/.well-known/lnurlp/alice';
const CALLBACK = 'https://pay.example.com/lnurlp/alice/callback';

const PAY_PARAMS = {
  tag: 'payRequest',
  callback: CALLBACK,
  minSendable: 10_000,
  maxSendable: 5_000_000,
  metadata: JSON.stringify([
    ['text/plain', 'Tip alice'],
    ['text/identifier', 'alice@pay.example.com'],
  ]),
  commentAllowed: 20,
  allowsNostr: true,
  nostrPubkey: 'ee'.repeat(32),
};

type Route = unknown | ((url: URL) => unknown);

function mockFetch(routes: Record<string, Route>) {
  const calls: URL[] = [];
  const impl = async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    const route = routes[url.origin + url.pathname];
    if (route === undefined) return new Response('not found', { status: 404 });
    const body = typeof route === 'function' ? (route as (u: URL) => unknown)(url) : route;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch: impl as unknown as typeof fetch, calls };
}

describe('Lightning addresses', () => {
  it('parses and normalizes valid addresses', () => {
    expect(parseLightningAddress(' Alice@Pay.Example.com ')).toEqual({ name: 'alice', domain: 'pay.example.com' });
    expect(parseLightningAddress('lightning:bob+tips@wallet.io')).toEqual({ name: 'bob+tips', domain: 'wallet.io' });
    expect(lightningAddressUrl('alice@pay.example.com')).toBe(WELL_KNOWN);
    const onion = `${'a'.repeat(56)}.onion`;
    expect(lightningAddressUrl(`alice@${onion}`)).toBe(`http://${onion}/.well-known/lnurlp/alice`);
  });

  it.each(['alice', 'alice@', '@pay.example.com', 'a@b@c.com', 'alice@localhost', 'alice@127.0.0.1', '..@evil.com', '.x@evil.com', 'al ice@x.com', 'alice@exa mple.com'])(
    'rejects %j',
    (address) => {
      expect(() => parseLightningAddress(address)).toThrow(RailsValidationError);
    },
  );
});

describe('LNURL-pay', () => {
  it('resolves pay parameters and derives whole-sat limits', async () => {
    const { fetch, calls } = mockFetch({ [WELL_KNOWN]: PAY_PARAMS });
    const params = await resolveLightningAddress('alice@pay.example.com', { fetch });
    expect(calls[0]?.href).toBe(WELL_KNOWN);
    expect(params).toMatchObject({ minSats: 10, maxSats: 5000, description: 'Tip alice', allowsNostr: true, commentAllowed: 20 });
  });

  it('enforces minSendable and maxSendable before requesting an invoice', async () => {
    const { fetch, calls } = mockFetch({ [WELL_KNOWN]: PAY_PARAMS, [CALLBACK]: { pr: `lnbc1u1p${DATA}` } });
    const params = await resolveLightningAddress('alice@pay.example.com', { fetch });
    await expect(requestInvoice(params, 9, { fetch })).rejects.toMatchObject({ code: 'AMOUNT_TOO_LOW', message: 'Minimum is 10 sats' });
    await expect(requestInvoice(params, 5001, { fetch })).rejects.toMatchObject({ code: 'AMOUNT_TOO_HIGH', message: 'Maximum is 5000 sats' });
    await expect(requestInvoice(params, -1, { fetch })).rejects.toBeInstanceOf(RailsValidationError);
    await expect(requestInvoice(params, 2.5, { fetch })).rejects.toBeInstanceOf(RailsValidationError);
    expect(calls).toHaveLength(1);
  });

  it('requests an invoice for the exact amount and checks the invoice matches', async () => {
    const { fetch, calls } = mockFetch({
      [WELL_KNOWN]: PAY_PARAMS,
      [CALLBACK]: (url: URL) => (url.searchParams.get('amount') === '1000000' ? { pr: `lnbc10u1p${DATA}`, routes: [] } : { status: 'ERROR', reason: 'bad amount' }),
    });
    const result = await lightningAddressToInvoice('alice@pay.example.com', 1000, { fetch, comment: 'thank you' });
    expect(result.invoice).toBe(`lnbc10u1p${DATA}`);
    expect(result.amountSats).toBe(1000);
    expect(calls[1]?.searchParams.get('comment')).toBe('thank you');
  });

  it('refuses an invoice whose amount differs from the request', async () => {
    const { fetch } = mockFetch({ [WELL_KNOWN]: PAY_PARAMS, [CALLBACK]: { pr: `lnbc20u1p${DATA}` } });
    await expect(lightningAddressToInvoice('alice@pay.example.com', 1000, { fetch })).rejects.toMatchObject({
      code: 'INVOICE_MISMATCH',
    });
  });

  it('surfaces service errors and rejects long comments', async () => {
    const { fetch } = mockFetch({ [WELL_KNOWN]: PAY_PARAMS, [CALLBACK]: { status: 'ERROR', reason: 'Recipient offline' } });
    const error = await lightningAddressToInvoice('alice@pay.example.com', 100, { fetch }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LnurlError);
    expect((error as LnurlError).message).toContain('Recipient offline');
    await expect(
      lightningAddressToInvoice('alice@pay.example.com', 100, { fetch, comment: 'x'.repeat(21) }),
    ).rejects.toBeInstanceOf(RailsValidationError);
  });

  it('rejects non-https callbacks and non-payRequest endpoints', () => {
    expect(() => parsePayParams({ ...PAY_PARAMS, callback: 'http://pay.example.com/cb' })).toThrow(LnurlError);
    expect(() => parsePayParams({ ...PAY_PARAMS, tag: 'withdrawRequest' })).toThrow(/payRequest/);
    expect(() => parsePayParams({ ...PAY_PARAMS, minSendable: 9_000_000 })).toThrow(/inconsistent/);
  });

  it('times out slow services', async () => {
    const hanging = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;
    await expect(resolveLightningAddress('alice@pay.example.com', { fetch: hanging, timeoutMs: 50 })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });
});

describe('bolt11 amounts', () => {
  it.each([
    [`lnbc10u1p${DATA}`, 1_000_000],
    [`lnbc2500u1p${DATA}`, 250_000_000],
    [`lnbc1m1p${DATA}`, 100_000_000],
    [`lnbc100n1p${DATA}`, 10_000],
    [`lnbc10p1p${DATA}`, 1],
    [`lntb20m1p${DATA}`, 2_000_000_000],
    [`lnbc1p${DATA}`, null],
  ])('reads %s', (invoice, expected) => {
    expect(bolt11AmountMsats(invoice)).toBe(expected);
  });

  it('normalizes and rejects garbage', () => {
    expect(normalizeBolt11(`LIGHTNING:LNBC10U1P${DATA.toUpperCase()}`)).toBe(`lnbc10u1p${DATA}`);
    expect(() => bolt11AmountMsats(`lnbc15p1p${DATA}`)).toThrow(/sub-millisat/);
    expect(() => normalizeBolt11('lnbc10u1pshort')).toThrow(RailsValidationError);
    expect(() => normalizeBolt11('bitcoin:bc1qxyz')).toThrow(RailsValidationError);
  });
});
