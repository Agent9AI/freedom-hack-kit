# Pitch Template

Team pitches start Fri Sep 25 at 1:30 PM ET at NED. Judging criteria seen so far: **scale of the problem, integration of AI tools, quality of technical execution, adoption by users outside the team.** Confirm the exact criteria and the time limit at the Wednesday reception, then pick the 3-minute or 5-minute version.

## Roles

| Person | Owns | Never does |
|---|---|---|
| Captain | The story, the scale, the users, the "next month" number | Explaining code or architecture |
| Dev | The live demo on a phone, the AI and tech slide | Telling the captain's story for them |
| Both | The honesty line, the QR code, the ask | Reading slides aloud |

## Slides (one per criterion, plus open and close)

| # | Slide | On screen | Who talks |
|---|---|---|---|
| 1 | Title | Project name, one-sentence scope, **QR code to the live URL**, URL in text under it | Captain |
| 2 | Scale of the problem | One big number, one line of context, one anonymized quote | Captain |
| 3 | Integration of AI tools | What the AI does for the user, where it runs (private or local), what never leaves the device | Dev |
| 4 | Quality of technical execution | 3 to 4 boxes: offline PWA, private AI, Nostr/Lightning if used, opsec audit passing. Tests passing count | Dev |
| 5 | Adoption outside the team | Who tried it (roles), how many, one real quote, the "next month" number | Captain |
| 6 | Honest build line + ask | Prepared vs built split, QR code again, what you need next | Both |

Slide rules: large type, no paragraphs, no architecture diagram in the 3-minute version, dark text on light background (projectors wash out dark themes).

## 3-minute version

| Time | Who | Slide | Say (fill in) |
|---|---|---|---|
| 0:00 to 0:25 | Captain | 1 | "Last month, [anonymized person] tried to [action] and [what went wrong]. That happens to [N] people like them." |
| 0:25 to 0:45 | Captain | 2 | "[Big number]. Today they use [workaround], and it fails because [reason]." |
| 0:45 to 1:50 | Dev | Live phone | Run the core loop from `docs/spec.md`, one path only. Show the AI step. Show the safety step (offline, panic wipe, or no data leaving the phone). |
| 1:50 to 2:15 | Dev | 3, 4 | "The AI [does X] using [private/local provider]. Nothing about the user leaves the phone except [Y]. It works offline, and our opsec audit passes." |
| 2:15 to 2:40 | Captain | 5 | "[N] people outside our team tried it since last night. One said: '[quote]'. Next month, [N people do X per week]." |
| 2:40 to 3:00 | Both | 6 | Honesty line (below), then "Scan the code, it is live right now." |

## 5-minute version

| Time | Who | Slide | Say (fill in) |
|---|---|---|---|
| 0:00 to 0:40 | Captain | 1 | The real moment, told slowly. Who, what happened, what it cost. |
| 0:40 to 1:10 | Captain | 2 | Scale: how many, where, how often. What they use today and why it breaks. |
| 1:10 to 1:30 | Captain | 2 | The threat: "What must never happen is [top never-happen item]." |
| 1:30 to 3:00 | Dev | Live phone | Core loop end to end. Then a second short path: turn on airplane mode and show it still works, or trigger the panic wipe. |
| 3:00 to 3:40 | Dev | 3, 4 | AI integration: what the model does, where it runs, why private or local. Technical execution: offline-first, i18n/RTL if used, Nostr/Lightning if used, tests and opsec audit. |
| 3:40 to 4:20 | Captain | 5 | Adoption: who tried it, what changed after their feedback, the quote, the number for next month, who keeps running it. |
| 4:20 to 5:00 | Both | 6 | Honesty line, what you need next (users, funding, a translator, hosting), QR code. |

## The honesty line (say it every time, word for word)

> "Before the event, [dev] prepared a generic open-source kit: an offline app shell, a private AI client, and Nostr and Lightning modules. Everything specific to [captain]'s problem, [the core loop, the AI prompt and flow, the translations, the safety rules], was built here since Thursday morning. The repo history shows both."

Make the repo history back it up: import the kit in its own first commit, labeled as the generic kit, before any event-specific work. If anything captain-specific was written Wednesday night, say so.

## QR code

- Generate it offline. Do not paste the URL into an online QR generator.
  - `npx qrcode -o docs/qr.png "https://your-live-url"` (node `qrcode` package CLI), or
  - `qrencode -o docs/qr.png "https://your-live-url"` (Homebrew `qrencode`).
- Put it on slides 1 and 6, at least a third of the slide height, with the URL as text underneath.
- Test it: project or display the slide, stand 5 meters back, scan with two different phones.
- The QR must point at the production URL, not a preview or localhost link.

## Live demo on a phone

- Mirror the phone to the laptop: iPhone over a cable with QuickTime Player (File, New Movie Recording, pick the iPhone as camera), Android with `scrcpy`. Test at the venue's projector during setup if allowed.
- Before the pitch: Do Not Disturb on, notifications off, battery above 60 percent, brightness up, auto-lock off, the app already loaded once so the service worker has cached it.
- Use a throwaway Nostr identity and a demo wallet with a tiny balance. Nothing personal on screen: no real nsec, no email, no real balance.
- Use synthetic demo data. Never demo with a real user's data.

## Backup video fallback

- Record at noon Friday: 90 seconds to 2 minutes, the exact core loop from the live demo, no voiceover (you narrate live either way).
- Keep it on the laptop desktop and on the phone. Open it in a player, paused on frame one, before walking up.
- **Trigger rule:** if the app has not loaded within 10 seconds, or anything errors, switch. No retries on stage.
- Line to say: "The venue network is being shy, so here is the same flow recorded at noon today." Then narrate exactly as rehearsed.
- Rehearse the switch once in rehearsal 2 so it takes under 5 seconds.

## Likely judge questions (assign an owner now)

| Question | Owner | Answer notes |
|---|---|---|
| What happens if a user's phone is seized? | Dev | Panic wipe, what is stored locally, what is not |
| Why AI? What would it be without it? | Dev | The job the model does that a form cannot |
| Where does the AI run and who sees the prompts? | Dev | Provider, private or local, fallback |
| How do you know people want this? | Captain | Outside testers, quote, the number |
| Who keeps running it after today? Who pays? | Captain | Named role, $0 hosting tier, domain owner |
| What did you build before the event? | Both | The honesty line, point to the repo history |
| Why Nostr or bitcoin here? | Captain first, dev second | Only if used. The censorship or payment problem it solves for these users |

## Don'ts

- No invented metrics. "3 people tried it" beats a fake "300".
- Do not call anything "live" or "in use" unless it is.
- Do not present AI-generated images as real photos of users or places.
- No jargon from the captain's side. No "decentralized" without saying what it protects.
- Do not go over time. Practice with a visible timer and cut the demo, not the adoption slide.

---

## STATUS

- Verified: timings sum to 3:00 and 5:00; every judging criterion listed in `docs/BRIEF.md` has its own slide.
- Untested: `npx qrcode` and `qrencode` command lines were not run here; QuickTime iPhone mirroring and `scrcpy` must be tried on the actual laptop during the dry run. Confirm the pitch time limit and criteria for edition III at the reception.
