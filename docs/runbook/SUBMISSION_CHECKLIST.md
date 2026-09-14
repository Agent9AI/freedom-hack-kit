# Submission Checklist

Work through this Friday between 10:30 AM (feature freeze) and 12:45 PM. Anything not checked by 12:30 PM gets cut or disclosed, not rushed. Confirm the organizers' actual submission fields at the Wednesday reception and add them at the bottom.

## 1. Repo

- [ ] Repo is **public** on GitHub.
- [ ] `LICENSE` file is MIT, with the copyright line agreed with the captain.
- [ ] First commit imports the generic kit and says so; event work comes after it (backs up the honesty line in `docs/runbook/PITCH_TEMPLATE.md`).
- [ ] Only `.env.example` with placeholder names is committed. No `.env`, no `.dev.vars`, no wallet or Nostr secrets.
- [ ] Team credits: the captain agreed, explicitly, whether their name appears. Some captains cannot be publicly linked to this.

## 2. Secrets scan (whole history, not just the current files)

- [ ] `gitleaks git .` (gitleaks 8.19 or newer) or `gitleaks detect --source .` (older versions). Install with `brew install gitleaks`.
- [ ] Fallback if gitleaks is missing: `git log -p --all | grep -nEi "nsec1|nostr\+walletconnect://|sk-[a-z0-9]|api[_-]?key|secret|BEGIN .*PRIVATE KEY"`
- [ ] If anything real was ever committed: rotate the secret first, then rewrite history. Rotating is what protects you; deleting the line does not.

## 3. Opsec audit

- [ ] `scripts/opsec-audit.sh` passes on the final build.
- [ ] Walk `docs/security/ACTIVIST_THREAT_CHECKLIST.md` once with the captain, focused on the "must never happen" list in `docs/spec.md`.
- [ ] Open the live URL with the browser Network tab open: zero requests to third-party hosts (no analytics, no Google Fonts, no CDN scripts).
- [ ] Demo Nostr identity is the throwaway one, never the captain's or yours.
- [ ] Demo Lightning wallet holds a small balance and the NWC connection has a spending budget set.

## 4. Live URL

- [ ] Final deploy done by 11:30 AM. Note the URL and the deployed commit hash here: `________`
- [ ] Opened on **a phone over cellular with wifi off**.
- [ ] Opened on the captain's phone too (different OS if possible).
- [ ] Opened in a private or incognito tab (no cached state, no leftover login).
- [ ] Works offline: load once, turn on airplane mode, reload, core loop still usable.
- [ ] Installs as a PWA (Add to Home Screen) and opens from the icon.
- [ ] Language switch works; right-to-left layout is correct if used.
- [ ] Panic wipe works if used, and the data is actually gone after reload.
- [ ] Browser console shows no errors on the core loop.
- [ ] HTTPS, no mixed-content warnings.
- [ ] QR code on the slides opens this exact URL.

## 5. README

- [ ] One paragraph: the problem, who it is for, in plain words.
- [ ] Screenshot of the core screen, compressed (aim under 300 KB, PNG or WebP).
- [ ] Live URL near the top.
- [ ] Run locally: exact commands, tested from a fresh clone.
- [ ] Self-host notes: how the captain or anyone can run their own copy.
- [ ] How the AI is used and where it runs; how to point it at a different OpenAI-compatible base URL.
- [ ] "Prepared before the event vs built at the event" section, matching the pitch.
- [ ] License and credits.

## 6. Backup demo video

- [ ] Recorded by 12:15 PM, 90 seconds to 2 minutes, shows the exact live-demo path.
- [ ] Synthetic data only. No notifications, no real nsec, no email, no wallet balance on screen.
- [ ] Saved on the laptop desktop and on the phone.
- [ ] Uploaded where the organizers want it (unlisted if on a video site), if they ask for one.

## 7. Handoff so the captain can keep running it

Fill this in and commit it as `docs/HANDOFF.md` in the event repo (roles only, no personal contact details).

```markdown
# Handoff

| Item | Held by | Where | Monthly cost | Renewal / expiry |
|---|---|---|---|---|
| Domain or subdomain | [role] | [registrar] | [$] | [date] |
| Hosting account (Cloudflare / Vercel) | [role] | [account owner] | [$0 free tier?] | n/a |
| AI provider key | [role] | [provider] | [$] | [date] |
| Nostr production identity | captain only | captain's device | n/a | n/a |
| Lightning wallet (NWC) | captain only | [wallet] | n/a | n/a |
| GitHub repo | [role] | [org/user] | $0 | n/a |

## How to redeploy
[exact commands]

## How to change the AI provider
[env var / setting name, where to set it]

## Known issues
- [issue]

## Shut-down plan
If nobody can maintain this, [role] takes the URL down and deletes any stored data by [steps].
An abandoned tool that users still trust is a risk to them.
```

- [ ] Decide who holds the domain. If it is a subdomain on the dev's domain, write the move plan and a date.
- [ ] Hosting: either the captain creates their own account and the dev deploys there, or the dev transfers it after the event. Write which.
- [ ] The captain generates their own production Nostr key and wallet on their own device. The dev never sees those secrets.
- [ ] Keys the dev created for the event are listed for rotation.

## 8. After the pitch

- [ ] Revoke the demo NWC connection string (it can spend from the wallet).
- [ ] Revoke any API tokens made just for the event (Cloudflare, Vercel, AI provider).
- [ ] Remove your access to the captain's accounts if they want that.
- [ ] Send the captain the handoff doc and the repo link over Signal.
- [ ] Note the AI Freedom Lab follow-on funding contact if the organizers share one.

## Organizer submission fields (fill in at the reception)

- [ ] [field]
- [ ] [field]

---

## STATUS

- Verified: checklist items map to every requirement in the runbook brief (public MIT repo, phone over cellular, README with screenshot, backup video, opsec audit, secrets scan, handoff).
- Untested: `gitleaks git .` vs `gitleaks detect --source .` depends on the installed gitleaks version, not run here; `scripts/opsec-audit.sh` is owned by the opsec agent and its pass criteria are defined there. The organizers' real submission form for edition III is unknown.
