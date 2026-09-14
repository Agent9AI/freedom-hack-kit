# Captain Intake: 20-Minute Interview

Run this at the Wednesday reception, or first thing Thursday if you only meet then. The goal is one page, `docs/spec.md`, that both of you agree on before anyone writes product code.

## Before you start

- Take notes on paper or in a local-only text file. Do not record audio unless the captain agrees out loud.
- Say this first: "Anything you tell me that is sensitive stays out of the repo. `docs/spec.md` goes into a public repo and gets sent to AI tools, so we write roles, not names."
- Never write names, locations, or contact details of at-risk people. Write "a journalist in region X", not a person.
- Timebox hard. Keep a phone timer visible. A 20-minute intake that runs 45 minutes eats Thursday.
- Your job is to listen. Save the "we could use Nostr and Lightning" talk until the scope is agreed.

## The script

### 0:00 to 2:00: Opener

> "Tell me about the moment this problem hurts the most. Pick one real (anonymized) example."

Listen for: a specific person, a specific action, a specific failure. That example becomes the pitch opener.

### 2:00 to 5:00: The users and how many

1. Who exactly will use this first? (role, not name)
2. How many of them exist today? How many could you personally reach next month?
3. Who is the very first person you would hand this to?
4. Is the user the same person as the one who benefits? (for example, a trainer vs a trainee)

Red flag: "everyone in the country." Push for the group the captain can reach directly.

### 5:00 to 8:00: Devices and connectivity

1. Android or iPhone? Roughly what share? How old are the phones?
2. Is data expensive? Do people turn data off to save money?
3. Are there internet shutdowns, throttling, or blocked sites? Which ones?
4. Do people use VPNs? Which apps are installed on nearly every phone?
5. Are phones shared with family or co-workers?

Listen for: "offline", "cheap Android", "shared phone". Each one changes the build (offline-first PWA, small bundle, panic wipe, no persistent login).

### 8:00 to 11:00: Languages and literacy

1. Which languages, in order of importance? Any right-to-left scripts?
2. Can every user read comfortably? Would voice or pictures work better than text?
3. Who can check a translation for us before Friday? (Machine translation of safety text must be checked by a native speaker.)

### 11:00 to 15:00: Threat model

1. Who would want to stop this or find the users? (state, police, platform, employer, family)
2. What happens if a user's phone is seized at a checkpoint?
3. **What must never happen?** Get the top three, in the captain's own words.
4. What data must never leave the device?
5. Is holding or receiving bitcoin legal and safe for these users? Is a Nostr public post safe for them?
6. Does using a foreign-hosted service put anyone at risk?

Write the "never happen" list verbatim. It goes into the spec, the tests, and the pitch. Cross-check it against `docs/security/ACTIVIST_THREAT_CHECKLIST.md` that night.

### 15:00 to 17:00: What they use today

1. What do people do today instead? (WhatsApp group, Signal, Telegram, spreadsheet, paper, nothing)
2. What breaks about it? What workaround have they invented?
3. What would make someone stop using our tool after one try?

Listen for: the thing we must beat is usually a WhatsApp group. If the answer is "it already works fine", the scope is wrong.

### 17:00 to 19:00: Success next month, in numbers

1. If this works, what number changes next month? ("N people do X per week")
2. What is that number today?
3. Who will keep running it after Friday? (This person owns the domain and hosting later.)

Red flag: no number at all. Offer a shape: "30 trainers each run one session a week with it."

### 19:00 to 20:00: Outside tester and close

1. Who outside our team will try it before Friday? Name a role and how you will reach them (Signal, in person at the event).
2. When? Aim for Thursday 8 PM to 10 PM.
3. Read back the one-sentence scope (below) and get a clear yes.

> "For **[users]**, we are building **[thing]** that lets them **[one core action]** so that **[outcome]**, without **[the top never-happen item]**."

If the captain hesitates on the read-back, you do not have a scope yet. Take 5 more minutes, not 30.

## After the interview (same night)

1. Fill in the spec template below. Save it as `docs/spec.md` in the event repo.
2. Send the one-sentence scope to the captain (Signal) and get a thumbs up.
3. Dry-run the swarm launcher against it: `scripts/event-day-swarm.sh docs/spec.md --dry-run`.
4. Pick the two or three kit modules you will use (`src/starter`, `src/rails`) and note which you will not.

---

## Spec template: `docs/spec.md`

Copy everything below this line into `docs/spec.md` and fill it in. Keep it to one page. Roles only, no names.

```markdown
# Event Spec: [project name]

Frozen at: [Thu 11:00 AM, or "draft"]   Captain: [role]   Devs: [handles]

## One-sentence scope
For [users], we are building [thing] that lets them [one core action]
so that [outcome], without [top never-happen item].

## Users
- Who: [role]
- How many exist: [number]   Reachable next month: [number]
- First person to hand it to: [role]

## Devices and network
- Phones: [Android share / iPhone share, age]
- Connectivity: [offline / expensive data / shutdowns / blocked sites]
- Shared devices: [yes/no]

## Languages
- Primary: [language, LTR/RTL]   Secondary: [language]
- Literacy: [text OK / needs voice or icons]
- Translation checker: [role]

## Threat model
- Adversary: [who]
- Must NEVER happen:
  1. [captain's words]
  2. [captain's words]
  3. [captain's words]
- Data that never leaves the device: [list]
- Phone seizure plan: [panic wipe / no local data / decoy]

## Today's workaround
[what they use now and what breaks]

## Core loop (3 to 5 steps, the demo follows this exactly)
1. [user does]
2. [app does, including the AI step]
3. [user gets]

## AI's job
- What the AI does: [one sentence]
- Provider: [private or local, OpenAI-compatible base URL]
- Fallback if provider is down: [local model machine / canned demo mode]

## Rails
- Nostr: [identity / publish / DM / none]
- Lightning (NWC): [invoices / zaps / none]

## Out of scope (we will say no to these)
- [item]
- [item]

## Success next month
[N people do X per week]   Today: [baseline]

## Outside testers before Friday
- [role], reached via [channel], by [Thu time]

## Demo story (30 seconds, captain's words)
[one real anonymized moment, then the core loop]

## Prepared before the event vs built here
- Prepared (generic kit): [modules used from src/starter, src/rails]
- Built at the event: [everything specific to this problem]

## After Friday
- Keeps it running: [role]
- Domain held by: [who]   Hosting account held by: [who]
```

---

## STATUS

- Verified: script timings add up to 20 minutes; the spec template matches the sections `scripts/event-day-swarm.sh` expects (it stores the whole file, no required headings).
- Untested: not yet run with a real captain. Do one timed practice run on a friend during the T-10 to T-1 dry run.
