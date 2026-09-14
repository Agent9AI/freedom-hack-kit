# Account Setup Before the Event

Three accounts, about 45 minutes total. Target: all live and tested by **Sat Sep 20, 2026**. Instructions were checked against public docs on 2026-09-13; UI labels can drift, so anything marked *unconfirmed* should be checked when you get there.

Store every credential in the macOS Keychain, never in a file in this repo.

---

## 1. Maple AI: encrypted AI with an OpenAI-compatible API (about 15 min)

**Why:** Maple runs models inside secure enclaves. Stringer Safety used it to win edition I, and HRF's AI Fund backs it. Judging criterion 2 is "integration of AI tools", and private AI is the credible way to do that for activists.

**Plan needed:** API access (Maple Proxy) requires **Pro, Team, or Max, starting at $20/month**. The free plan does not include it.

**No-KYC option (found by the intel agent):** Maple 2.0 lets you "generate a unique ID, create a password, and pay exclusively with Bitcoin", with a 10% discount for bitcoin. This is the signup path to show an activist, and it fits the event's values. Source: [Maple 2.0 announcement](https://blog.trymaple.ai/maple-2-0-now-with-live-data/).

### Steps

1. Create an account at [trymaple.ai](https://trymaple.ai). Email signup is fine for your own dev account; use the anonymous ID + bitcoin path if you want to demo it.
2. **Upgrade to Pro around Sat Sep 19** so one billing month covers testing, the event, and a week after. Pay with bitcoin from the Coinos wallet below for the discount.
3. Download the desktop app from `trymaple.ai/downloads`.
4. In the app: **Settings → API Management → Local Proxy → Start Proxy**. The app creates an API key and serves an OpenAI-compatible API at `http://localhost:8080/v1` (port is configurable).
5. List the exact model IDs (Maple's own docs spell the Llama model two different ways, so trust this output):
   ```bash
   curl http://localhost:8080/v1/models -H "Authorization: Bearer YOUR_MAPLE_API_KEY"
   ```
6. Smoke test a streaming completion:
   ```bash
   curl -N http://localhost:8080/v1/chat/completions \
     -H "Authorization: Bearer YOUR_MAPLE_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"MODEL_ID_FROM_STEP_5","messages":[{"role":"user","content":"Hello"}],"stream":true}'
   ```
7. Save the key:
   ```bash
   security add-generic-password -a "$USER" -s maple-api-key -w
   ```

Models listed in the docs on 2026-09-13: `kimi-k2-6`, `gpt-oss-120b`, `deepseek-v4-pro`, `glm-5-1`, `llama3-3-70b`, `qwen3-vl-30b`, `gemma4-31b`.

### Gotchas

- **The desktop proxy only serves your laptop.** A deployed app used by other people cannot reach your `localhost:8080`. For a live URL, run the proxy on a server:
  ```bash
  docker run -p 8080:8080 \
    -e MAPLE_BACKEND_URL=https://enclave.trymaple.ai \
    -e MAPLE_API_KEY=YOUR_MAPLE_API_KEY \
    ghcr.io/opensecretcloud/maple-proxy:latest
  ```
  Add `-e MAPLE_ENABLE_CORS=true` if a browser app calls it directly.
- **Honest pitch wording:** encryption covers the path from the proxy to Maple's enclave. Whoever runs the proxy can see prompts in plaintext. Say that, and do not call the whole app "end-to-end encrypted" unless it is.
- **Port clash:** the starter kit's `llama-cpp` preset also uses `8080`. Do not run llama.cpp server and the Maple proxy on the same port.
- **Streaming only:** "Maple currently supports streaming responses only", so every client call must use `"stream": true` and parse server-sent events.
- **Public demos:** Maple says clients should provide their own API keys in production. For a demo URL, put a tiny server in front that injects your key, rate-limits, and keeps the key out of the browser.
- **No audio or embeddings listed.** If the captain's idea needs speech-to-text, text-to-speech, or embeddings for search, Tinfoil is the private-inference backup (also TEE-based), but its signup is card checkout with no documented no-KYC path. Sources: [Tinfoil quickstart](https://docs.tinfoil.sh/quickstart.md), [Tinfoil API key](https://docs.tinfoil.sh/get-api-key.md).
- **Captains may already have private AI.** HRF's Agent Camp set edition II captains up with a Hermes agent from Finite pointed at a TEE model. Ask your captain Wednesday what model endpoint they already use before paying for anything new. See [`../research/COORDINATOR_FINDINGS.md`](../research/COORDINATOR_FINDINGS.md) section 8.

Sources: [Maple Proxy documentation](https://blog.trymaple.ai/maple-proxy-documentation/), [maple-proxy on GitHub](https://github.com/opensecretcloud/maple-proxy), [Introducing Maple Proxy](https://blog.trymaple.ai/introducing-maple-proxy-the-maple-ai-api-that-brings-encrypted-llms-to-your-openai-apps/).

---

## 2. Lightning wallet with Nostr Wallet Connect (about 15 min)

**Why:** Pathos (edition I, 2nd) and Zuka (edition II, 2nd) both used bitcoin rails. `src/rails` talks to wallets through Nostr Wallet Connect (NWC, NIP-47), so a demo needs a real NWC connection string.

**Recommendation for the demo: Coinos.** Free, web-based, custodial. Custodial is fine for a $5-10 demo balance. Never recommend a custodial wallet to an at-risk activist for real funds.

### Steps

1. Sign up at [coinos.io](https://coinos.io). *Unconfirmed:* whether signup asks for email; it should not need ID for a demo account.
2. Fund it with **5,000 to 10,000 sats** (about $5-10) by paying a Coinos invoice from any Lightning wallet (Strike and Cash App can pay Lightning invoices).
3. Find the **Nostr Wallet Connect** connection string. It starts with `nostr+walletconnect://`. The Coinos operator's last public note put it under your **profile details**; *unconfirmed* whether the menu has moved.
4. If budget or permission settings are offered, set **1,000 to 5,000 sats per day**.
5. Save it:
   ```bash
   security add-generic-password -a "$USER" -s coinos-nwc -w
   ```
6. Test receiving: create an invoice in Coinos and pay it from another wallet. Test sending: pay a small invoice from Coinos.
7. Note your Lightning Address (normally `username@coinos.io`, *unconfirmed*) for the Nostr profiles below.

### Caveats

- As of the operator's public note, Coinos issued **one admin string with full control of the wallet**, and a receive-only string cannot send. Treat the string like a password and keep the balance small.
- Suggested NWC budgets from the Nostr User Guide: casual 500-1,000 sats/day, active 5,000-10,000 sats/day.

### Optional: request a Breez API key now

Pathos and Zuka, two past podium teams, used the Breez SDK (Spark) for in-app self-custodial wallets. Breez requires an API key, which is delivered by email after a form request, so you cannot get one instantly at the event. If an in-app wallet is at all plausible, request it this week at [breez.technology/request-api-key](https://breez.technology/request-api-key/). Otherwise, NWC (above) needs no key. Source: [Breez SDK getting started](https://sdk-doc-spark.breez.technology/guide/getting_started.html).

### Alternative: Alby Hub (self-custodial)

Worth naming in a pitch as the "hold your own keys" path. It must stay running to process payments and needs Lightning channel setup, so skip it for demos unless your captain's project is centered on payments.

Sources: [Coinos adds NWC (Stacker News)](https://stacker.news/items/687799), [Nostr User Guide: Wallet Connect](https://nostrcg.github.io/userguide/using-nostr/wallet-connect/), [Alby Hub via NWC link](https://guides.getalby.com/user-guide/browser-extension/link-wallet/alby-hub-via-nwc-link), [NWC docs](https://docs.nwc.dev/).

---

## 3. Two throwaway Nostr identities (about 10 min)

**Why two:** a live demo of a private DM or a zap needs a sender and a receiver.

### Steps

1. Install `nak` (the Nostr Army Knife CLI):
   ```bash
   brew install nak
   ```
2. Generate the first identity:
   ```bash
   SK=$(nak key generate)
   echo $SK | nak encode nsec                 # secret key: never share, never commit
   nak key public $SK | nak encode npub       # public identity: safe to share
   ```
3. Save the nsec:
   ```bash
   security add-generic-password -a demo1 -s nostr-demo1-nsec -w
   ```
4. Repeat steps 2 and 3 with `demo2` / `nostr-demo2-nsec`.
5. Set profiles: log in at [primal.net](https://primal.net) with each nsec (acceptable for throwaway keys only, never for a real identity), set names like "AIHFF Demo 1" and "AIHFF Demo 2", and add your Coinos Lightning Address so zaps land in a real wallet.
6. Optional CLI check that relays see you:
   ```bash
   nak req -k 1 -l 10 relay.damus.io
   ```

Sources: [nak README](https://github.com/fiatjaf/nak/blob/master/README.md), [nak Homebrew formula](https://formulae.brew.sh/formula/nak).

---

## 4. Network backup

- Phone hotspot tested with the laptop before travel.
- Never make a demo depend on a home server; it may be off or unreachable from the venue.

---

## End-to-end check (after the kit is finished)

- [ ] `src/starter` Settings pointed at `http://localhost:8080/v1` with the Maple key streams a reply.
- [ ] `src/rails` NWC client creates a real invoice against the Coinos string.
- [ ] Demo 1 sends Demo 2 a private DM; Demo 2 decrypts it.
- [ ] Demo 1 zaps Demo 2; sats arrive in Coinos.
