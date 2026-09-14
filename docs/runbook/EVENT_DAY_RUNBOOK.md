# Event Day Runbook: AI Hack for Freedom III

The one rule: **anything not deployed, tested on a phone, and rehearsed by Friday 12:30 PM does not exist.**

| When | What | Where |
|---|---|---|
| Wed Sep 23, evening | Welcome reception: meet captain, run intake | Confirm venue in organizer email |
| Thu Sep 24, 8 AM to late | Build day | Confirm venue |
| Fri Sep 25, morning | Finish, freeze 10:30 AM, deploy 11:30 AM | Confirm venue |
| Fri Sep 25, 1:00 PM | Doors. Team pitches 1:30 PM, judging 3:00 PM, winners 3:30 PM (ET) | NED, 1201 Pennsylvania Ave NW Ste 1100, Washington, DC 20004 |

Companion docs: `CAPTAIN_INTAKE.md`, `PITCH_TEMPLATE.md`, `SUBMISSION_CHECKLIST.md`, `SWARM_PLAYBOOK.md` (all in `docs/runbook/`), plus `docs/security/ACTIVIST_THREAT_CHECKLIST.md` and `docs/research/INTEL.md`.

---

## T-10 to T-1 days (Mon Sep 14 to Wed Sep 23)

T-0 is Thursday Sep 24, the first build day.

### T-10 to T-8 (Mon Sep 14 to Wed Sep 16): toolchain

- [ ] Node 18 or newer: `node --version`.
- [ ] ruflo installed and current: `ruflo --version`. MCP wired through the ruflo binary, not a floating `npx` version.
- [ ] Claude Code updated and logged in to the subscription you will use at the event. Check how much usage headroom you normally have in a heavy day.
- [ ] `wrangler whoami` shows the Cloudflare account you intend to own the demo.
- [ ] Vercel CLI logged in as the backup deploy target: `vercel whoami`. Do one throwaway `vercel deploy` of a static page so a stale CLI or login problem surfaces now, not Friday.
- [ ] `gh auth status` works and you can create a public repo under the account you will submit from.
- [ ] Domain decided: a subdomain you control for Friday (for example `project.yourdomain`) and a note on whether the captain will need their own domain later (see handoff in `SUBMISSION_CHECKLIST.md`). DNS changes can take time, so create one test subdomain now.
- [ ] `cloudflared` installed (quick tunnel fallback, no account needed): `cloudflared tunnel --url http://localhost:5173`.
- [ ] `qrencode` or the `qrcode` npm CLI available for offline QR codes.
- [ ] Optional: `gitleaks` installed for the secrets scan.

### T-9 to T-7: accounts to create in advance

- [ ] **Maple AI** account (private AI, secure enclaves). Check whether your plan includes API access and how to reach it from an OpenAI-compatible client. Note the base URL setting in `src/starter`.
- [ ] **Lightning wallet with Nostr Wallet Connect (NWC)**: Alby Hub or Coinos. Fund it with a small demo amount. Create an NWC connection with a spending budget, store the connection string in your password manager only.
- [ ] **Throwaway Nostr identity** for demos, generated with `src/rails`. nsec lives in the password manager, never in a repo, never on a slide.
- [ ] A second **private** AI endpoint for the LLM-down playbook, in this order: the captain's own Finite TEE endpoint if they have one (ask Wednesday), then Tinfoil (TEE, OpenAI-compatible). A local model on a teammate's laptop is optional. **Not a Raspberry Pi or other home server:** a Pi 4 measured about 1.8 tokens/s for a 3B model with 60% task accuracy, and a home box is one flaky tunnel away from the venue. Do not run Ollama on a low-memory prep laptop.
- [ ] Signal installed and working, for captain contact.

### T-6 to T-4: dry-run the kit end to end once

This is the most valuable prep task. Do it once, fully, with a timer.

- [ ] Pick a problem archetype from `docs/research/INTEL.md` and play captain for yourself (or ask a friend to play captain).
- [ ] Run the 20-minute intake from `CAPTAIN_INTAKE.md` with the timer. Write `docs/spec.md`.
- [ ] `scripts/event-day-swarm.sh docs/spec.md --dry-run`, then a real run with `--agents 3` to see actual usage cost.
- [ ] Copy `src/starter` (and `src/rails` if needed) into a fresh repo and build the core loop in a 4-hour timebox.
- [ ] Deploy to a real URL on Cloudflare, then redeploy to Vercel.
- [ ] `scripts/opsec-audit.sh` on the build.
- [ ] Test on your phone over cellular with wifi off. Test airplane mode after first load.
- [ ] Record a 90-second backup video. Generate a QR code. Mirror your phone to the laptop.
- [ ] Write down every thing that broke or took more than 15 minutes. Fix the kit or add a line to this runbook.

### T-3 to T-2 (Mon Sep 21 to Tue Sep 22): offline copies and packing

- [ ] Warm the npm cache: run `npm ci` in `src/starter` and `src/rails` so installs work over a weak hotspot (`npm ci --prefer-offline`).
- [ ] Offline copies: this repo cloned locally, `docs/` exported to PDF or kept in a local folder, saved pages for the NWC spec (NIP-47), the Nostr NIPs you use, and the wrangler and Vercel deploy docs.
- [ ] Two printed copies of the intake script and spec template (paper works at a noisy reception).
- [ ] Phone hotspot tested with the laptop: tether works, you know the data cap, and Claude Code plus a deploy both work over it.
- [ ] Pack: laptop charger, phone charger, power bank, USB-C cables (two), USB-C to HDMI adapter, phone-to-laptop cable for screen mirroring, headphones.
- [ ] Pause other scheduled or background Claude jobs for Sep 23 to 25 so the subscription is all yours.

### T-1 (Wed Sep 23, before the reception)

- [ ] Travel buffer. Laptop and phone charged to full.
- [ ] `wrangler whoami`, `vercel whoami`, `gh auth status` one last time.

---

## Wednesday reception

Goal: leave with a captain, an agreed one-sentence scope, and a plan for tomorrow. Do not write product code tonight.

1. **Find the captain.** Ask the organizers who you are paired with if it is not announced. Swap Signal contacts.
2. **Confirm the rules at the source:** pitch time limit, judging criteria for edition III, submission form fields, and whether pre-existing code is allowed and how to disclose it.
3. **Run the intake** (`CAPTAIN_INTAKE.md`), 20 minutes, somewhere quieter.
4. **Agree the scope before sleeping.** Read back the one-sentence scope; get a clear yes. Agree roles: captain owns the problem, users, content, translations, and outside testers; dev owns feasibility, code, and deploy.
5. **Tonight, after the reception (30 to 45 minutes max):**
   - Write `docs/spec.md` from your notes. Send the one-sentence scope to the captain.
   - Create the event repo. First commit: the generic kit only, labeled as prepared before the event.
   - `scripts/event-day-swarm.sh docs/spec.md --dry-run` to check the launcher and the spec.
   - Cross-check the "must never happen" list against `docs/security/ACTIVIST_THREAT_CHECKLIST.md`.
   - Sleep. If you did write anything captain-specific tonight, note it for the honesty line.

---

## Thursday hour by hour

| Time | Captain | Dev | Checkpoint |
|---|---|---|---|
| 8:00 | Arrive, coffee, re-read spec | Arrive, test venue wifi and hotspot, open repo | |
| 8:30 | 15-min spec review together: list max 3 screens, write the demo story | Same | |
| 9:00 | Write real content: sample (synthetic) data, onboarding text, UI strings | Scaffold from `src/starter`, wire `src/rails` if in scope. Optional swarm wave 1 (scaffold, test harness) | |
| 9:45 | Recruit 2 to 3 outside testers for tonight | **Deploy the empty shell to the real URL** so 6 PM is a redeploy, not a first deploy | |
| 10:00 | Draft translations, check them with a native speaker | Core loop, step 1 and 2 | |
| **11:00** | | | **GO/NO-GO 1: spec frozen.** One-sentence scope, core loop in 3 to 5 steps, never-happen list, demo story. Re-store spec: `scripts/event-day-swarm.sh docs/spec.md` |
| 11:15 | Co-code small pieces (copy, strings, styles) in files the dev is not touching | Core loop. Optional swarm wave 2 (parallel pieces, i18n) | |
| 12:00 | Lunch, 20 minutes, both of you actually eat | | |
| 12:30 | Test each piece as it lands, keep a bug list | Core loop end to end, real AI call | |
| **14:00** | | | **GO/NO-GO 2: the core loop works end to end** (localhost OK, synthetic data OK, real AI step) |
| 14:15 | Error-state and empty-state wording | AI prompt quality, offline behaviour, i18n/RTL | |
| 16:00 | Try it on own phone, file bugs | Fix top bugs. Env vars and secrets via `wrangler secret put`, never in the repo | |
| 17:00 | Draft pitch story and scale numbers | First `scripts/opsec-audit.sh` run. Optional swarm wave 3 (opsec review, tests) | |
| **18:00** | | | **GO/NO-GO 3: deployed to a real URL**, works on a phone over cellular |
| 18:15 | Send the link to outside testers (Signal) | Watch logs, fix what they hit | |
| 19:00 | Dinner | Dinner | |
| 20:00 | Sit with testers or call them, note exact quotes and numbers | Fix blockers live, redeploy | |
| **22:00** | | | **GO/NO-GO 4: a real outside user has tried it.** Write down who (role), what they did, what they said |
| 22:15 | Pitch outline filled in `PITCH_TEMPLATE.md` | Top 3 fixes from feedback, README draft | |
| 00:30 | Hard stop | Hard stop. Sleep 6 hours; a tired Friday demo fails | |

**Checkpoint rule:** a red checkpoint means you take the next rung of the cut ladder right now. Never "30 more minutes".

### Scope-cut ladder (pre-agreed, cut from the top)

Show this to the captain at 8:30 AM so a cut later is a plan, not an argument.

1. Settings, profiles, dark mode, anything not in the core loop.
2. Accounts and login. Use an on-device identity (a local Nostr key) or none.
3. Languages beyond the users' primary language plus one.
4. Lightning payments. Keep them on the "next month" slide.
5. Nostr publishing. Replace with the phone's share sheet or a local export.
6. Sync and any backend storage. Single device, offline-first, local only.
7. Multi-step AI pipeline. One well-crafted prompt to the private model.
8. Last resort: one step of the core loop is simulated, and you say so on stage.

**Never cut:** the AI step (a judging criterion), the live URL, the top "must never happen" safeguard, and the outside-user test (a judging criterion).

---

## Friday

| Time | Captain | Dev |
|---|---|---|
| 8:00 | 10-min standup: last night's feedback, pick max 3 fixes | Same |
| 8:15 | Finish slides 2 and 5 (scale, adoption), final quotes | The 3 fixes, README, screenshot |
| **10:30** | **FEATURE FREEZE.** Only bug fixes and text after this | Same. Swarm is review-only from here |
| 10:30 | Walk `docs/security/ACTIVIST_THREAT_CHECKLIST.md` with the dev | Start `SUBMISSION_CHECKLIST.md` |
| **11:30** | | **FINAL DEPLOY.** Note the commit hash |
| 11:30 to 12:00 | Test on own phone over cellular | `scripts/opsec-audit.sh`, secrets scan, phone test over cellular with wifi off, airplane-mode test, **done by noon** |
| 12:00 | Watch the recording for anything sensitive | **Record the backup demo video** (90 s to 2 min) |
| 12:15 | **Rehearsal 1**, full length, timer, live demo | Same |
| 12:30 | Fix handoffs and timing | Fix anything the rehearsal broke (text only) |
| 12:35 | **Rehearsal 2**, include switching to the backup video | Same |
| 12:45 | Submission form done, travel if the build venue is not NED | Same |
| **1:00 PM** | **Arrive at NED**, seated, phone mirroring tested if allowed | Hotspot on, video paused on frame one |
| 1:30 PM | Pitch | Pitch |
| 3:00 PM | Stay near the laptop and phone for judge questions | Same |
| After | Handoff doc, revoke demo NWC and event tokens | Same |

---

## Failure playbooks

### Venue wifi down

1. Switch to the phone hotspot immediately. Do not wait for it to come back.
2. On hotspot: pause any swarm, no large `npm install` (use `npm ci --prefer-offline` from the warm cache), no video uploads. Claude Code and a wrangler deploy are small enough.
3. If the hotspot also fails: keep building on the local dev server, use the offline doc copies, and plan to demo from localhost plus the backup video.
4. Friday pitch with no network: the PWA should still load on the phone from cache. That is also a strong demo point if the app is offline-first.

### LLM provider down

1. Confirm it is the provider: timeouts or 5xx from the base URL, check its status page, try one `curl` to the endpoint.
2. **Switch the base URL** in the `src/starter` provider setting to the next private endpoint, in this order:
   - The captain's Finite TEE model endpoint, if they arrived with one.
   - Tinfoil (TEE, OpenAI-compatible); key created before the event.
   - Only then a local model on a teammate's laptop (never a low-memory prep laptop, never a home server):
   - Ollama on a teammate laptop: `OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS="https://your-live-url" ollama serve`, base URL `http://<machine-ip>:11434/v1`.
   - llama.cpp: `llama-server -m model.gguf --host 0.0.0.0 --port 8080`, base URL `http://<machine-ip>:8080/v1`.
3. Gotchas:
   - **Mixed content:** a deployed `https://` page cannot call an `http://` LAN address. Put the model behind HTTPS (for example `tailscale serve` on that machine) or demo from localhost.
   - **CORS:** browser calls need the origin allowed (`OLLAMA_ORIGINS` for Ollama).
   - Binding to `0.0.0.0` on venue wifi exposes the model to everyone on that network. Prefer the Tailscale IP.
   - Small local models are weaker: shorten prompts, cap output tokens, warm the model with one request before the pitch. Raspberry Pi class hardware is too slow for a live demo.
4. **Privacy check:** do not silently fall back to a centralized provider if the threat model forbids it. If you must use one for the demo only, use synthetic data and say so.
5. Last resort: a clearly labeled "demo mode" with canned responses, plus the backup video.

### Deploy broken

1. Stop and read the actual error. `wrangler whoami`: wrong account is the most common silent cause.
2. Roll back to the last good version: `wrangler rollback` for Workers, or promote the previous deployment in the dashboard for Pages or Vercel. Keep the last good URL working.
3. Common causes to check, in order:
   - Missing production env var or secret (works locally, fails deployed).
   - Service worker serving an old build: bump the cache version, then on the test phone clear site data.
   - SPA route 404 on refresh: missing fallback to `index.html`.
   - Mixed content or CORS from the deployed origin.
   - Worker calling another Worker on the same zone over HTTP fails in production with error 1042 even though it passes in `wrangler dev`. Use a service binding or a different zone.
4. Backup target: the starter is a static PWA build, so `vercel --prod` on the build output works.
5. Emergency public URL with no account: run the build locally and `cloudflared tunnel --url http://localhost:<port>` for a temporary `trycloudflare.com` URL. Your laptop must stay on.
6. **Friday rule:** if the final deploy is broken for more than 20 minutes after 11:30 AM, ship the last good deploy and demo that.

### Captain and dev disagree on scope

1. Timebox the disagreement to 5 minutes. Set a phone timer.
2. Each person says which user outcome is at stake, in one sentence.
3. Check against the one-sentence scope in `docs/spec.md`, the judging criteria, and one question: "Can a real outside user try this by 10 PM tonight?"
4. If still split: **the captain decides what** (the problem and the users are theirs), **the dev decides how, and whether it fits before the next checkpoint**.
5. The idea that loses goes on the "next month" slide, word for word. Nobody builds it quietly.
6. Safety overrides both: if a request conflicts with the "must never happen" list or `docs/security/ACTIVIST_THREAT_CHECKLIST.md`, the threat model wins.

### Claude usage limit hit mid-build

1. Stop all background agents first (see `SWARM_PLAYBOOK.md`). Keep one main session.
2. Lower effort before switching model. Keep the strongest model for the core loop and the opsec review.
3. Have a second coding tool logged in as a backup (for example Codex CLI) and test it during the dry run.

---

## STATUS

- Verified: event times and venue match `docs/BRIEF.md`; `scripts/event-day-swarm.sh` usage and dry run are tested by `tests/runbook/test-event-day-swarm.sh`.
- Untested here: Ollama and llama.cpp command lines (by house rule no local model was run on the prep laptop), `wrangler rollback`, `cloudflared` quick tunnel, `tailscale serve` for HTTPS, Maple AI API access, Alby Hub or Coinos NWC setup. All belong in the T-6 to T-4 dry run.
- Unknown until the reception: build venue, pitch time limit, edition III judging criteria, pre-existing code rule, submission form fields.
