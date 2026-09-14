# Swarm Record

How the prep kit was built, so the swarm can be understood, audited, re-run, or extended.

## Configuration

| Setting | Value |
|---|---|
| Orchestrator | ruflo v3.38.20 (same build as `claude-flow` / `@claude-flow/cli`) |
| Swarm ID | `swarm-1789348101872-peltir` |
| Topology | hierarchical (coordinator + specialists) |
| Strategy | specialized (clear, non-overlapping ownership) |
| Max agents | 6 (1 coordinator + 5 specialists) |
| Protocol | message-bus |
| Shared memory namespace | `ai-hack-freedom` |
| Execution | Claude Code subagents (general-purpose), launched together in one message, running in the background |
| Launched | 2026-09-13, about 21:10 local time |
| Init command | `ruflo swarm init --topology hierarchical --max-agents 6 --strategy specialized` |

Why hierarchical: five independent deliverables with clean path ownership, one coordinator that integrates, verifies, and commits. No agent needs to negotiate with another, so mesh coordination would only add cost. The swarm draws on the same Claude subscription as everything else, so the roster was capped at 6.

## Roster and ownership

| Agent | Role | Owns (only these paths) | Deliverables |
|---|---|---|---|
| coordinator | queen | repo root, `docs/BRIEF.md`, `docs/setup/`, `docs/swarm/`, `docs/research/COORDINATOR_FINDINGS.md` | Brief, account setup, verified findings, integration, tests, commits |
| intel | researcher | `docs/research/INTEL.md` | Edition III captains and judges, every past team, rules signal, toolchain quick-starts, 10-12 problem archetypes, judge-memorability list |
| opsec | security architect | `docs/security/`, `scripts/opsec-audit.sh`, `tests/opsec/` | Activist threat checklist, honest-claims guide, audit script with fixture tests |
| starter | coder | `src/starter/` | Offline-first PWA, private LLM client, i18n/RTL, panic wipe, Docker + Cloudflare configs, vitest suite |
| rails | coder | `src/rails/` | Nostr keys/publish/subscribe/NIP-17 DMs, NWC client, LNURL-pay, NIP-57 zaps, mocked tests |
| runbook | planner | `docs/runbook/`, `scripts/event-day-swarm.sh`, `tests/runbook/` | Event-day runbook, captain intake, pitch template, submission checklist, swarm playbook, swarm launcher script |

Exact prompts: [`AGENT_PROMPTS.md`](AGENT_PROMPTS.md).

## Coordination rules given to every agent

- Read `docs/BRIEF.md` first.
- Stay inside owned paths.
- No git commands; the coordinator commits. No co-author trailers.
- No em-dashes in written docs.
- No secrets; `.env.example` placeholders only.
- Do not run Ollama or pull local models on the prep laptop; test local-model support with mocks.
- Store a completion summary in ruflo memory: `ruflo memory store --namespace ai-hack-freedom --key <agent>-done --value "..."`.
- Final report under 250 words, separating verified from untested.

## Timeline

| Time (2026-09-13, local) | Event |
|---|---|
| ~21:00 | Coordinator researched the event, past winners, HRF AI Fund, and the local ruflo install |
| 21:08 | Project directories created; swarm initialized |
| 21:09 | `docs/BRIEF.md` written; `hack-brief` stored in ruflo memory |
| ~21:10 | Brief amended (kit tests live inside each package); all 5 agents launched together |
| ~21:20 | Author confirmed acceptance; coordinator researched account setup (Maple, Coinos NWC, nak) |
| ~21:25 | Checkpoint: all agents told to save work in progress to disk immediately and incrementally; repo created and first snapshot committed |

| 2026-09-14 ~01:28-01:31 UTC | Four agents stopped on the session limit; on-disk work committed; run resumed after the limit reset |
| ~01:35 UTC | Coordinator backfilled intel and runbook memory keys and researched intel's not-found list; resumed starter and opsec |
| 01:43-01:44 UTC | opsec and rails finished; coordinator reran all suites and removed rails source maps |
| ~01:50 UTC | Coordinator browser-checked starter in headless Chromium; found the RTL bubble direction bug |
| 01:57 UTC | starter finished with the RTL fix; final verification pass and final commit |

## Final verification (coordinator, 2026-09-14, macOS, Node 22.18)

| Suite | Result |
|---|---|
| `src/rails` vitest | 7 files, 81 passed |
| `src/starter` vitest | 6 files, 47 passed |
| `tests/opsec/test-opsec-audit.sh` | 53 passed, 0 failed |
| `tests/runbook/test-event-day-swarm.sh` | 79 passed, 0 failed |
| `tests/starter-e2e/browser-check.cjs` | 31 passed, 1 known harness failure |
| `scripts/opsec-audit.sh .` | PASS: 0 HIGH, 0 MED, 0 LOW, 2 suppressed with reasons |
| `src/rails` build | OK, no source maps |
| `src/starter` build | OK, 14.1 KB JS gzipped incl. service worker |
| `wrangler deploy --dry-run` (starter) | OK, 11 asset files, nothing uploaded |

Total: 260 unit and script tests plus 32 browser checks.

## Checkpoints and results

| Agent | Status | Report summary |
|---|---|---|
| intel | **Done** (paused 01:30 UTC before storing its memory key; coordinator backfilled) | `INTEL.md` complete: 12 archetypes, judge-memory list, STATUS. Coordinator second pass on its not-found list added Agent Camp and Finite TEE facts |
| opsec | **Done** (01:43 UTC, after resume) | Added `opsec-audit: allow <reason>` marker (reason required, suppressions counted, exit code unaffected); fixed a 3-minute hang on 2 MB minified lines (now 2.6 s); STATUS finalized. Coordinator rerun: 53 passed, 0 failed |
| starter | **Done** (01:57 UTC, after resume) | Vanilla TS + Vite, no runtime deps, 13.3 KB app JS gzipped. Coordinator ran a headless Chromium check with the production CSP and a mock SSE server (now `tests/starter-e2e/browser-check.cjs`) and found English replies rendering backwards in the Farsi UI; starter fixed it with per-message `dir=auto` plus a test. Final coordinator rerun: 47/47 tests, build OK, audit PASS, wrangler dry run OK, browser check 31/32 (1 Playwright offline-reload artifact). Blocked by a permission deny rule from writing `.env.example`; not worked around | Nothing reached disk before the limit. Resume message corrected the Maple preset to `http://localhost:8080/v1` and added a Fetch models button |
| rails | **Done** (01:44 UTC, never paused) | nostr-tools 2.25.2; own NWC client instead of @getalby/sdk; NIP-17/NIP-44 DMs; fixed a Node 22 undici stack-overflow crash on unreachable relays. Coordinator rerun: 81/81 tests, build OK, audit PASS. Coordinator set `sourceMap: false` in `tsconfig.build.json` after the audit flagged 11 source maps in `dist/` |
| runbook | **Done** (paused 01:28 UTC before storing its memory key; coordinator backfilled) | All 5 docs with STATUS; `tests/runbook`: 79 passed, 0 failed |

**Incident, 2026-09-14 ~01:28-01:31 UTC:** four agents stopped with "You've hit your session limit" about 20 minutes into the run (5 agents plus the coordinator on one subscription). Everything they had written to disk was committed, the run resumed after the limit reset, and the gaps were split: intel and runbook had finished their deliverables, so the coordinator backfilled their memory keys instead of paying to reload their transcripts; starter and opsec were resumed from their transcripts with narrow instructions. Lesson for event day: a 6-agent swarm can exhaust a session limit in about 20 minutes, so cap the event-day swarm lower and have agents save to disk from the first minute.

**Autosave false positive:** the 21:32 autosave refused to commit because two strings matched secret patterns. Both are safe: `.mask-image-gradient...` (a CSS class used as a deliberate false-positive fixture in `tests/opsec/`) and `nsec1vl029...` in `src/rails/tests/keys.test.ts`, which is the public test vector from the [NIP-19 spec](https://github.com/nostr-protocol/nips/blob/master/19.md), not a real key.

## Shared memory snapshot

`memory-export.json` in this folder holds the ruflo `ai-hack-freedom` namespace as of the latest refresh. The live store (`.swarm/memory.db`, `ruvector.db`) is gitignored because it is a binary runtime database.

**Known issue:** on ruflo v3.38.20, `ruflo memory export -o <file> -n ai-hack-freedom` wrote `"count": 0` even though `ruflo memory retrieve` returned the entry. The snapshot is therefore read straight from SQLite, embeddings omitted:

```bash
cd freedom-hack-kit
cols=$(sqlite3 .swarm/memory.db "SELECT group_concat(name, ',') FROM pragma_table_info('memory_entries') WHERE name NOT LIKE '%embedding%';")
sqlite3 -json .swarm/memory.db "SELECT $cols FROM memory_entries WHERE namespace='ai-hack-freedom' ORDER BY rowid;"
```

## Persistence while the swarm ran

The kit was built in a private working repo. Every agent was told to write work in progress to disk immediately and save after each section, and a background loop committed every 5 minutes, refusing to commit anything that matched a secret pattern (`nsec1…`, `sk-…`, `AKIA…`, `ghp_…`, PEM private keys, real NWC strings) or any dependency or runtime files. As each agent reported, the coordinator reran its tests and committed. This public repo is a cleaned single-commit snapshot of that work.

## Re-running or extending

```bash
cd freedom-hack-kit
ruflo swarm init --topology hierarchical --max-agents 6 --strategy specialized
ruflo memory store --namespace ai-hack-freedom --key hack-brief \
  --value "AI Hack for Freedom III prep. Brief at docs/BRIEF.md."
```

Then, in Claude Code, ask for a swarm and paste one or more prompts from `AGENT_PROMPTS.md`. Launch all agents together in one message so they run in parallel, and stay hands-off until they report.
