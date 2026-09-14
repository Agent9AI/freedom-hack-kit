<!--
Versions verified 2026-09-13:
nostr-tools 2.25.2: installed as the only runtime dependency; type definitions and ESM source read directly.
@getalby/sdk 8.0.3: NOT a dependency; its npm tarball source was inspected only to confirm the NIP-47 wire format.
-->

# rails: Nostr publishing and Lightning money, drop-in

Standalone ESM TypeScript package for two things activists keep needing:

- **Censorship-resistant publishing** on Nostr: identities, posts, feeds, profiles, and private messages (NIP-17, NIP-44 encrypted).
- **Uncensorable money** over Lightning: Nostr Wallet Connect (NIP-47), Lightning address invoices (LNURL-pay), and zap requests (NIP-57).

One runtime dependency: `nostr-tools` 2.25.2. No analytics, no CDN, no calls to anything except the relays and Lightning services you choose. MIT licensed.

**The app never holds a seed phrase.** Money moves through a wallet the user already controls, connected with a revocable, budget-limited NWC string. If a phone is seized, the user revokes that connection from their wallet and the funds are untouched.

## Use it on event day

```bash
cp -r path/to/kit/src/rails ./rails
cd rails && npm install && npm run build && cd ..
npm install ./rails          # adds "@freedom-kit/rails": "file:rails"
```

Runtime: modern browsers, or Node 20.19+ (needed by nostr-tools' crypto). Browsers and Node 22+ have a built-in WebSocket. On Node 20 pass one in: `new RelayPool({ webSocketImplementation: WebSocket })` with `WebSocket` from the `ws` package.

## The 6 things every team needs

### 1. Create an identity

```ts
import { RelayPool, buildProfile, createIdentity, exportEncryptedKey, importEncryptedKey } from '@freedom-kit/rails';

const me = createIdentity();
showToUser(me.npub); // public, safe to share

// Store this, never the raw key. See "Key storage" below.
const backup = exportEncryptedKey(me, passphrase); // "ncryptsec1..."
const sameMe = importEncryptedKey(backup, passphrase);

const pool = new RelayPool(); // DEFAULT_RELAYS
await pool.publish(buildProfile(me, { name: 'Amina', about: 'Reporting from district 4', lud16: 'amina@getalby.com' }));
```

### 2. Post

```ts
import { publishNote } from '@freedom-kit/rails';

const { event, result } = await publishNote(pool, me, {
  content: 'Polling station 12 closed two hours early.',
  hashtags: ['election'],
});
showToast(result.summary); // "Published to 3 of 4 relays"
// result.acks lists each relay's answer, e.g. { relay, ok: false, message: 'blocked: pow required' }
```

### 3. Read a feed

```ts
import { fetchFeed, fetchProfile, subscribeFeed } from '@freedom-kit/rails';

const latest = await fetchFeed(pool, { hashtags: ['election'], limit: 50 }); // newest first
const live = subscribeFeed(pool, { hashtags: ['election'] }, (note) => render(note));
// authors: ['npub1...'] works too
live.close(); // when the screen unmounts

const profile = await fetchProfile(pool, note.pubkey); // name, picture, lud16, or null
```

### 4. Send a private message

```ts
import { sendDm, subscribeDms } from '@freedom-kit/rails';

const sent = await sendDm(pool, me, 'npub1recipient...', 'Meeting moved to the north entrance.');
showToast(sent.toRecipient.summary);

const inbox = subscribeDms(pool, me, (msg) => {
  render(msg.fromNpub, msg.content, new Date(msg.createdAt * 1000));
});
```

Relays see only a throwaway key, the recipient's public key, and a fake timestamp. They do not see the sender, the content, or the real time. `sendDm` looks up the recipient's preferred inbox relays (kind 10050) and also stores a copy for your other devices.

> **No NIP-04 DMs, on purpose.** Older NIP-04 DMs show sender, recipient and exact timing to every relay. That is exactly the metadata an adversary watching activists wants. This package does not send or read them.

### 5. Request a tip

The receiver shows an invoice from their own wallet:

```ts
import { NwcClient } from '@freedom-kit/rails';

const wallet = new NwcClient(nwcStringPastedByUser); // "nostr+walletconnect://..."
const { invoice } = await wallet.makeInvoice({ amountSats: 1000, description: 'Support independent reporting' });
showQrCode(`lightning:${invoice}`); // bundle a QR library locally, no CDN
```

A supporter tips a Lightning address, or zaps a Nostr profile:

```ts
import { lightningAddressToInvoice, requestZapInvoice } from '@freedom-kit/rails';

const tip = await lightningAddressToInvoice('amina@getalby.com', 1000, { comment: 'thank you' });

const zap = await requestZapInvoice(me, {
  recipient: profile.npub,
  lightningAddress: profile.lud16!,
  amountSats: 21,
  relays: [...pool.relays],
});
// then pay tip.invoice or zap.invoice (step 6)
```

The min and max amounts the service allows are enforced before any request. An invoice for a different amount than requested is refused.

### 6. Pay an invoice

```ts
import { NwcClient, NwcError } from '@freedom-kit/rails';

try {
  const { preimage, feesPaidSats } = await wallet.payInvoice(invoice);
  showToast(`Paid. Fee: ${feesPaidSats ?? 0} sats`);
} catch (error) {
  if (error instanceof NwcError && error.code === 'INSUFFICIENT_BALANCE') showToast('Not enough sats');
  else if (error instanceof NwcError && error.code === 'QUOTA_EXCEEDED') showToast('Budget used up. Raise it in your wallet');
  else throw error;
}

const { balanceSats } = await wallet.getBalance();
```

## Errors

| Class | When | Useful field |
|---|---|---|
| `RailsValidationError` | Bad input: malformed npub, NWC string, relay URL, Lightning address, negative or fractional amount | `field` |
| `NwcError` | Wallet said no, or did not answer | `code`: NIP-47 codes plus `TIMEOUT`, `PUBLISH_FAILED`, `NO_INFO`, `BAD_RESPONSE` |
| `LnurlError` | Lightning address service problem | `code`: `AMOUNT_TOO_LOW`, `AMOUNT_TOO_HIGH`, `INVOICE_MISMATCH`, `ZAPS_UNSUPPORTED`, `TIMEOUT`, ... |

Messages are safe to show and never contain secrets.

## Relays

`DEFAULT_RELAYS`:

```
wss://relay.damus.io
wss://nos.lol
wss://relay.primal.net
wss://nostr.mom
```

Use 3 to 5 relays. "Published to 3 of 4" is normal: relays go down (relay.damus.io returned HTTP 521 during testing on 2026-09-13). Re-check on event day with the read-only smoke script, which never publishes:

```bash
npm run build && npm run smoke -- wss://nos.lol
```

Relay URLs must be `wss://`. Plain `ws://` is accepted only for `localhost` and `.onion`, so a community can self-host a relay behind Tor.

## Key storage for non-technical users

Tell users this, in their language:

1. **Your secret key (nsec) is you.** Anyone who has it can post as you and read your private messages. It cannot be reset or recovered by anyone.
2. **Save the encrypted backup, not the raw key.** The app stores the `ncryptsec1...` backup from `exportEncryptedKey` and asks for the passphrase to unlock. Choose a passphrase of 4 or more random words.
3. **Paper beats screenshots.** Write the backup and a passphrase hint on paper, stored like cash. Photos sync to cloud accounts, and chat apps keep copies.
4. **One identity per risk level.** Keep a separate identity for sensitive reporting, unconnected to your public one.
5. **Relays see your IP address.** Where networks are watched, use Tor or a trusted VPN.
6. **The wallet connection string is cash.** Set a small budget when creating it (for example 10,000 sats a month). If the phone is lost or seized, revoke it in the wallet app.

For developers:

- Never put an nsec, hex secret, or NWC string in `localStorage` unencrypted, logs, analytics, crash reports, or URLs.
- Wrap anything you log in `redact()`. It masks secret bytes, nsec, ncryptsec and NWC `secret=` values.
- `NostrIdentity.secretKey` and `NwcConnection.secret` are non-enumerable, so `JSON.stringify` and Node's `console.log` skip them. Browser devtools can still show them if someone expands the object, so do not log identities at all.
- If the user already has a signer app (NIP-07 extension, NIP-46 remote signer such as Amber), that is safer still, but this package does not support it yet.

## Why NWC and not a built-in wallet

We use a small NIP-47 client written on nostr-tools rather than `@getalby/sdk` 8.0.3, which pulls in `nostr-tools` plus `@getalby/lightning-tools`. nostr-tools' own `nip47` helper only does `pay_invoice` over NIP-04. This client negotiates `nip44_v2` from the wallet's info event.

> **NIP-04 warning (wallets only).** If a wallet does not advertise `nip44_v2`, NIP-47 says it speaks only NIP-04, and the client falls back with a warning through `onWarning` (default `console.warn`). Requests are still encrypted, but NIP-04 has no padding and no authentication, so relays learn exact message sizes. Prefer wallets that advertise `nip44_v2`.

### Breeze SDK instead?

(The product is spelled Breez. Pathos used it at edition I.) Not integrated here, but worth knowing:

**Pros**
- The user needs no existing wallet: the app *is* the wallet, which is simpler to onboard where nobody has one.
- Self-custodial, with mobile bindings (Swift, Kotlin, React Native, Flutter) and a web build.
- Payments do not depend on a separate wallet service being online.

**Cons**
- The app generates and holds a seed phrase. That breaks this kit's rule: a seized or compromised phone means lost funds, and non-technical users must back up 12 words safely.
- Needs a Breez-issued API key and talks to Breez and swap-provider infrastructure, which are third-party dependencies in a watched network.
- Heavier: native or WASM binaries, more setup, and swap or service fees depending on the implementation. Hard to finish in a 1.5-day build.

Rule of thumb: if the captain's users already have Lightning wallets, or can install one, use NWC. If they have nothing and receiving money in-app is the core feature, evaluate Breez on Thursday morning, and budget half a day.

## Gotchas

- Gift-wrap timestamps are randomized up to two days back. `subscribeDms(pool, me, cb, { since })` widens the relay filter for you.
- Do not edit a signed event and republish it. Build a new one. nostr-tools caches signature checks on the object.
- NWC responses are never stored by relays, so the client subscribes before sending each request. If a wallet answers slowly, raise `timeoutMs` (default 30 s).

## STATUS

Verified on 2026-09-13, macOS, Node 22.18.0:

- `npm test`: 7 files, **81 tests pass**, fully offline. Key round trips and NIP-19 vectors, publish ack aggregation (injected pool, plus a fake WebSocket running nostr-tools' real relay code), NIP-17 DM encrypt and decrypt round trip, tamper and third-party rejection, NWC URI validation, NWC against an in-memory wallet (nip44_v2, NIP-04 fallback, errors, timeout), LNURL min/max and invoice-amount checks with mocked fetch, zap request shape checked with `nip57.validateZapRequest`.
- `npm run build`: tsc 7.0.2 to `dist/`, no errors. Tests typecheck too.
- Live read-only smoke: `wss://nos.lol` connected, 5 kind 1 notes in 5 s. No event published, no wallet touched.
- Bug found and fixed: with Node 22's built-in WebSocket, nostr-tools calls `close()` inside `onerror` and undici re-fires `error`, so any unreachable relay overflowed the stack and crashed the process. `RelayPool` now wraps the WebSocket so `close()` runs once. Checked against the real undici WebSocket on a closed localhost port, and covered by a regression test that reproduces the overflow when the guard is removed.

Untested:

- A real NWC wallet. The wire format was checked against `@getalby/sdk`'s source, but no real wallet was connected and no payment was made.
- A real LNURL-pay server. Only mocked fetch was used.
- Publishing to public relays (not allowed during prep).
- DM interop with other NIP-17 clients (for example 0xchat, Amethyst). The round trip is tested only within this library.
- Running in a browser. The build uses no Node types or APIs, but it was not run in a browser. Node 20 with `ws` was not run either.

Not implemented: NIP-42 relay AUTH (AUTH-only relays will refuse), NIP-07 and NIP-46 signers, BOLT11 signature and `description_hash` checks (only the amount is checked), zap receipt (kind 9735) validation.

Deviation from the kit's Node 18+ rule: nostr-tools 2.25.2 needs `@noble` v2, which requires Node 20.19+. Running tests needs Node 22.12+ (vitest 5). vitest 4 crashed npm 10.9.3's installer (`edgesOut` of null).
