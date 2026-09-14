import { describe, expect, it } from 'vitest';
import { verifyEvent } from 'nostr-tools/pure';
import * as nip57 from 'nostr-tools/nip57';
import { RailsValidationError, buildNote, buildZapRequest, createIdentity, requestZapInvoice } from '../src/index.js';

const DATA = 'q'.repeat(60);
const RELAYS = ['wss://a.example', 'wss://b.example'];

describe('NIP-57 zap requests', () => {
  it('builds a signed kind 9734 profile zap with amount in millisats', () => {
    const sender = createIdentity();
    const recipient = createIdentity();
    const zap = buildZapRequest(sender, { recipient: recipient.npub, amountSats: 21, relays: RELAYS, comment: 'great report' });

    expect(zap.kind).toBe(9734);
    expect(zap.pubkey).toBe(sender.publicKey);
    expect(zap.content).toBe('great report');
    expect(zap.tags).toEqual(
      expect.arrayContaining([['p', recipient.publicKey], ['amount', '21000'], ['relays', ...RELAYS]]),
    );
    expect(zap.tags.some((t) => t[0] === 'e')).toBe(false);
    const roundTripped = JSON.stringify(zap);
    expect(verifyEvent(JSON.parse(roundTripped))).toBe(true);
    expect(nip57.validateZapRequest(roundTripped)).toBeNull();
  });

  it('adds e and k tags when zapping a specific note', () => {
    const sender = createIdentity();
    const author = createIdentity();
    const note = buildNote(author, { content: 'on the ground report' });
    const zap = buildZapRequest(sender, { recipient: author.publicKey, amountSats: 100, relays: RELAYS, event: note });
    expect(zap.tags).toEqual(expect.arrayContaining([['e', note.id], ['k', '1']]));
    expect(nip57.validateZapRequest(JSON.stringify(zap))).toBeNull();
  });

  it('adds an lnurl tag when given one', () => {
    const zap = buildZapRequest(createIdentity(), {
      recipient: createIdentity().publicKey,
      amountSats: 1,
      relays: RELAYS,
      lnurl: 'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35XVUKXEFCV5MKVV34X5EKZD3EV56NYD3HXQURZEPEXEJXXEPNXSCRVWFNV9NXZCN9XQ6XYEFHVGCXXCMYXYMNSERXFQ5FNS',
    });
    expect(zap.tags.find((t) => t[0] === 'lnurl')?.[1]?.startsWith('lnurl1')).toBe(true);
  });

  it('rejects bad input', () => {
    const sender = createIdentity();
    const recipient = createIdentity().npub;
    expect(() => buildZapRequest(sender, { recipient, amountSats: 0, relays: RELAYS })).toThrow(RailsValidationError);
    expect(() => buildZapRequest(sender, { recipient, amountSats: -21, relays: RELAYS })).toThrow(RailsValidationError);
    expect(() => buildZapRequest(sender, { recipient, amountSats: 21, relays: [] })).toThrow(RailsValidationError);
    expect(() => buildZapRequest(sender, { recipient: 'npub1nope', amountSats: 21, relays: RELAYS })).toThrow(RailsValidationError);
    expect(() => buildZapRequest(sender, { recipient, amountSats: 21, relays: RELAYS, lnurl: 'https://x' })).toThrow(RailsValidationError);
    const someoneElsesNote = buildNote(createIdentity(), { content: 'not by recipient' });
    expect(() => buildZapRequest(sender, { recipient, amountSats: 21, relays: RELAYS, event: someoneElsesNote })).toThrow(
      /not written by the zap recipient/,
    );
  });

  it('requestZapInvoice sends the signed zap request to the LNURL callback', async () => {
    const sender = createIdentity();
    const recipient = createIdentity();
    let nostrParam: string | null = null;
    const fetchImpl = (async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/.well-known/lnurlp/amina') {
        return Response.json({
          tag: 'payRequest',
          callback: 'https://pay.example.com/cb',
          minSendable: 1000,
          maxSendable: 100_000_000,
          metadata: '[]',
          allowsNostr: true,
          nostrPubkey: 'ee'.repeat(32),
        });
      }
      nostrParam = url.searchParams.get('nostr');
      return Response.json({ pr: `lnbc210n1p${DATA}` });
    }) as unknown as typeof fetch;

    const result = await requestZapInvoice(
      sender,
      { recipient: recipient.npub, lightningAddress: 'amina@pay.example.com', amountSats: 21, relays: RELAYS },
      { fetch: fetchImpl },
    );
    expect(result.invoice).toBe(`lnbc210n1p${DATA}`);
    expect(JSON.parse(nostrParam ?? '{}').id).toBe(result.zapRequest.id);
  });

  it('refuses to zap an address that does not support Nostr zaps', async () => {
    const fetchImpl = (async () =>
      Response.json({ tag: 'payRequest', callback: 'https://pay.example.com/cb', minSendable: 1000, maxSendable: 1e8, metadata: '[]' })) as unknown as typeof fetch;
    await expect(
      requestZapInvoice(
        createIdentity(),
        { recipient: createIdentity().npub, lightningAddress: 'bob@pay.example.com', amountSats: 21, relays: RELAYS },
        { fetch: fetchImpl },
      ),
    ).rejects.toMatchObject({ code: 'ZAPS_UNSUPPORTED' });
  });
});
