# Swarm Playbook: Event Day

## The short version

- In a 1.5-day build with a captain co-coding, a swarm is **extra hands for parallel, well-specified work**: scaffold, tests, opsec review, i18n, README drafts. It is never a second product owner.
- The captain decides what gets built. The main Claude Code session integrates. Agents do bounded jobs in files nobody else is touching.
- Default 5 agents, hard cap 8 (the launcher enforces both). At most 3 build waves on Thursday and 1 review-only wave on Friday.

## When a swarm helps

| Job | Why it parallelizes | When |
|---|---|---|
| Scaffold: copy `src/starter`, wire `src/rails`, test harness, deploy shell | Mechanical, spec-light, separate files | Thu 9:00 |
| Core loop pieces split by the architect's file-ownership table | UI and AI/data paths do not overlap | Thu 11:15, after spec freeze |
| Tests with mocks for the core loop | Reads the code, writes only under test paths | Thu 11:15 onward |
| i18n: move strings, add languages, check RTL | Touches locale files only | Thu 11:15 or 14:15 |
| Opsec review against `docs/security/ACTIVIST_THREAT_CHECKLIST.md` plus `scripts/opsec-audit.sh` | Read-only, a fresh pair of eyes | Thu 17:00 and Fri 10:30 |
| Deploy config for the backup target | Isolated config files | Thu 17:00 |
| README and `docs/HANDOFF.md` drafts | Pure writing from the spec | Thu 22:15 or Fri 8:15 |

## When a swarm hurts

- **Product decisions.** Which flow, which user, what wording an at-risk person sees. That is the captain's call, made out loud, not an agent's guess.
- **Before a spec exists.** Agents without a spec invent a product, and you lose the morning undoing it.
- **Files the captain is co-coding.** Conflicts, and the captain stops trusting the code they are presenting.
- **Debugging one broken thing** (a failed deploy, a CORS error). One focused session beats five agents guessing in parallel.
- **After the Friday 10:30 AM feature freeze.** Churn right before a demo breaks demos. Review only.
- **On a phone hotspot, or when usage headroom is low.**
- **Anything that needs the captain's voice:** the pitch, the demo story, the adoption quotes.

## Cost

- The swarm draws on **the same Claude subscription** that runs the main Claude Code session, the dry run, and any other Claude jobs you have scheduled. Background agents all spend from the same usage window at the same time.
- Running out on Thursday evening means the 6 PM and 10 PM checkpoints happen with no AI help. That is the real risk, not money.
- Rules:
  1. Default `--agents 5`, cap 8. Fewer is fine.
  2. Measure it during the T-6 to T-4 dry run: run one wave with `--agents 3` and note how much of your usage window it took: `______`.
  3. At most 3 build waves Thursday plus 1 review wave Friday.
  4. Pause other scheduled or background Claude jobs from Sep 23 to Sep 25.
  5. Lower effort before switching to a smaller model. Keep the strongest model on the architect and the opsec reviewer.
  6. Stop an agent that drifts out of its paths. Do not let it finish.

## Topology and roster

- **ruflo:** hierarchical topology, `specialized` strategy (clear roles, no overlap), max agents = N.
- **Queen and integrator:** the main Claude Code session, driven by the dev. **Product owner:** the captain.
- **Order:** the architect runs first, in the foreground, and writes `docs/plan.md` with a file-ownership table. The rest spawn together in one message, in the background, once the captain has seen the plan. Coders without ownership rules collide.

`--agents N` takes the first N rows:

| # | Agent | Owns | Does | Never |
|---|---|---|---|---|
| 1 | architect | `docs/plan.md` | Maps the core loop to files, picks kit modules, assigns paths | Writes app code |
| 2 | coder-1 | UI paths from the plan | Core loop screens on the `src/starter` PWA shell | Touches AI or data paths |
| 3 | opsec-reviewer | nothing (read-only) | Threat checklist review, runs `scripts/opsec-audit.sh`, reports file:line | Edits files |
| 4 | tester | test paths from the plan | Mocked tests for the core loop, runs them | Changes app code |
| 5 | coder-2 | AI and data paths from the plan | `src/starter` LLM client, `src/rails` Nostr or NWC if in the spec | Touches UI paths |
| 6 | i18n | locale files | Strings, languages, RTL check | Ships translations the captain has not had checked |
| 7 | deployer | deploy config | Cloudflare deploy, Vercel backup, redeploy commands | Puts secrets in the repo |
| 8 | docs-writer | `README.md`, `docs/HANDOFF.md` | Drafts from the spec and checklist | Writes pitch content |

## Waves

| Wave | When | Command | What to paste |
|---|---|---|---|
| 1 Scaffold | Thu 9:00, draft spec | `scripts/event-day-swarm.sh docs/spec.md --agents 2` | Architect plus coder-1: plan and scaffold only |
| 2 Build | Thu 11:15, after spec freeze | `scripts/event-day-swarm.sh docs/spec.md --agents 5` (re-stores the frozen spec) | Full printed prompt |
| 3 Harden | Thu 17:00 | Reuse the wave 2 prompt | Keep only opsec-reviewer, tester, and deployer if you ran with 7 or 8 |
| 4 Review | Fri 10:30 | Reuse the wave 2 prompt | Keep only opsec-reviewer and tester. Tester may fix tests, nobody edits app code |

Trimming roles out of the pasted prompt is fine. Adding roles beyond N is not.

## Using `scripts/event-day-swarm.sh`

```bash
scripts/event-day-swarm.sh <spec.md> [--agents N] [--dry-run]

scripts/event-day-swarm.sh docs/spec.md --dry-run        # print everything, run nothing
scripts/event-day-swarm.sh docs/spec.md                  # 5 agents
scripts/event-day-swarm.sh docs/spec.md --agents 3       # smaller wave
```

What it does:

1. **Validates the spec path:** it must exist, be a regular file (not a directory, not a symlink), resolve inside the project directory (the parent of `scripts/`), use only letters, digits, dot, dash, underscore and slash, and be 1 byte to 64 KB. `../` traversal, absolute paths outside the project, and look-alike sibling directories are rejected.
2. **Validates N:** whole number, default 5, minimum 2, values above 8 are capped to 8 with a warning.
3. **Runs, from the project directory:**
   - `ruflo swarm init --topology hierarchical --max-agents N --strategy specialized`
   - `ruflo memory store --namespace event-build --key spec --value "<Source line + spec>" --provenance user_claim --scan-content --tags event-day,spec`
   - `ruflo memory retrieve --namespace event-build --key spec --value-only` to confirm the spec landed.
4. **Prints a ready-to-paste Claude Code prompt:** architect first in the foreground, then the other N-1 agents in one message with `run_in_background: true`, each told to reuse `src/starter` and `src/rails`, stay in their paths, and run `scripts/opsec-audit.sh` before handoff.

`--dry-run` prints the same commands (copy-pasteable) and the prompt, and executes nothing.

Exit codes: `0` ok, `1` bad spec file, `2` bad arguments, `3` ruflo failed.

Notes from checking ruflo v3.38.20:

- ruflo can print `[ERROR]` and still exit 0, so the launcher checks the output as well as the exit code.
- `memory store` fails on a `--value` that starts with a dash. The launcher prefixes a `Source: docs/spec.md` line, which also tells agents where the file lives.
- `--scan-content` scans the value for injection payloads before storing. If it blocks the spec, remove any pasted instructions or third-party text from the spec and rerun.
- Any ruflo command starts a background daemon for the current directory. Stop it after the event with `ruflo daemon stop`.
- Tests: `bash tests/runbook/test-event-day-swarm.sh` (validation and dry run only, uses a fake `ruflo`, never starts a swarm).

## Stopping and integrating

- **Stop agents:** stop background agents from Claude Code's task list (`/tasks`). Then `ruflo swarm stop` (flags: `--force`, `--save-state`), and `ruflo swarm status` to confirm.
- **One integrator:** the main session reads every report, runs the tests, runs `scripts/opsec-audit.sh`, then deploys. Never let agents deploy on their own.
- **Collisions mean the plan was wrong.** If two agents touched the same file, fix the ownership table in `docs/plan.md` before the next wave instead of hand-merging blind.
- **Show the captain the running app after each wave,** not the agent reports.

---

## STATUS

- Verified: ruflo flags above were read from `ruflo swarm init --help`, `ruflo memory store --help`, `ruflo memory retrieve --help` and `ruflo swarm stop --help` on ruflo v3.38.20, and `specialized` and `hierarchical` were confirmed as valid choices in the ruflo CLI source. `memory store` with `--provenance user_claim --scan-content` and `memory retrieve --value-only` were exercised against a throwaway database (`--path` in a scratch directory), including the leading-dash failure. The launcher's validation and dry run pass `tests/runbook/test-event-day-swarm.sh`.
- Untested: a live (non-dry-run) launcher run in a real project, by design, and the actual usage cost of a 5-agent wave. Both belong in the T-6 to T-4 dry run.
