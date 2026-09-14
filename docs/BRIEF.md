# AI Hack for Freedom III: Prep Brief

Shared brief for every swarm agent. Read this first. Swarm: `swarm-1789348101872-peltir` (ruflo, hierarchical, 6 max). Shared memory namespace: `ai-hack-freedom`.

## Event facts (verified 2026-09-13)

- **When:** Wed Sep 23 welcome reception, build Thu Sep 24 + Fri Sep 25 morning.
- **Pitches:** Fri Sep 25, doors 1:00 PM, **team pitches 1:30 PM**, judging 3:00 PM, winners 3:30 PM (ET, Washington DC).
- **Where:** National Endowment for Democracy, 1201 Pennsylvania Ave NW Ste 1100, Washington, DC 20004.
- **Hosts:** AI Freedom Lab (Bitcoin Park affiliated), Human Rights Foundation, NED, UMD School of Public Policy.
- **Format:** each team = 1 activist "captain" with a real problem + 1 or 2 developers. Captains are not published yet. Applications are closed.
- **Prizes:** $25k pool paid in BTC. Edition II split was $25k / $15k / $5k, $1k to every other team.
- **Real build window is about 1.5 days.** Anything not ready by Friday ~12:30 PM does not exist.

## How judging has worked

- Edition II criteria: **(1) scale of the problem, (2) integration of AI tools, (3) quality of technical execution.**
- Edition I criteria: scale/impact of problem, execution quality, **adoption by users outside the team**.
- Edition II: activists could lead the coding themselves ("vibe coding"). HRF named Hermes, OpenClaw and OpenCode, deployed through Finite.Computer software.
- Standout tools get considered for AI Freedom Lab follow-on funding. A live, usable URL matters.

## What has won

| Ed. | Place | Project | Captain | Pattern |
|---|---|---|---|---|
| I | 1 | Stringer Safety | Anjan Sundaram (journalists) | Mobile safety app, trusted contacts, one-tap SOS, encrypted AI (Maple) |
| I | 2 | Pathos | Leopoldo Lopez (Venezuela) | Nostr community reporting + bitcoin rewards (Breeze SDK, Bitchat offline) |
| I | 3 | Corruption Disrespector | Anna Chekhovich (Navalny FBK) | Multilingual doc entity extraction + network graph |
| II | 1 | Tarkus | Jhanisse Vaca-Daza (Bolivia) | Self-hostable AI lesson generator + live Q&A + trainer feedback agent |
| II | 2 | Zuka | Anaise Kanimba (Rwanda) | AI avatar identity protection, Nostr publishing, bitcoin wallet |
| II | 3 | Roshan | Roya Mahboob (Afghanistan) | Offline-capable AI learning companion |
| Fund | n/a | Enclave | Berta Valle (Nicaragua) | Secure-enclave case file analysis, vibe coded at edition I |

Recurring winning ingredients: **private or local AI**, **offline / low bandwidth**, **Nostr for censorship-resistant publishing**, **bitcoin/Lightning for uncensorable money**, **self-hostable**, **one-button simplicity for a non-technical user**, a captain who can say "N real people will use this next month".

HRF AI Fund themes: privacy over centralized data, local/offline inference, accessibility for underserved users, resistance infrastructure (payments, comms, agents), documentation of repression.

## The core constraint

**We do not know the captain's problem until the event.** So prep is a reusable kit, never a pre-built project. Everything we make must be:

- Generic building blocks (the same kind of thing as a library or boilerplate), MIT licensed.
- Honest: on pitch day we say exactly what was prepped and what was built at the event. The organizers' rule on pre-existing code is unconfirmed; treat it as unknown.
- Useful in the first 2 hours of Thursday, when teams lose the most time.

## House rules for all agents

- **No em-dashes** in any written file. Use commas, colons, or periods.
- **Do not git commit.** Never add Co-Authored-By lines anywhere.
- No secrets, no API keys in files. Use `.env.example` with placeholder names only.
- **Do not run Ollama or pull local models on the prep laptop** (local models can exhaust its memory). Code may *support* Ollama/llama.cpp via an OpenAI-compatible base URL; tests must use mocks.
- Node 20.19+ (corrected from 18+: nostr-tools crypto needs it; rails tests need 22.12+), TypeScript, keep files under 500 lines. Kit packages (`src/starter`, `src/rails`) keep their tests inside the package (`src/<pkg>/tests/`) so each one can be copied out standalone on event day. Repo-level script tests live under `/tests`.
- Prefer $0 dependencies and zero third-party network calls at runtime (no analytics, no Google Fonts, no CDN scripts). Activists' traffic is watched.
- Stay inside your assigned paths. Write a short `STATUS` section at the end of your main deliverable listing what is verified vs untested.

## Deliverable map

| Agent | Owns | Output |
|---|---|---|
| intel | `docs/research/` | `INTEL.md`: captain intel for III, tool setup notes, problem-archetype bank |
| opsec | `docs/security/`, `scripts/opsec-audit.sh` | Activist threat checklist + an audit script that flags telemetry/CDN/PII leaks |
| starter | `src/starter/`, `tests/starter/` | Offline-first PWA starter with provider-switchable private LLM client, i18n + RTL, self-host + CF deploy |
| rails | `src/rails/`, `tests/rails/` | Nostr (identity, publish, subscribe, encrypted DM) + bitcoin (NWC invoices/zaps) modules with mocked tests |
| runbook | `docs/runbook/`, `scripts/event-day-swarm.sh` | Hour-by-hour runbook, captain intake script, pitch template keyed to judging, event-day ruflo swarm launcher |
| queen (main session) | everything | Integration, runs tests + opsec audit, final report |
