# Provenance template

Copy this file into the project repo on event day as `PROVENANCE.md`, fill it in, and
commit it. It answers one question a judge or organizer may ask: what did you bring,
and what did you build here?

Fill it in at two points: once Thursday after the captain sets the problem, and once
Friday morning before the submission form. It takes about five minutes each time
because the commands in section 5 generate the facts for you.

## 1. Which tier are we in

The rule on pre-existing code was unpublished as of 2026-09-19. Ask at the Wednesday
reception, or use the answer to the emailed questions in `docs/research/INTEL.md`
section 3. Tick one:

- [ ] **Tier 1. Prior code allowed.** The kit was cloned and built on directly.
- [ ] **Tier 2. Project code must be written after kickoff.** The kit is consumed as an
      installed MIT dependency. Every file of project source in this repo was written
      after kickoff.
- [ ] **Tier 3. Nothing prior at all.** The scaffolding was regenerated from scratch
      after kickoff using the saved swarm prompts. No pre-event artifact was copied in.

Ruling source (who said it, when, in what form):

## 2. Brought to the event

Everything written before kickoff, with something a third party can verify.

| Component | How it enters this repo | Version or commit | License | Written |
|---|---|---|---|---|
| `freedom-kit-rails` | npm dependency | 0.1.0 | MIT | 2026-09-13, before the event |
| `private-ai-starter` shell | (delete the row if regenerated) | commit `df276b9` | MIT | 2026-09-13, before the event |
| Third-party libraries | npm dependencies | see `package-lock.json` | various OSS | before the event |
| Runbook, intake script, opsec checklist | reference documents, not code | `Agent9AI/freedom-hack-kit` | MIT | 2026-09-13, before the event |

Public pre-event timestamp: `Agent9AI/freedom-hack-kit` was published publicly on
2026-09-14 at 02:06 UTC, commit `ffc2728`, nine days before the event. The git and npm
registry timestamps are independent of anything claimed here.

Nothing in the kit is specific to this project. It was written before the captain and
the problem were known.

## 3. Built during the event

Kickoff: Thursday 2026-09-24, 11:00 AM ET.

| What | Where | Built by |
|---|---|---|
|  |  |  |

First project commit (must be after kickoff):
Total commits during the event:
AI tools used and how:

## 4. What we are not claiming

Carry over the honest limits from the kit rather than softening them. See
`docs/security/ACTIVIST_THREAT_CHECKLIST.md`, "Honest pitch claims". Never say
anonymous, undetectable, or untraceable. Say reduces risk or reduces identifiability.

## 5. Commands that generate the evidence

Run these in the project repo and paste the output into sections 2 and 3.

```bash
# Earliest commit in this repo, with time. Should be at or after kickoff in tiers 2 and 3.
git log --reverse --format='%h %ad %s' --date=iso | head -3

# Everything committed after kickoff.
git log --since='2026-09-24 11:00' --format='%h %ad %s' --date=iso

# Line counts by author, to show the work is real.
git log --since='2026-09-24 11:00' --numstat --format='' | awk '{a+=$1;d+=$2} END {print a" added, "d" deleted"}'

# Which kit pieces are dependencies rather than copied source.
npm ls freedom-kit-rails 2>/dev/null || echo "not installed as a dependency"

# Prove no pre-event file was copied in (tier 3): every tracked file first appears after kickoff.
git log --diff-filter=A --format='%ad' --date=iso --name-only | head -20
```

## 6. The paragraph for the pitch

Say this out loud in the demo, before anyone asks. Adjust to the tier.

> We brought generic, MIT-licensed, publicly published building blocks: an offline app
> shell and Nostr and Lightning helper modules, written before the event and public
> since September 14. We did not know the problem until Thursday morning. Everything
> that makes this a solution to [captain's problem] was built here, and the commit
> history shows it.

If tier 3 applies, replace the first sentence with: we regenerated our scaffolding from
scratch after kickoff, and the commit history starts Thursday morning.

## STATUS

**Verified:** the pre-event public timestamp of `Agent9AI/freedom-hack-kit`
(commit `ffc2728`, 2026-09-14 02:06 UTC) and the kit commit `df276b9`. The commands in
section 5 are ordinary git and npm, and were checked against this repo's history.

**Tier 3 is verified as of 2026-09-19.** The archived `starter` prompt was re-run from
scratch in a clean directory with no access to the existing code: 10.6 minutes, 30/30
tests passing, build green, opsec audit PASS. See
`docs/swarm/AGENT_PROMPTS.md`, "Re-run verification". Regenerating the full kit means
running the five prompts in parallel, about an hour on the day.

**Untested:** the rule that decides the tier, until an organizer answers.
