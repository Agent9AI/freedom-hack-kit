# Private AI Starter

An offline-first, installable web app shell with a private LLM client, five UI languages (two right-to-left), local-only data, and a panic wipe. Copy the folder, point it at a model, build the captain's idea on top.

**Framework: vanilla TypeScript + Vite.** No UI framework because the shell is one screen and a settings dialog, and every kilobyte is a cost on a slow, watched connection.

Measured on the current build: **13.3 kB gzipped JS**, 1.7 kB CSS, 1.4 kB HTML (budget: 50 kB JS). Zero runtime dependencies. MIT licensed.

## 5-minute fork

Requires Node 20.19 or newer.

```bash
cp -R src/starter ../my-app && cd ../my-app
npm install
npm run dev            # http://localhost:5173
```

1. Open **Settings**, pick a provider, press **Fetch models**, pick a model, **Save**.
2. Say hello. Tokens stream in.
3. Rename the app: `index.html` `<title>`, `public/manifest.webmanifest` `name`, and `app.title` in `src/i18n/locales/*.ts`.
4. Build your feature in `src/ui/` (or replace `src/ui/chat.ts` entirely). Keep calling `createLlmClient()` from `src/llm`.
5. `npm test && npm run build`, then deploy (below).

| Path | What it is |
|---|---|
| `src/llm/` | OpenAI-compatible client: streaming SSE, timeouts, typed errors, provider presets (`providers.ts`), untrusted-document fence |
| `src/i18n/` | Dictionary i18n with automatic `dir="rtl"`; one file per language in `locales/` |
| `src/data/` | IndexedDB store, JSON export, panic wipe |
| `src/settings/` | Runtime settings, validated on load, stored only in this browser |
| `src/ui/` | Chat screen and settings dialog (plain DOM, `textContent` only) |
| `src/sw/` | Service worker template; the build writes `dist/sw.js` with a hashed precache list |
| `public/_headers`, `deploy/Caddyfile` | Security headers (CSP) for Cloudflare and Docker |
| `tests/` | Vitest: LLM client (mocked fetch), SSE, i18n, panic wipe, settings, third-party URL guard |

## Pointing it at a model

The browser calls the model server directly. That means three things must line up: the server allows this site's origin (**CORS**), the site's **CSP** `connect-src` allows the server's address, and the browser does not block **mixed content** (an HTTPS page calling plain HTTP on another machine).

### Presets

| Preset | Default base URL | Notes |
|---|---|---|
| Ollama | `http://localhost:11434/v1` | Default allowed origins include `http://localhost:*`, so `npm run dev` works. For a deployed site start Ollama with `OLLAMA_ORIGINS=https://your-app.example`. |
| llama.cpp | `http://localhost:8080/v1` | `llama-server -m model.gguf --host 127.0.0.1 --port 8080`. Check CORS with Fetch models. |
| Maple Proxy | `http://localhost:8080/v1` | Encrypted inference. Needs a paid Maple plan and API key. Start it in the desktop app (Settings, API Management, Local Proxy) or run `ghcr.io/opensecretcloud/maple-proxy`; add `-e MAPLE_ENABLE_CORS=true` so a browser can call it. Maple streams only, which is this client's default. Model IDs differ from the doc examples, so always use Fetch models. Source: Maple Proxy documentation (blog.trymaple.ai/maple-proxy-documentation). |
| Custom | empty | Any OpenAI-compatible `/v1` server. |

**Maple Proxy and llama.cpp both default to port 8080** and cannot run on the same port at once. Settings shows this note. Move one, for example `llama-server --port 8081`, and edit the base URL.

The API key is sent only as `Authorization: Bearer`, stored in `sessionStorage` (gone when the tab closes) unless "Remember the key" is ticked, and never included in exports.

### A model on a different machine

Pick one:

- **Everything on the LAN over HTTP (simplest at a venue).** Run the model host with `OLLAMA_HOST=0.0.0.0:11434` and `OLLAMA_ORIGINS=http://APP-HOST:8088`, serve the app from a LAN machine with Docker (bind `0.0.0.0`, see `docker-compose.yml`), set `CONNECT_SRC=http://MODEL-HOST:11434`, and open `http://APP-HOST:8088`. Trade-offs: traffic is readable by anyone on that network, and browsers disable service workers and install on plain HTTP, so there is no offline mode.
- **HTTPS to the model host (for a deployed URL).** Put TLS in front of the model server, for example a Tailscale HTTPS name or a reverse proxy with a certificate. Use that `https://.../v1` as the base URL, add it to `connect-src` in `public/_headers` (Cloudflare) or `CONNECT_SRC` (Docker), and allow the app origin in the server's CORS setting. If Ollama answers 403 behind a proxy, it may be rejecting the forwarded Host header while bound to loopback; bind it to `0.0.0.0` behind a firewall.

Chrome may ask for permission before a public site talks to devices on your local network. Answer Allow.

When anything fails, the app shows one of: not configured, offline (remote model while offline), unreachable (refused, CORS or CSP), timed out (30 s to first byte, 60 s of silence mid-stream), HTTP error with the server's message, or unreadable reply. It never hangs.

## Deploy

### Docker (self-host, Caddy)

```bash
docker compose up --build        # http://localhost:8088
```

Multi-stage build: Node builds `dist/`, the final image is Caddy with only static files, admin API off, read-only filesystem, all capabilities dropped except the one the Caddy binary needs. Variables (put them in a git-ignored `.env`):

| Variable | Purpose |
|---|---|
| `HOST_PORT` | Host port, default `8088` |
| `CONNECT_SRC` | Space-separated model origins for CSP `connect-src` |

An optional Ollama service sits behind a compose profile (`docker compose --profile llm up -d`). It does not start by default.

### Cloudflare Workers (static assets)

```bash
npm run build
npx wrangler login
npx wrangler deploy
```

`wrangler.jsonc` deploys `dist/` as an assets-only Worker with SPA fallback and `send_metrics: false` (also export `WRANGLER_SEND_METRICS=false`, since wrangler still prints its telemetry notice). Headers come from `public/_headers`. Before deploying, add your model's HTTPS origin to `connect-src` there. For CI, wrangler reads `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` from the environment; never commit them.

## Privacy features and how to extend them

- **Zero third-party requests.** System fonts, no CDN, no analytics, no external images. `tests/no-third-party.test.ts` fails the test run if someone adds an external URL to `src/`, `public/` or `index.html`.
- **Offline-first.** The service worker precaches the shell and serves it cache-first; it never touches cross-origin traffic, so model requests always go to the network. The header shows Online or Offline.
- **Panic wipe.** Two taps within 4 seconds. Clears localStorage, sessionStorage, cookies, every IndexedDB database, Cache Storage, and service worker registrations, each step independently with a 2 s cap, then reloads to the bare app root. Add anything new you store to `knownDatabases` or clear it in `beforeWipe`.
- **Export JSON.** Downloads settings (without the API key) and stored records through a local blob, with a generic file name.
- **Untrusted documents.** `buildUntrustedPrompt()` fences pasted text in a random-boundary tag and tells the model it is data. This reduces prompt injection; it does not stop it. Read the comment in `src/llm/untrusted.ts`.
- **Model output is rendered with `textContent` only.** Keep it that way; `innerHTML` with model output turns prompt injection into script injection.

### Adding a language

Copy `src/i18n/locales/es.ts`, translate, register it in `LOCALES` and `DICTIONARIES` in `src/i18n/index.ts`, and add the code to the `Locale` type. TypeScript refuses a dictionary with missing keys. RTL is automatic for `ar`, `fa`, `he`, `ur`, `ps`, `sd`, `ckb`, `dv`, `ug`, `yi`. **Spanish, Persian, Arabic and Russian strings are machine-drafted and need native review**; the UI says so until you set `machineDrafted: false`.

## What this kit does NOT protect against

- **A seized, compromised or unlocked device.** Malware, keyloggers, screen recording, shoulder surfing, or someone forcing the user to unlock.
- **Forensic recovery.** Deleting browser storage is not secure erasure. Data can survive on disk, in swap, hibernation files, and SSD remnants.
- **Traces outside this origin's storage.** Browser history, the Downloads folder (exports stay there), OS or browser sync and backups, crash reports, the installed home-screen icon, other browser profiles, other tabs until they reload.
- **The model host.** Whoever runs the model server or proxy can read prompts in plaintext and may log them. Maple encrypts from the proxy to its enclave; the proxy operator still sees plaintext.
- **Network observers.** They can see which hosts the device contacts, even over HTTPS. Plain HTTP on a LAN is fully readable and modifiable.
- **The hosting provider.** Cloudflare (or whoever hosts the files) sees visitor IPs and request metadata. Self-host if that matters.
- **Blocking and censorship** of the app's domain or the model host.
- **Prompt injection and wrong answers.** The untrusted fence is a speed bump, and models hallucinate. Never let model output trigger actions without a human confirming.
- **Script injection added later.** An API key in browser storage is readable by any script running on this origin. The CSP helps; unsafe code you add can still undo it.
- **Build-time supply chain.** Dev dependencies (Vite, Vitest, TypeScript) run on the build machine. Use the lockfile (`npm ci`) and review updates.

## STATUS

Verified on 2026-09-13 (macOS, Node 22.18):

- `npm test`: 6 files, 47 tests passed, 0 failed (LLM client with mocked fetch: chunked streaming with multi-byte characters, HTTP and mid-stream errors, header timeout, idle timeout, caller abort, offline fail-fast, loopback while offline, refused connection, config validation, retries; SSE parser; untrusted fence; i18n RTL switching, per-message dir="auto", and dictionary parity; panic wipe against fake-indexeddb with stubbed Cache Storage and service workers; settings; export; third-party URL guard).
- `npm run build`: type-check and Vite build succeed; sizes above.
- `scripts/opsec-audit.sh src/starter`: 0 HIGH, 0 MED, 0 LOW (one test fixture allow-marked).
- Real browser (headless Chromium via Playwright against `vite preview`): service worker installs and precaches the shell; with the preview server killed, a reload still renders the app and its stored messages; the Online/Offline pill and hint flip with the network; switching to Persian sets `dir="rtl"` and mirrors the layout; sending with no model running shows the unreachable message instead of hanging; panic wipe (two taps) leaves 0 stored records and empty localStorage after the reload; zero requests to any host other than localhost.
- `wrangler deploy --dry-run`: config parses, reads `dist/`, no bindings.

Not verified:

- Real model servers (Ollama, llama.cpp, Maple Proxy): all tests use mocks; Ollama must not run on the prep laptop. Whether the Maple desktop proxy sends CORS headers is unknown.
- Docker image build and Caddy config (Docker Desktop was not running). The Dockerfile runs `caddy validate` at build time to catch config errors.
- Actual Cloudflare deploy (not deployed by design), `_headers` behavior on Cloudflare, and install prompts on real phones.
- Translations: machine-drafted, not reviewed by native speakers.
