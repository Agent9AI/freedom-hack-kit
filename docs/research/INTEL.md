# INTEL: AI Hack for Freedom III (Washington, DC)

Compiled 2026-09-13 by the `intel` agent.

> **Public edition.** Speculation about which named individuals might attend edition III, and names of captains who were not on the podium, were removed. Several people in this space face transnational repression, and a public document should not link them to a specific place and date. Podium captains below are named only as HRF published them.

 Tags: **[V]** VERIFIED (source read this session), **[I]** INFERRED (reasoning, or seen only in a search snippet). Bracketed IDs like `[luma3]` point to the Source index at the bottom.

## 0. Read this first

1. **No captains, judges, or themes for III are announced** on any source checked (site, site git history, Luma, HRF, NED, UMD, AI Freedom Lab, Nostr full-text search). [V]
2. **III prize pool is $25k total**, cut from $50k on 2026-07-29 (commit `f4632a8` "Prize pool: $50k -> $25k") `[repo]`. Split is unpublished; first place will be well under edition II's $25k. [V pool / I split]
3. **Submission is a Google form.** The first draft of the edition I schedule said: "Submit just a github url for code and a working version that judges can try" (commit `706b624`, 2026-01-11, reworded the same day in `3a8588f`) `[repo]`. Plan on a public repo plus a live URL. [V text / I still applies]
4. **Friday times conflict.** Site schedule says submit 3:00 PM, pitches 3:30 PM `[site-sched]`. Luma says pitches 1:30 PM, judges 3:00 PM, winners 3:30 PM `[luma3]`. The site page is an edition I template with identical times; trust Luma and expect the form before 1:30 PM. [V both / I which wins]
5. **Organizer-side people to expect:** HRF and Finite staff who helped run past editions and Agent Camps are likely present. Ask them early whether captains arrive with their own agent environment and which model it uses. [I]
6. **Tool traps:** Breez SDK needs an API key delivered by email (request now or use NWC) `[breez]`. OpenClaw now requires Node >=24.16 `[openclaw-npm]`. Maple's API is streaming-only and needs a $20/mo plan `[maple-proxy]`. [V]

## 1. Edition III: captains, judges, themes

### Announced facts [V]

| Fact | Source |
|---|---|
| Wed Sep 23 reception; build Thu Sep 24 and Fri Sep 25; winners event Fri at NED, 1201 Pennsylvania Ave NW Ste 1100 | `[luma3]` `[site]` |
| Fri: 1:00 doors, 1:30 team pitches, 3:00 judges convene, 3:30 winners, 4:00 Pubkey bar | `[luma3]` |
| Presented by AI Freedom Lab; supported by HRF, NED, UMD School of Public Policy | `[site]` |
| "one activist and one or two developers per team"; "Mentors will be available throughout the event" | `[site]` |
| "Applications are now closed"; "Rules for the hackathon are subject to change" | `[site]` |
| Site schedule Thu: 10:00 kickoff and ideating, 11:00 start building, 4:00-5:00 PM "Activists Roundtable - How can AI be used to repress", 6:00 dinner | `[site-sched]` |
| Captains: none named. Judges: none named. Themes: only "freedom, privacy, and decentralized technology" | `[site]` `[luma3]` |

Checked with no names found: `[site]` and all 73 commits of `[repo]` (through 2026-09-02), `[luma3]`, aifreedomlab.org (/, /about, /events), HRF search, NED search, UMD SPP search, Nostr search on `wss://search.nos.today` for "Hack for Freedom", "Agent Camp", "Finite", "AI Freedom Lab". AI Freedom Lab's X account could not be read directly (search snippets only). Park's Nostr key (`5df21e8e...` from the site's `.well-known/nostr.json`) returned no notes since July on relay.primal.net or nos.lol. [V]

### Signals about who comes

- NED president Damon Wilson at the UMD SPP commencement: "an upcoming democracy hackathon bringing NED partners together with technologists" `[ned-wilson]`. [V quote] If this is H4F III, some captains will come from NED's grantee network rather than only HRF's usual roster. [I]
- Edition II ran an Agent Camp in San Diego three days before the hackathon, where Finite set captains up with a customized Hermes environment; captains then "could code portions themselves" `[hrf-ii-win]`. [V] Expect III captains who already vibe code and have their own agent. [I]
- An HRF staffer's Nostr note: "At HRF we ran our first Agent Camp in mid-February... early OpenClaw software running on a Macbook, connected to Opus 4.6" `[nostr-agentcamp]`. [V text / I author identity]
- Repeat captains happen: at least one captain led a team at both editions I and II `[hrf-i-pre]` `[hrf-ii-pre]`, and past winners hold ongoing HRF roles. [V]

### Likely problem areas [I: nothing below is announced for III]

Drawn from past captains' regions, the Oslo Freedom Forum 2026 program `[off26]`, and NED's 2026 Democracy Awards (Belarus, Burma, Cuba, Ethiopia, Russia) `[ned-awards]`. Individuals are intentionally not named.

| Region | Problem shapes that recur |
|---|---|
| Venezuela, Nicaragua, Cuba | Political prisoner case tracking, prisoner family support, uncensorable aid |
| Hong Kong, China, Tibet diaspora | Transnational repression, diaspora organizing under surveillance, documenting censored protest |
| Russia, Belarus | Corruption document analysis, political prisoner support at scale |
| Syria, Eritrea, Ethiopia | Evidence documentation and accountability archives |
| Burma, Nigeria | Journalist safety, journalism under a junta |
| Iran, Afghanistan | Information access inside the country, education under bans |
| Serbia and movement trainers | Nonviolent movement training at scale |
| Rwanda and exile media | Anonymous publishing, identity protection |

## 2. Every team from editions I and II

### Edition I: Austin, Jan 17-18 2026 (Bitcoin Park Austin)

Format [V]: 8 captains; 1 BTC pool paid 0.5 / 0.25 / 0.1 BTC, remainder split among other captains; criteria "Scale and impact of the problem addressed", "Quality of execution", "Tool adoption by users outside the team"; 3 judges, unnamed in HRF's post `[hrf-i-win]`. Stacker News names judge niftynei, who described it as "probably the toughest hackathon" judged `[sn-i]`.

Captains [V]: 8 activist captains, listed in HRF's announcement `[hrf-i-pre]`. Only podium captains, as named in HRF's winners post, appear below.

| Project | Place | Captain | What was built | Stack | Live status (curl + fetch, 2026-09-13) |
|---|---|---|---|---|---|
| Stringer Safety | 1st | Sundaram | Trusted contact network, location and status updates, one-click SOS that shares context and triggers response recommendations | Maple AI `[hrf-i-win]`; Vite SPA | `stringersafety.com` 200, empty SPA shell whose JSON-LD says "Stringer Safety has been rebranded to Kyntab" `[stringer]`. `kyntab.com` is a shipped iOS and Android app, "Kyntab SOS": encrypted SOS to trusted contacts, voice or touch trigger, Apple permission to "override silent settings", patent pending, Kyntab PBC, cites the HRF hackathon win. No AI on the page `[kyntab]` |
| Pathos | 2nd | López | Live feed, world map of users, wallet, zaps, bounties, Maple chatbot, Bitchat offline mode `[sn-i]` | Nostr, Breez SDK, Maple, Bitchat BLE; built by Soapbox team plus hzrd149 and Elsat (Damus) `[soapbox]` | `pathos.place` redirects to `agora.spot`, a React SPA titled "Give Without Borders" `[agora]`. Renamed Agora; "over 100 users had onboarded" within 24 hours of launch `[soapbox]` |
| Corruption Disrespector | 3rd | Chekhovich | Upload registries, financial records, court filings in many languages; AI extracts people, companies, addresses, accounts; links to existing research; network maps `[hrf-i-win]` | LLM extraction + graph; demo hosted on Replit | `corruptiondisrespector.com` 200: landing page "AI-Powered Corruption Investigation" (ACF Document Scanner), handles Cyrillic transliteration. Linked demo `corruption-disrespector-demo.replit.app` returns 404 `[cd]` |
| Mindy | none | not published | Analyzes representatives' statements and testimony, generates outreach scripts and emails | not published | no URL found `[sn-i]` |
| Aman | none | not published | Signal-based chatbot on Maple connecting grassroots sources with journalists | Signal, Maple | no URL found `[sn-i]` |
| AI for Human Rights Scorecard | none | not published | LLM benchmark comparing models on human rights values | not published | no URL found `[sn-i]` |
| Sanctum | none | not published | AI dashboard for detained activists' families in crisis; multilingual; admin database | not published | no URL found `[sn-i]` |
| OpenCCP | none | not published | Chrome extension using Grok to analyze tweet sentiment by side | Chrome extension, Grok | no URL found `[sn-i]` |
| Enclave (AI Fund grant, May 2026) | none | Berta Valle imagined it; World Liberty Congress builds it | Secure case-file upload, AI analysis and Q&A inside hardware enclaves for political prisoner advocates `[fund]` | Repo `enclave-free/enclave.free`, GPL-3.0: FastAPI control plane, Rust "Sage" agent runtime, `tinfoil-proxy` (Tinfoil OpenAI-compatible), Postgres, Qdrant, Valkey, SearXNG, Docker Compose; release v0.4.24 on 2026-09-13 `[enclave-gh]` | `enclave.free` does **not resolve**: nameservers exist (registrar-servers.com) but no A or AAAA record. Only the repo is live. [V] |

Captain-to-project mapping for Mindy, Aman, Scorecard, Sanctum, and OpenCCP is unpublished. Enclave is described as built at edition I, so Sanctum may be its hackathon name. [I: do not repeat as fact]

### Edition II: Nashville, May 9-10 2026 (AI Freedom Lab at Bitcoin Park)

Format [V] `[hrf-ii-win]`: 8 teams; $25k / $15k / $5k, $1k to every other team, in BTC; criteria "Scale of the problem addressed, integration of AI tools into their solutions, and the quality of technical execution"; three judges, unnamed; Agent Camp in San Diego three days prior with Finite; "Customized Hermes setup via Finite.Computer". Pitches 2:30 to 3:30 PM, judges 3:30, winners 3:50 `[luma2]`. Gladstein's announcement tweet said "9 top global activists" `[gladstein-x]` [I: snippet].

Captains [V]: 8 activist captains, listed in HRF's announcement `[hrf-ii-pre]`. Only podium captains, as named in HRF's winners post, appear below.

| Project | Place | Captain | What was built | Stack | Live status (2026-09-13) |
|---|---|---|---|---|---|
| Tarkus | 1st | Vaca-Daza | Generates culturally relevant lessons and case studies for in-person nonviolence workshops; students ask questions in a live interface; an agent analyzes interactions for comprehension gaps and feeds back to the trainer `[hrf-ii-win]` | "open-source", self-hostable `[hrf-ii-win]`; HTML shows TanStack Start (SSR router markers) on Vercel `[tarkus]` | `tarkus-phi.vercel.app` 200: "TARKUS live training assistant. Human trainer in front. AI synthesis behind." Routes `/teacher` and `/join` `[tarkus]` [V] |
| Zuka | 2nd | Kanimba | AI-generated avatar (face, voice, name, bio) to publish videos and posts anonymously; bitcoin wallet for donations; no email or personal data `[hrf-ii-win]` | Nostr; production CSP comments name the Breez Spark SDK WASM wallet, ffmpeg.wasm video stitching, an image-to-video chain, and reference `AGENTS.md` / `PROJECT.md` `[zuka]` | `zuka.live` 200: static SPA, meta "AI personas on Nostr. Voices that can be amplified but not silenced." Strict CSP, no third-party script hosts `[zuka]` [V] |
| Roshan | 3rd | Mahboob | Personalized AI learning companion for girls denied school: English exams, job skills, STEM, adaptive lessons, quizzes, offline preloaded materials `[hrf-ii-win]` | Offline-capable | No public URL. "preparing deployment to 2,000 female students in Afghanistan" `[hrf-ii-win]` |
| 5 other teams | $1k each | see `[hrf-ii-pre]` | Not published anywhere found | unknown | unknown |

### What the winners' sites say about taste [I, from V observations above]

- Every podium project with a URL is still online 4 to 8 months later; two became real products (Kyntab, Agora). HRF rewards things that keep living.
- Each site leads with a single sentence promise and needs no login to understand. Tarkus and Zuka are fast static SPAs.
- Private AI (Maple, TEE) or Nostr plus Lightning appears in 6 of the 9 described edition I and II projects.
- One winner's demo link is dead (Replit). Keep the judged URL alive after the event.

## 3. Rules signal

| Topic | What is known | Tag | Source |
|---|---|---|---|
| Written rules | None published; every page says rules "are subject to change" | V | `[site]` |
| Team shape | 1 captain + 1 or 2 developers | V | `[site]` |
| Submission | "Submit projects with a Google form" on all three editions' schedules. Edition I first draft: "(Submit just a github url for code and a working version that judges can try)" | V | `[repo]` 706b624, 3a8588f |
| Deadline | Site template: 3:00 PM. Luma III pitches at 1:30 PM, so the form is likely due around 1:00 PM | V / I | `[site-sched]` `[luma3]` |
| Build window | Thu 11:00 AM "Start building" to Fri form deadline; Thu 4-5 PM roundtable costs an hour | V | `[site-sched]` |
| Pitch length | Unknown. Edition II: 60 min block for 8 teams, about 7 min each. III: 90 min block, team count unknown | V / I | `[luma2]` `[luma3]` |
| Pre-existing code | Unknown. Tolerance signals: López, "This is something that we've been thinking about for a while...we have a tested platform"; Roshan ties to Mahboob's existing AfghanDreamers.ai | V quotes / I tolerance | `[hrf-i-win]` `[hrf-ii-win]` |
| AI tool use | Encouraged and scored in II; HRF named Hermes, OpenClaw, OpenCode deployed through Finite.Computer; captains vibe code | V | `[hrf-ii-pre]` `[hrf-ii-win]` |
| Open source | No licensing rule found. HRF calls Tarkus and Zuka open source; Enclave is GPL-3.0; the AI Fund backs "open-source, sovereignty-boosting AI tools" | V / I expectation | `[hrf-ii-win]` `[fund]` |
| Adoption | Scored in edition I ("adoption by users outside the team"); III criteria unpublished | V / I | `[hrf-i-win]` |
| Organizer contact | No email on the site. Options: Luma host message on `[luma3]`, aifreedomlab.org/contact, the application form `forms.gle/SVyjJXLrDvgiPMgeA` (site `/h4f4` redirect) | V | `[repo]` |

### Three questions to email the organizers

1. **Prior code.** "We plan to bring small, generic, MIT-licensed building blocks written before the event (an offline web app shell, Nostr and Lightning helper modules) and will disclose them in the pitch. Is that allowed, or must all project code be written after Thursday's kickoff?"
2. **Submission.** "What fields does Friday's Google form require (public GitHub URL, live demo URL, video, license), and what is the exact deadline, given Luma lists pitches at 1:30 PM?"
3. **Pitch and judging.** "How many minutes does each team get to pitch and demo, is there a projector with HDMI or USB-C, and will judging use the edition II criteria (scale of problem, AI integration, technical execution)?"

## 4. Toolchain quick-starts (versions checked 2026-09-13)

Versions come from `registry.npmjs.org/<pkg>/latest` and `api.github.com/repos/<repo>/releases/latest`. [V]

| Tool | Version | License | Activist use without card or KYC | Role on event day |
|---|---|---|---|---|
| Finite.Computer | gated product | not stated | Unknown: sign-in, "Launch Code" signup, access request form only | Captain's own agent environment |
| Hermes Agent | v2026.9.11 | MIT | Software free; model needs an account or a custom endpoint | Captain vibe-coding agent |
| OpenClaw | 2026.9.4 | MIT per site and npm | Software free; needs an LLM key | Personal agent over chat apps |
| OpenCode | 1.18.30 | MIT | Software free; Zen models need an opencode.ai account | Terminal coding agent |
| Maple AI + Maple Proxy | proxy v0.3.2 | proxy MIT | **Yes**: anonymous ID + password, bitcoin-only. API needs Pro ($20/mo) | Private LLM backend |
| Tinfoil (backup) | npm `tinfoil` | n/a | No documented path: card checkout | Private LLM with audio and embeddings |
| nostr-tools | 2.25.2 | Unlicense | Yes, keys only | Identity, publish, NIP-17 DMs |
| @getalby/sdk (NWC) | 8.0.3 | MIT | Yes if the chosen wallet is non-KYC [I] | Invoices, zaps |
| Breez SDK Spark | 0.25.0 | MIT | End users yes [I]; developer needs emailed API key | In-app self-custodial wallet |
| Bitchat | v1.7.1 | public domain | Yes [I], app store install | Offline BLE mesh (separate app) |

### Finite.Computer [V]
- What it is: "making frontier AI accessible to non-developers"; they "run in-person training and craft beautifully simple software" `[finite]`. With HRF it runs Agent Camps and built "our customized Hermes-powered app", which since May 2026 can run on a TEE-enclosed model instead of "a frontier corporate model, where Anthropic or OpenAI can read all of their prompts" `[jod]`.
- Setup: not self-serve. On Wednesday, ask the organizers whether captains will have Finite access and which model endpoint it uses.
- Gotchas: the TEE provider is not named publicly [I: plausibly Maple or Tinfoil]. If the captain codes in Finite, keep our repo agent-readable (`AGENTS.md`, small files).

### Hermes Agent (Nous Research) [V] `[hermes-docs]` `[hermes-cfg]` `[hermes-gh]`
```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
hermes setup --portal                      # Nous Portal OAuth, or skip and use a custom provider
hermes config set model custom/your-model  # after adding providers.custom in ~/.hermes/config.yaml
```
```yaml
providers:
  custom:
    base_url: "http://localhost:8080/v1"   # e.g. Maple Proxy
    api_key: "${OPENAI_API_KEY}"
```
- Gotchas: GitHub tags use dates (v2026.9.11) while blogs cite v0.21.x `[hermes-gh]`. It is an always-on agent with system access and 20+ gateways (Signal, WhatsApp, Telegram, SMS): never link a captain's real messaging account on venue WiFi [I]. For local endpoints set `local: true` to extend timeouts `[hermes-cfg]`.

### OpenClaw [V] `[openclaw]` `[openclaw-npm]`
```bash
npm i -g openclaw        # engines: node >=24.16.0 <25 || >=26.1.0
openclaw onboard         # choose provider; custom OpenAI-compatible endpoints supported
```
- Gotchas: Node 24+ conflicts with our Node 18+ kit, so run it on a separate machine or nvm version. "Daily version checks only (telemetry can be disabled)": disable on activist machines. GitHub API reports license NOASSERTION though site and npm say MIT. Created by Peter Steinberger; viral from late January 2026 `[jod]`.

### OpenCode [V] `[opencode-docs]` `[opencode-gh]`
```bash
curl -fsSL https://opencode.ai/install | bash      # or: npm i -g opencode-ai
```
```json
{ "$schema": "https://opencode.ai/config.json",
  "provider": { "maple": { "npm": "@ai-sdk/openai-compatible", "name": "Maple",
    "options": { "baseURL": "http://localhost:8080/v1" },
    "models": { "gpt-oss-120b": { "name": "gpt-oss-120b" } } } } }
```
- Gotchas: repo moved from `sst/opencode` to `anomalyco/opencode` (Homebrew tap `anomalyco/tap/opencode`). Keys land in `~/.local/share/opencode/auth.json`. Zen models require signing in at `opencode.ai/auth`.

### Maple AI and Maple Proxy [V] `[maple-proxy]` `[maple-proxy-intro]` `[maple-2]` `[opensecret]`
```bash
docker run -p 8080:8080 -e MAPLE_BACKEND_URL=https://enclave.trymaple.ai ghcr.io/opensecretcloud/maple-proxy:latest
curl http://localhost:8080/v1/models -H "Authorization: Bearer $MAPLE_API_KEY"   # key from Maple dashboard
# any OpenAI client: baseURL http://localhost:8080/v1, stream: true
```
- Easiest path: Maple desktop app, API Management, Local Proxy tab, "Start Proxy" (creates a key automatically).
- Models and price per million tokens (in / out): gpt-oss-120b $1.50 / $2.50; llama3-3-70b $3.50 / $5.50; kimi-k2-6 and deepseek-v4-pro $3 / $10.50; qwen3-vl-30b $2.50 / $8 (vision). No audio model listed.
- Plans: Free $0, Starter $5.99, Pro $20, Team $30/seat `[opensecret]`; Max $100 `[maple-max]` [I: snippet]. API needs "Pro, Team, or Max"; extra credits in $10 increments.
- No-KYC: "Generate a unique ID, create a password, and pay exclusively with Bitcoin" (Maple 2.0, 2025-11-12). Bitcoin gets a 10% discount.
- Gotchas: "Maple currently supports streaming responses only", so the kit's LLM client must parse SSE even for short calls. "In production, clients should provide their own API keys": for a public demo, put a tiny server in front that injects the key and rate-limits, never ship the key in the PWA [I]. CORS needs `MAPLE_ENABLE_CORS=true`.

### Tinfoil (private inference backup) [V] `[tinfoil]`
- `npm install tinfoil`; OpenAI-compatible endpoint `https://inference.tinfoil.sh/v1` with `TINFOIL_API_KEY`; SDKs are "drop-in replacements for OpenAI clients with automatic security verification"; the CLI can run as a reverse proxy.
- Offers chat, vision, audio (speech-to-text, TTS), embeddings, and document processing models, which Maple does not list.
- Gotcha: API key requires payment details at checkout (usage billed). Enclave.free uses it via `tinfoil-proxy` `[enclave-gh]`.

### nostr-tools [V] `[nostr-tools]`
```bash
npm i nostr-tools@2.25.2
# import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure'
# import { wrapEvent, unwrapEvent } from 'nostr-tools/nip17'   (gift-wrapped DMs on NIP-44 + NIP-59)
```
- Repo modules confirmed: `nip17` (wrapEvent, wrapManyEvents, unwrapEvent, unwrapManyEvents), `nip44` (getConversationKey, encrypt, decrypt, v2), `nip59`, `nip46` (BunkerSigner), `nip47` (parseConnectionString, makeNwcRequestEvent), `nip49`, `nip57`, `nip98`.
- Gotchas: README examples import from `@nostr/tools/...` (JSR name); npm subpaths are `nostr-tools/...` [I]. GitHub Releases is stale (v2.0.0, 2023), so trust npm. README shows `useWebSocketImplementation` for runtimes without a global WebSocket. Use NIP-17, not legacy `nip04` [I]. Alternative: `@nostr-dev-kit/ndk` 3.0.3.

### Nostr Wallet Connect via @getalby/sdk [V] `[alby]`
```bash
npm i @getalby/sdk
# import { LN, USD } from "@getalby/sdk/lnclient"
# const req = await new LN(nwcUrl).requestPayment(USD(1)); req.onPaid(unlock)
```
- `NWCClient` from `@getalby/sdk/nwc`: `payInvoice`, `subscribeNotifications`, `fromAuthorizationUrl` (Alby Hub approval popup). Connection secrets come from Alby Hub, coinos, Primal, lnwallet.app, Yakihonne.
- Gotchas: the `nostr+walletconnect://` URL is a spending credential; the docs load it from "some (encrypted) storage", and a wallet-side budget is wise [I]. The README's no-build example imports from `esm.sh`, which breaks our no-CDN rule: bundle it. Custody and KYC depend entirely on the wallet chosen.

### Breez SDK Spark [V] `[breez]`
```bash
npm install @breeztech/breez-sdk-spark     # Node >= 22; browser via WASM
# API key: form at https://breez.technology/request-api-key/  -> "The API key is sent to the provided email address."
```
- Gotchas: "The Breez SDK API key must be set for the SDK to work"; turnaround unknown. Browser CSP must allow `'wasm-unsafe-eval'` (Zuka's production CSP comment explains exactly this) `[zuka]`. Self-custody means seed backup UX [I]. Reference app: `github.com/breez/glow-web`.

**NWC vs Breez for a one-day build [I]:** NWC is faster: no API key, no WASM, about five lines, and the wallet lives in another app. Choose Breez only if the captain needs a self-custodial wallet inside the app with no second install (Pathos and Zuka did this, both 2nd place). If Breez might be needed, request the key this week.

### Bitchat [V] `[bitchat]`
- iOS and macOS (App Store), Android (Play Store). Bluetooth LE mesh with Noise encryption, up to 7 hops; Nostr fallback uses "app-specific private-envelope encryption" that is "not NIP-17, NIP-44, or NIP-59 compatible". No SDK or web client. Public domain.
- Setup: install from the store. For agents, Freedom Skills ships a `bitchat` skill `[fskills]`.
- Gotchas: a web PWA cannot join the mesh [I]; plan "hand off to Bitchat", not "integrate". Pathos's hzrd149 got BLE Bitchat working at edition I with native work `[soapbox]`.

### Freedom Skills (HRF AI Fund grantee) [V] `[fskills]` `[fund]`
- Agent Skills for `bitchat`, `nostr-cli`, `signal-cli`, `mdk-agent-wallet` (Lightning), `wayback-archive`, `timelock-sh`, `p2p-transfer-filepizza`, `skillspector`. Good to load into a captain's Hermes or OpenClaw.
- Gotcha: GitHub API detects no license, so install as skills; do not copy its code into our MIT kit.

## 5. Problem-archetype bank

Kit keys: **S** = `src/starter` (offline PWA, private LLM client, i18n/RTL, panic wipe). **R** = `src/rails` (Nostr identity/publish/DM, NWC Lightning). **O** = `scripts/opsec-audit.sh`. Scale claims are phrasings a captain could use; the captain supplies the real number. All archetypes are [I], grounded in the cited precedents.

**A1. One-tap SOS and check-ins** (precedent: Stringer Safety, 1st ed. I `[hrf-i-win]`)
- User: freelance journalist or organizer in a hostile area, plus 3 to 5 trusted contacts.
- Scale claim: "every stringer in [region] works without a newsroom safety desk."
- MVP: timed check-in, one big SOS button, NIP-17 encrypted alert with last known location, offline queue, panic wipe.
- AI angle: private LLM turns a 10-second note into a structured situation report plus next steps from the captain's playbook.
- Kit: S, R, O.

**A2. Anonymous voice: publish without being identified** (Zuka, 2nd ed. II `[hrf-ii-win]`)
- User: dissident or exiled journalist whose face, voice, or writing style is known to the regime.
- Scale claim: "people in [country] are jailed for posts; the diaspora audience is N."
- MVP: persona keypair, compose, EXIF strip, AI rewrite, publish to several relays, zap to support.
- AI angle: style-neutralizing rewrite and translation on a private model; optional avatar.
- Kit: R, S, O.

**A3. Evidence locker for abuses** (China Dissent Monitor grant `[fund]`)
- User: documentation teams and witnesses.
- Scale claim: "incidents are lost when phones are seized."
- MVP: offline capture (photo, audio, text, time, place), SHA-256 hash, EXIF strip, encrypted store, panic wipe, publish only the hash to Nostr as a public timestamp.
- AI angle: extract who/what/where/when into an incident schema, translate, tag violation type, flag duplicates.
- Kit: S, R, O.

**A4. Political prisoner case files: private RAG** (Enclave grant, Sanctum ed. I `[fund]` `[sn-i]`)
- User: lawyers and advocates carrying many cases; families in the first days after an arrest.
- Scale claim: an estimated one million political prisoners worldwide rely on advocates (Enclave framing) [I: snippet of `[fund]`].
- MVP: upload PDFs, embed, ask questions with citations, one-page case summary, "first 72 hours" guide in the family's language.
- AI angle: RAG over sensitive files on a TEE model (Maple, or Tinfoil for embeddings).
- Kit: S, O.

**A5. Corruption and sanctions document analysis** (Corruption Disrespector, 3rd ed. I)
- User: anti-corruption investigators, journalists.
- Scale claim: "registries and leaks in five languages and two scripts."
- MVP: upload, entity extraction (people, companies, addresses, amounts), alias and transliteration merge, force graph, CSV export.
- AI angle: schema-constrained extraction and cross-script name matching.
- Kit: S, O.

**A6. Uncensorable aid to activists and prisoners' families** (Pathos/Agora, Zuka wallet)
- User: families with frozen accounts, donors abroad.
- Scale claim: "N families cannot receive diaspora support through banks."
- MVP: Nostr campaign page, Lightning invoice via NWC, live paid confirmation, receipt without KYC.
- AI angle: summarize and sanity-check requests, translate appeals, plain-language wallet onboarding.
- Kit: R, S, O.

**A7. Education under bans and trainer tools** (Tarkus 1st, Roshan 3rd, ed. II)
- User: girls barred from school; trainers of nonviolent movements.
- Scale claim: Roshan's 2,000-student pilot `[hrf-ii-win]`; CANVAS trained 16,000 activists in 52 countries [I: snippet].
- MVP: offline PWA with preloaded lessons, AI quizzes and explanations, RTL (Dari, Pashto, Farsi), disguise screen and panic wipe; or a trainer room with live Q&A.
- AI angle: culturally adapted lesson generation, adaptive quizzing, comprehension-gap feedback.
- Kit: S (core), R optional.

**A8. Internet shutdown coordination** (Pathos Bitchat mode `[soapbox]`)
- User: organizers during blackouts.
- Scale claim: "shutdowns hit during every election and protest."
- MVP: offline-first board that syncs through Nostr when online and QR or file export when not; hand-off button to Bitchat.
- AI angle: summarize the backlog and triage urgent items when connectivity returns.
- Kit: S, R, O.

**A9. State disinformation triage** (OpenCCP, Scorecard ed. I; HRF theme "AI-generated propaganda, deepfakes" `[air]`)
- User: fact-checkers and exile media.
- Scale claim: "coordinated campaigns reach N million before elections."
- MVP: paste text, URL, or screenshot; extract claims; match against a small seeded narrative set; output a rebuttal card in two languages; publish to Nostr.
- AI angle: claim extraction, clustering, translation. Skip true deepfake detection in 1.5 days.
- Kit: S, R, O.

**A10. Transnational repression self-audit** (recurring HRF theme)
- User: exiles with bounties or families pressured at home.
- Scale claim: "bounties on N overseas activists."
- MVP: guided checklist plus private-model review of a footprint the user pastes in (bios, handles, photos), producing a ranked hardening plan and a move to key-based identity.
- AI angle: find doxxable details in pasted data; never scrape.
- Kit: S, R, O.

**A11. Voice-first rights information for low-literacy users** (HRF theme: accessibility)
- User: people who cannot read the official language.
- Scale claim: "rights hotlines go unused because of language."
- MVP: push to talk, speech to text, answer from a vetted FAQ via RAG, speech out, cached offline FAQ.
- AI angle: STT, TTS, translation (Tinfoil lists audio models `[tinfoil]`; Maple lists none `[maple-proxy]`).
- Kit: S, O.

**A12. Advocacy outreach to lawmakers** (Mindy ed. I; the event is at NED in DC)
- User: diaspora advocates lobbying Congress or parliaments.
- Scale claim: "sanctions and prisoner releases move with legislator attention."
- MVP: ingest public statements for a list of representatives, score stance with citations, draft letters and call scripts.
- AI angle: summarization and stance classification with sources.
- Kit: S. Low opsec risk because inputs are public.

## 6. Five things that make a judge remember a team [I, derived from V quotes]

1. **One button for a frightening problem.** Sundaram: "This makes a complex personal security problem very simple to manage with a one-button touch" `[hrf-i-win]`. Open the demo on the button.
2. **Real people using it now.** López: "we have a tested platform" `[hrf-i-win]`; Pathos had "over 100 users" in its first day `[soapbox]`; Roshan was "preparing deployment to 2,000 female students" `[hrf-ii-win]`. Name the users and the date.
3. **AI that amplifies humans rather than replacing them.** Vaca-Daza: "AI enhances the training experience while the trainer builds the trust and legitimacy to transfer the skills" `[hrf-ii-win]`; Tarkus: "Human trainer in front. AI synthesis behind." `[tarkus]`
4. **The captain's moral stake, said plainly.** Kanimba: "Zuka was built in honor of all the brave Rwandans who have been imprisoned, disappeared and killed for speaking the truth" `[hrf-ii-win]`.
5. **It travels beyond one movement and keeps living.** Chekhovich: "This tool is useful not only for anti-corruption investigations...journalism, human rights research" `[hrf-i-win]`; Mahboob: "Education should not disappear just because a classroom closes" `[hrf-ii-win]`. Every podium site with a URL is still up.

## 7. STATUS

**Verified this session:** III logistics and the absence of named captains or judges; the $50k to $25k prize cut; the submission form wording in site history; both edition rosters and podium details; live status of all six URLs (five up, `enclave.free` unresolvable); Kyntab and Agora successor products; the Tarkus and Zuka stacks from their HTML; tool versions, install commands, Maple pricing and anonymous signup, the Breez API key requirement, OpenClaw's Node 24 floor, Bitchat's NIP incompatibility.

**Inferred:** that Luma's 1:30 PM pitch time overrides the site template; that the organizers tolerate prior code; that NED's "democracy hackathon" is this event; the likely problem areas; the edition I captain-to-project mapping; NWC being faster than Breez; all archetypes and judge-memory items; the npm subpath for nostr-tools.

**Not found:** III captains, judges, themes, and written rules; pitch length; edition II's five non-podium projects; the edition I captains behind Mindy, Aman, Scorecard, Sanctum, OpenCCP; Finite pricing or access terms; the TEE provider behind Finite's app; Breez API key turnaround.

**Open questions:** the three organizer emails in section 3. Ask the organizers on Wednesday whether captains arrive with Finite agents and which model. Request a Breez API key now if an in-app wallet is plausible. Decide whether a $20 Maple Pro account (bitcoin, anonymous) is worth pre-buying for the private LLM path.

## Source index

- `[luma3]` https://luma.com/9xz32f1a . `[luma2]` https://luma.com/10vqmhod
- `[site]` https://www.aihackforfreedom.org/ and https://www.aihackforfreedom.org/apply . `[site-sched]` schedule.html in `[repo]`
- `[repo]` https://github.com/AI-Freedom-Lab/aihackforfreedom (commits f4632a8, 706b624, 3a8588f, c9c935c; `.well-known/nostr.json`; `h4f4/index.html`)
- `[hrf-i-pre]` https://hrf.org/latest/hrf-sponsors-ai-hack-for-freedom-in-austin-tx-jan-17-18/
- `[hrf-i-win]` https://hrf.org/latest/announcing-the-ai-hack-for-freedom-hackathon-winners/
- `[sn-i]` https://stacker.news/items/1415288
- `[hrf-ii-pre]` https://hrf.org/latest/hrf-sponsors-second-edition-of-ai-hack-for-freedom-in-nashville-tn-may-9-10/
- `[hrf-ii-win]` https://hrf.org/latest/announcing-the-winners-of-ai-hack-for-freedom-ii/
- `[soapbox]` https://soapbox.pub/blog/building-pathos/
- `[fund]` https://hrf.org/latest/hrfs-ai-fund-supports-10-innovative-projects/ . `[air]` https://hrf.org/program/ai-for-individual-rights/
- `[jod]` https://www.journalofdemocracy.org/online-exclusive/how-ai-agents-are-empowering-human-rights-defenders/ (mirror https://hrf.org/latest/how-ai-agents-are-empowering-human-rights-defenders/)
- `[off26]` https://oslofreedomforum.com/event/oslo-freedom-forum-2026/2026-off-speakers/
- `[ned-wilson]` https://www.ned.org/damon-wilson-commencement-address-address-university-of-maryland-school-of-public-policy/
- `[ned-awards]` https://www.ned.org/ned-honors-global-defenders-of-fundamental-freedoms-at-2026-democracy-awards/ (snippet only)
- `[gladstein-x]` https://x.com/gladstein/status/2044156714065223901 (snippet only)
- `[nostr-agentcamp]` Nostr event `8a284b0342c5e75d92a7f24e41e78ce038ca30c41fb319297249fc3ff10bf0be` (2026-09-11), read from wss://search.nos.today
- `[stringer]` https://stringersafety.com . `[kyntab]` https://kyntab.com . `[agora]` https://pathos.place (redirects to https://agora.spot/)
- `[cd]` https://www.corruptiondisrespector.com/ . `[tarkus]` https://tarkus-phi.vercel.app/ . `[zuka]` https://zuka.live/
- `[enclave-gh]` https://github.com/enclave-free/enclave.free (site https://enclave.free does not resolve)
- `[finite]` https://finite.computer
- `[hermes-docs]` https://hermes-agent.nousresearch.com/docs/ . `[hermes-cfg]` https://hermes-agent.nousresearch.com/docs/user-guide/configuration . `[hermes-gh]` https://github.com/NousResearch/hermes-agent
- `[openclaw]` https://openclaw.ai/ . `[openclaw-npm]` https://www.npmjs.com/package/openclaw
- `[opencode-docs]` https://opencode.ai/docs/ and https://opencode.ai/docs/providers/ . `[opencode-gh]` https://github.com/anomalyco/opencode
- `[maple-proxy]` https://blog.trymaple.ai/maple-proxy-documentation/ . `[maple-proxy-intro]` https://blog.trymaple.ai/introducing-maple-proxy-the-maple-ai-api-that-brings-encrypted-llms-to-your-openai-apps/
- `[maple-2]` https://blog.trymaple.ai/maple-2-0-now-with-live-data/ . `[opensecret]` https://blog.opensecret.cloud/maple-private-ai-for-work-and-personal/ . `[maple-max]` https://blog.trymaple.ai/meet-maple-ai-max-the-most-powerful-private-ai-plan-yet/ (snippet only)
- `[tinfoil]` https://docs.tinfoil.sh/quickstart.md , https://docs.tinfoil.sh/get-api-key.md , https://docs.tinfoil.sh/llms.txt
- `[nostr-tools]` https://github.com/nbd-wtf/nostr-tools and https://www.npmjs.com/package/nostr-tools
- `[alby]` https://github.com/getAlby/js-sdk (README, docs/nwc.md)
- `[breez]` https://sdk-doc-spark.breez.technology/guide/getting_started.html and https://sdk-doc-spark.breez.technology/guide/install_javascript.html
- `[bitchat]` https://github.com/permissionlesstech/bitchat . `[fskills]` https://github.com/brenorb/freedom-skills
