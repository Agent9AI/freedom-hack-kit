# Agent Assignment Prompts

The exact prompts the coordinator gave each swarm agent on 2026-09-13 (swarm `swarm-1789348101872-peltir`). Re-use them verbatim to re-run an agent, or edit and re-launch. All agents were `general-purpose` Claude Code subagents working from `<repo root>`.

A mid-run checkpoint message was later sent to every agent: write work in progress to disk immediately, save incrementally, do not run git, do not create root-level files. The `intel` agent was also told not to overwrite `docs/research/COORDINATOR_FINDINGS.md`, and `runbook` was told to link to `docs/setup/ACCOUNTS.md`.

---

## intel

```text
You are the `intel` researcher in a ruflo hierarchical swarm (swarm-1789348101872-peltir) preparing Terry, a developer, for AI Hack for Freedom III (Washington DC, pitches Fri Sep 25 2026, 1:30 PM ET). Work from <repo root>. FIRST read docs/BRIEF.md fully; its house rules are binding (no em-dashes, no commits, no secrets).

Your only output file: docs/research/INTEL.md. Do not touch other paths.

Research and write these sections, citing a URL for every factual claim and tagging each as VERIFIED (you read the source) or INFERRED:

1. Edition III captains and judges. Search HRF (hrf.org/latest), AI Freedom Lab (aifreedomlab.org, their X and Nostr), NED, UMD School of Public Policy, Bitcoin Park, Luma (luma.com/9xz32f1a), and news for any announced captains, judges, or themes. For each person found: country, organization, public statements hinting at the problem they might bring. NEVER invent names. If nothing is announced, say so plainly and instead list the likely captain pool based on HRF's Oslo Freedom Forum speakers and past captains.
2. Every team from editions I (Austin, Jan 2026) and II (Nashville, May 2026), not just podium: project, captain, what was built, stack, live URL status (fetch the URLs: stringersafety.com, pathos.place, corruptiondisrespector.com, tarkus-phi.vercel.app, zuka.live, enclave.free). Note what the winners' live sites actually look like and do.
3. Rules signal: anything about pre-existing code, AI tool use, open-source licensing, demo length, or submission format from any edition. If unknown, say unknown and draft 3 precise questions Terry should email the organizers.
4. Toolchain quick-starts (verify current versions/commands): Finite.Computer (what it is; HRF named it as how Hermes/OpenClaw/OpenCode were deployed at edition II), Hermes Agent (Nous Research), OpenClaw, OpenCode, Maple AI (encrypted AI: does it expose an OpenAI-compatible API or proxy? base URL, auth, pricing), nostr-tools (current version, NIP-17/NIP-44 support), Nostr Wallet Connect (@getalby/sdk) vs Breeze SDK (which is faster to integrate in one day), Bitchat. For each: 3-line setup, gotchas, and whether an activist could use it without a credit card or KYC.
5. Problem-archetype bank: 10 to 12 plausible captain problems grounded in past captains and HRF AI Fund themes (safety/SOS, censorship-resistant publishing, evidence/documentation of abuses, financial access, education under bans, anonymous identity, translation/low-literacy access, corruption document analysis, political prisoner advocacy, detecting state disinformation, etc.). For each: the user, the scale claim a captain could make, a 1.5-day MVP sketch, the AI-integration angle (judging criterion 2), and which prep kit pieces apply: `src/starter` (offline PWA + private LLM client + i18n/RTL + panic wipe), `src/rails` (Nostr identity/publish/DM + NWC Lightning), `scripts/opsec-audit.sh`.
6. Five things that would make a judge remember a team, derived from the winners' quotes.
7. STATUS section: what is verified vs inferred, and open questions.

Keep INTEL.md under 500 lines. When done, run: `cd <repo root> && ruflo memory store --namespace ai-hack-freedom --key intel-done --value "<2-sentence summary incl. whether captains were found>"`.

Final report to the coordinator, under 250 words: whether captains/judges were found (names only if verified), the single most important rules unknown, the top 3 archetypes you would prep for, and any tool that turned out unusable.
```

---

## opsec

```text
You are the `opsec` security architect in a ruflo hierarchical swarm (swarm-1789348101872-peltir) preparing a reusable kit for AI Hack for Freedom III, where developers build tools for activists living under authoritarian regimes in about 1.5 days. Work from <repo root>. FIRST read docs/BRIEF.md fully; its house rules are binding (no em-dashes, no commits, no secrets).

Your paths only: docs/security/, scripts/opsec-audit.sh, tests/opsec/. Do not touch src/.

Deliverable 1: docs/security/ACTIVIST_THREAT_CHECKLIST.md
- Threat actors and what they actually do: state network surveillance and DPI, device seizure at checkpoints, forced unlock, app-store removal, platform deplatforming, payment blocking, subpoenas or breaches of hosted AI/LLM providers and their logs, infiltrated group chats, adversary-supplied documents carrying prompt injection into AI agents, AI output that leaks identity.
- A concrete checklist for ANY app built at the event, each item tagged: `5-MIN` (do it Thursday), `2-HR`, or `OUT OF SCOPE for 1.5 days (say so in the pitch)`. Cover: zero analytics/telemetry, zero third-party runtime requests (fonts, CDNs, maps tiles), HTTPS only, minimal data retention, local-first storage, panic wipe, no PII in logs or error reporters, key management UX for Nostr nsec and wallets, LLM provider choice (local vs Maple-style confidential compute vs hosted; what each provider can see), prompt-injection handling when AI reads untrusted docs, metadata in uploaded photos/PDFs (EXIF strip), offline and low-bandwidth behavior, censorship circumvention options (Tor onion service, mirrors, Nostr as distribution), multilingual and RTL safety text.
- An "Honest pitch claims" section: words you may not use unless literally true ("encrypted", "anonymous", "untraceable", "private AI", "censorship-proof"), with the accurate alternative phrasing.
- Keep it under 400 lines, scannable, tables welcome.

Deliverable 2: scripts/opsec-audit.sh
- Bash, works on macOS (BSD grep/sed) AND Linux. `set -euo pipefail`. Usage: `scripts/opsec-audit.sh <dir> [--strict]`. Validate the argument: must exist, must be a directory, resolve it to an absolute path, reject empty. Skip node_modules, .git, .wrangler, coverage.
- Scan and report with severity (HIGH/MED/LOW), file:line, and a one-line fix hint for: analytics/telemetry SDKs (google-analytics, gtag, googletagmanager, segment, mixpanel, posthog, sentry, hotjar, amplitude, datadog rum, facebook pixel), external CDN or font URLs in html/css/js/ts (fonts.googleapis, fonts.gstatic, cdn.jsdelivr, unpkg, cdnjs, code.jquery), plaintext http:// URLs (excluding localhost/127.0.0.1), likely secrets (sk-..., AKIA..., ghp_..., xoxb-, private key PEM headers, nsec1..., xprv), `.env` files that are not `.env.example`, console.log/console.error lines mentioning key|nsec|seed|password|token|mnemonic, localStorage.setItem with nsec|seed|mnemonic|privkey, and `.map` source maps inside dist/build output.
- Exit 0 if clean, 1 if any HIGH (or any finding with --strict), 2 on usage error. Print a summary count line.

Deliverable 3: tests/opsec/test-opsec-audit.sh
- Creates fixtures in a mktemp dir (clean project, project with gtag, project with nsec1 in localStorage, project with Google Fonts, bad usage), runs the audit, asserts exit codes and that expected findings appear. Cleans up with a trap. Run it until it passes. Also run shellcheck if installed (skip gracefully if not).

When done run: `cd <repo root> && ruflo memory store --namespace ai-hack-freedom --key opsec-done --value "<2-sentence summary>"`.

Final report to the coordinator, under 250 words: files created, test result output (pass/fail counts, pasted), known false positives, and the 5 checklist items you consider non-negotiable for any team.
```

---

## starter

```text
You are the `starter` coder in a ruflo hierarchical swarm (swarm-1789348101872-peltir) building a reusable kit for AI Hack for Freedom III. On Thursday morning an activist captain and a developer will copy this folder and have a working, deployable, private AI app shell within 5 minutes, then build their actual idea on top. Work from <repo root>. FIRST read docs/BRIEF.md fully; its house rules are binding: no em-dashes, no git commits, no secrets, and DO NOT run Ollama or download local models on this Mac (tests use mocks).

Your paths only: src/starter/ (a fully standalone package with its own package.json; tests live in src/starter/tests/). Do not touch anything else.

Build:
1. Stack: Vite + TypeScript. Choose vanilla TS or Preact (justify in README in one line). Target: shell JS under 50 KB gzipped. Terry's standing value is "lightning fast": measure and report the real gzipped size after build.
2. Offline-first PWA: web manifest, installable, service worker caching the app shell (vite-plugin-pwa or a small hand-written SW, your call), clear offline indicator in the UI.
3. Private LLM client at src/starter/src/llm/: OpenAI-compatible `/chat/completions` with streaming (SSE parsing), AbortController timeout, retries off by default, typed interfaces. Provider presets in a config file: `local-ollama` (http://localhost:11434/v1), `llama-cpp` (http://localhost:8080/v1), `maple` (base URL left as a placeholder constant with a TODO to confirm from Maple docs; do not guess a real URL), `custom`. Base URL, model, and API key are set at runtime in a Settings panel and stored only locally; never hardcoded. When offline or unreachable, degrade with a clear message instead of hanging. Add a `systemPrompt` slot plus a tiny "untrusted content" wrapper that fences user-supplied documents to reduce prompt injection, with a comment explaining its limits.
4. i18n + RTL: tiny dictionary i18n (no heavy library), `dir` switches automatically for RTL languages. Ship UI-chrome strings for en, es, fa, ar, ru; mark non-English as machine-drafted, needs native review.
5. Local data + panic wipe: IndexedDB (or localStorage for the demo) for app data, an Export JSON button, and a Panic Wipe button that clears localStorage, sessionStorage, IndexedDB databases, Cache Storage, and unregisters service workers, then reloads to a blank state.
6. Zero third-party runtime requests: system font stack, no CDNs, no analytics, no external images.
7. Deploy configs (do not deploy): Dockerfile (multi-stage build, static serve via caddy or nginx), docker-compose.yml, and wrangler.jsonc for a Cloudflare Workers static-assets deploy with SPA fallback. `.env.example` with placeholder names only.
8. README.md (this one is required for a template): a "5-minute fork" section, how to point it at a local model on a different machine, how to deploy both ways, and a "what this kit does NOT protect against" list.
9. Tests (vitest, in src/starter/tests/): LLM client with mocked fetch (streaming chunks assembled correctly, HTTP error surfaced, timeout aborts, offline path), i18n RTL switching, panic wipe clears storage (jsdom/happy-dom with fake-indexeddb if needed).

Verify before reporting: `cd src/starter && npm install && npm test && npm run build`. Then if <repo root>/scripts/opsec-audit.sh exists (another agent is writing it), run it against src/starter and fix any HIGH findings in your code; if it does not exist yet, say so. Keep every file under 500 lines.

When done run: `cd <repo root> && ruflo memory store --namespace ai-hack-freedom --key starter-done --value "<2-sentence summary incl. gzipped JS size>"`.

Final report to the coordinator, under 250 words: framework chosen, measured gzipped bundle size, pasted test summary line (pass/fail counts), build result, opsec audit result, and anything untested (for example real Maple endpoint, real SW offline behavior in a browser).
```

Note added after launch: the Maple Proxy local default is `http://localhost:8080/v1` (verified in [Maple Proxy docs](https://blog.trymaple.ai/maple-proxy-documentation/)), which collides with the `llama-cpp` preset port.

---

## rails

```text
You are the `rails` coder in a ruflo hierarchical swarm (swarm-1789348101872-peltir) building "freedom rails" for AI Hack for Freedom III: drop-in TypeScript modules for censorship-resistant publishing (Nostr) and uncensorable money (Lightning). Two of six past podium teams (Pathos, Zuka) were built on exactly this, so teams that already have it working save half a day. Work from <repo root>. FIRST read docs/BRIEF.md fully; its house rules are binding: no em-dashes, no git commits, no secrets.

Your paths only: src/rails/ (a fully standalone ESM package with its own package.json; tests in src/rails/tests/). Do not touch anything else.

Before coding, check current versions with `npm view nostr-tools version` and `npm view @getalby/sdk version`, and read the installed type definitions rather than relying on memory, since these APIs change.

Build:
1. src/rails/src/nostr/
   - Keys: generate, import from nsec/hex, export npub/nsec (nip19). Never log secret keys; add a `redact()` helper.
   - Relay pool: configurable relay list, connect with timeout, publish to many and return per-relay ack results (so the UI can say "published to 3 of 5 relays").
   - Publish a kind-1 note with optional tags; subscribe with filters and an unsubscribe handle; fetch profile (kind 0).
   - Private DMs: NIP-17 gift-wrapped DMs using NIP-44 encryption if the installed nostr-tools supports it. Only fall back to NIP-04 if unavoidable, with a loud warning in code and README that NIP-04 leaks metadata.
2. src/rails/src/bitcoin/
   - Nostr Wallet Connect (NIP-47) client: connect from a `nostr+walletconnect://` URI, `makeInvoice`, `payInvoice`, `getBalance`. Use @getalby/sdk or nostr-tools nip47, whichever is lighter and currently maintained.
   - Lightning Address to invoice (LNURL-pay: resolve `name@domain`, respect min/max sendable, request invoice for an amount).
   - NIP-57 zap request event builder.
   - The app never holds a seed phrase. State this in the README, along with a short "Breeze SDK instead?" section with pros and cons (do not integrate it).
3. Typed public API re-exported from src/rails/src/index.ts, with input validation at the boundary (bad npub, malformed NWC URI, negative amounts, invalid Lightning address).
4. README.md: copy-paste snippets for the 6 most common hackathon uses (create identity, post, read a feed, send a private DM, request a tip, pay an invoice), a recommended default relay list, and key-storage guidance for non-technical users.
5. Tests (vitest, src/rails/tests/): fully offline. Mock WebSocket or the relay pool and mock fetch for LNURL. Cover key round-trips, publish ack aggregation, DM encrypt then decrypt round-trip, NWC URI parsing and validation, LNURL min/max enforcement, and zap request shape.
6. Optional live smoke script (scripts inside src/rails/, NOT run by npm test): read-only subscribe to one public relay for 5 seconds. You MAY run it once to confirm connectivity. You must NOT publish any event to a public relay and must NOT make any real payment.

Verify before reporting: `cd src/rails && npm install && npm test && npm run build` (tsc to dist). Keep every file under 500 lines.

When done run: `cd <repo root> && ruflo memory store --namespace ai-hack-freedom --key rails-done --value "<2-sentence summary incl. nostr-tools version and DM NIP used>"`.

Final report to the coordinator, under 250 words: library versions used, whether NIP-17/NIP-44 DMs work, pasted test summary line, build result, live smoke result if run, and anything untested (for example a real NWC wallet).
```

---

## runbook

```text
You are the `runbook` planner in a ruflo hierarchical swarm (swarm-1789348101872-peltir) preparing Terry, an experienced AI-assisted developer (won "Most Creative" at a Cloudflare hackathon), for AI Hack for Freedom III. Work from <repo root>. FIRST read docs/BRIEF.md fully; its house rules are binding: no em-dashes, no git commits, no secrets.

Your paths only: docs/runbook/ and scripts/event-day-swarm.sh (plus tests/runbook/ for its test). Other agents are building, in parallel, `src/starter` (offline PWA + private LLM client + i18n/RTL + panic wipe), `src/rails` (Nostr identity/publish/DM + Nostr Wallet Connect Lightning), `scripts/opsec-audit.sh`, `docs/security/ACTIVIST_THREAT_CHECKLIST.md`, and `docs/research/INTEL.md`. Reference them by those paths; do not edit them.

Timeline facts: today is Sun Sep 13 2026. Wed Sep 23 welcome reception, build Thu Sep 24 and Fri Sep 25 morning, team pitches Fri 1:30 PM ET at NED, 1201 Pennsylvania Ave NW, Washington DC. Judging so far: scale of problem, integration of AI tools, quality of technical execution, adoption by users outside the team. Teams are 1 activist captain + 1 or 2 devs, and in edition II captains vibe-coded alongside devs.

Write:
1. docs/runbook/EVENT_DAY_RUNBOOK.md
   - T-10 to T-1 days: laptop and toolchain checklist (Node, ruflo, Claude Code, wrangler logged in to the right account, Vercel as a backup deploy target, a domain or subdomain ready), accounts to create in advance (Maple AI, a Lightning wallet with NWC such as Alby Hub or Coinos, a throwaway Nostr identity for demos), an offline copy of key docs, a phone hotspot as a network backup, chargers, and "dry-run the kit end to end once".
   - Wed reception: find the captain, run the intake, agree on scope before sleeping.
   - Thu hour by hour, 8 AM to late: go/no-go checkpoints at 11 AM (spec frozen), 2 PM (core loop works end to end), 6 PM (deployed to a real URL), 10 PM (a real outside user has tried it). Include a pre-written scope-cut ladder.
   - Fri: feature freeze 10:30 AM, final deploy 11:30 AM, opsec audit and a phone test by noon, record a backup demo video, two rehearsals, arrive 1:00 PM.
   - Failure playbooks: venue wifi down, LLM provider down (switch the base URL to a local model on another machine), deploy broken, captain and dev disagree on scope.
2. docs/runbook/CAPTAIN_INTAKE.md: a 20-minute interview script (the users and how many, their devices and connectivity, languages and literacy, the threat model and "what must never happen", what they use today, what success next month looks like in numbers, who outside the team will try it before Friday). End with a one-page spec template the answers fill in, saved as `docs/spec.md` on event day.
3. docs/runbook/PITCH_TEMPLATE.md: 3-minute and 5-minute versions. The captain tells the story and the scale; the dev runs a live demo on a phone; one slide per judging criterion; an explicit honest line about what was prepared beforehand (generic kit) vs built at the event; a QR code to the live URL; and a backup-video fallback.
4. docs/runbook/SUBMISSION_CHECKLIST.md: public MIT repo, live URL tested on a phone over cellular, README with a screenshot, backup demo video, opsec audit passing, secrets scan, and handoff notes so the captain can keep running it after the event (who holds the domain and hosting).
5. docs/runbook/SWARM_PLAYBOOK.md: when a swarm helps at this event and when it hurts. In a 1.5-day build with a captain co-coding, a swarm is for parallel scaffold, tests, opsec review, and i18n, not for product decisions. Include a cost note (it draws on the same Claude subscription that runs everything else, so cap agents), a recommended topology and agent roster, and how to use `scripts/event-day-swarm.sh`.
6. scripts/event-day-swarm.sh
   - First run `ruflo swarm init --help` and `ruflo memory store --help` to get the real flags; do not guess them.
   - Usage: `scripts/event-day-swarm.sh <spec.md> [--agents N] [--dry-run]`. Validate that the spec path exists, is a regular file, and resolves inside the project directory (reject path traversal). N defaults to 5, capped at 8.
   - Steps: init a hierarchical specialized swarm, store the spec content in ruflo memory namespace `event-build`, then print a ready-to-paste Claude Code prompt that spawns the build agents (architect, 2 coders, tester, opsec reviewer) with instructions to reuse src/starter and src/rails and run scripts/opsec-audit.sh before handoff. `--dry-run` prints the commands without executing them.
   - tests/runbook/test-event-day-swarm.sh: tests the dry-run and validation paths only (missing file, traversal attempt, bad N, happy path dry run). Run it until it passes. Do not start a real swarm in the test.

Keep each file under 500 lines and scannable. When done run: `cd <repo root> && ruflo memory store --namespace ai-hack-freedom --key runbook-done --value "<2-sentence summary>"`.

Final report to the coordinator, under 250 words: files created, the pasted test result, the exact ruflo flags you verified, and the 3 prep tasks Terry should do this week that only a human can do.
```
