# CivicLink: Presentation and Demonstration Script

Rubric: overview 1 · principal workflow 2 · **lecturer-selected functionality 4** · decisions 1 · defence 2.

## Before you start (10 min before)

1. **Primary:** open the deployed URL and wake it with one sign-in. **Fallback (offline):** `npm run dev` from a fresh terminal, which resets the database to the seed; wait for "Local: http://127.0.0.1:5173".
2. Open **four browser windows** side by side, each in its own profile or incognito window so the sessions don't clash. Sign in with the demo buttons:
   - A: Resident **thandi@** (narrow the window to phone width or use DevTools device mode)
   - B: Official **naledi@** (Water & Sanitation)
   - C: Field worker **sipho@** (phone width)
   - D: Admin **admin@**
3. Keep VS Code open on the repo, with [the traceability matrix](../trackers/traceability-matrix.md) in a tab so you can open any requirement's code quickly.
4. Have a JPG photo ready on the desktop (e.g. `tests/evidence/fixtures/before.jpg`).
5. Allow location in window A, or plan to drag the pin.

## Slides (≤ 5 min), see `CivicLink_Presentation.pptx`

1. **Problem:** the 31 March strike; phone and WhatsApp reporting; no tracking; no alerts.
2. **Solution and scope:** four roles; all 39 requirements included (all 14 Must-haves); four deferred at baseline were brought back by change requests once the core was verified.
3. **Architecture:** React SPA → callable commands → transactions; Security Rules; shared domain package (Figure 9).
4. **Key decisions:** server-side commands with transactions (D1); free-tier deployment, with a Node API on Vercel and photos in Firestore (D2); offline outbox with idempotent submission (D3); guests through anonymous sign-in (D4).
5. **Verification:** 173 automated tests (all pass), CI green, NFR measurements, CDN/CSP checks on the live site, SC-01 to SC-05 all achieved.

## Principal workflow (≈ 5 min, 2 marks)

| Step | Window | Action | Say |
|---|---|---|---|
| 0 | Any (signed out) | Open the site: public home with alerts and the open-issue map; point out "Report an issue" without an account | "Anyone sees what is happening around them. Guests are real anonymous sign-ins, so every rule still applies (D4)." |
| 1 | A Resident | Report → Burst Pipe → Use my location (or drag the pin) → describe → High → add photo → Review → Submit | "Three steps, validated on the client and again on the server. The reference is allocated in a transaction." |
| 2 | B Official | The new report appears in **Needs action** without refreshing; open it | "Real-time Firestore listener; the official also got a notification." |
| 3 | B | **Review & accept** → **Assign field worker** → Sipho → Assign | "TX-2: one active task per report, worker must be in the same department. Both rules are checked inside the transaction." |
| 4 | A | Open **My reports** → the report shows *In progress* and the timeline | "Every change appends an immutable history entry." |
| 5 | C Worker | Task appears → Accept → Start → notes + photo → Mark as resolved | "TX-3: the task and the report are resolved together or not at all." |
| 6 | A | The status turns *Resolved* live, with the proof photo → **Yes, it's fixed** → *Closed* | "Resident confirms within 7 days, or it closes automatically." |
| 7 | B | **Broadcast alert** → Emergency → "Strike: CBD closures" → Galeshewe → Broadcast | "Delivery records are created per resident in the suburb." |
| 8 | A | Alerts tab shows it, pinned first (and the phone receives a push) | "Read receipts are counted back on the official's alert history; push is sent only after the command commits." |

## Lecturer-selected checks: drill sheet (4 marks)

For every included requirement and rule: how to show it, and a failure case to show next. Practise each once.

| ID | Show it | Failure / boundary to demonstrate |
|---|---|---|
| FR-01 | /register → create a resident | Same email again → "Email already registered"; 5-character password → field error |
| FR-02 | Sign in as each role → different home | Wrong password → generic error; admin deactivates pieter@ → pieter cannot sign in |
| FR-03 / BR-02 | Submit a report | 5-character description, no location, no severity → three field errors; 4th photo refused; a .gif refused |
| FR-04 / BR-04 | Reference shown after submit | Mention IT-RPT-08: 12 concurrent submissions → unique, consecutive references |
| FR-05 / BR-03 | Second resident (pieter@) reports the same category at the same spot → "already reported as CL-…" | Different category at the same spot → new report |
| FR-06 | My reports tabs; detail timeline | Paste another resident's report URL → "does not exist or is not yours" (rules) |
| FR-07 / BR-17 | /map with category filter | Popup has no name, description or photo; explain the ≈100 m rounding |
| FR-08 | Queue filters, search by ref, CSV export | Search "zzz" → empty state |
| FR-09 / BR-12 | Review & accept; reroute department | Reject with "no" → "At least 10 characters" |
| FR-10 / BR-06 / BR-07 | Assign | The dropdown shows only active workers of that department; point to IT-ASG-07 (concurrent assigns → exactly one) |
| FR-11 / BR-08 / BR-09 | Worker flow | Mark as resolved without notes or photo → field errors |
| FR-12 | Reassign to Anele | The old worker's task shows "no longer yours"; completing it is refused |
| FR-13 / BR-10 | Escalate with reason; or Admin → System log → **Run scheduled rules now** | Escalate with empty reason → error |
| FR-14 / BR-11 | Resident reopen with reason → back to Under review | Explain the 7-day window (IT-RES-03) and auto-close |
| FR-15 | Bell badge updates live in another window | — |
| FR-16 / BR-13 | Broadcast | No suburb chosen → "Choose at least one suburb"; title over 100 characters |
| FR-17 / BR-14 | Galeshewe resident sees the alert | Roodepan resident (pieter@) does **not** |
| FR-18 | Alert history read counts; End now | Ended alert disappears for residents |
| FR-19 | Analytics period switch | Explain that it is computed server-side from live data (IT-ANL-01) |
| FR-20 / BR-15 / BR-16 | Admin creates an official; changes a role | Admin's own row: role selector disabled; server also refuses (IT-ADM-04) |
| FR-21 / BR-19 | Deactivate "Vandalism" category | Resident's report form no longer offers it; SLA 0 → error |
| FR-22 / BR-18 | Official adds an internal note | Resident never sees notes (rules RT-CMT-01) |
| FR-23 | System log entries for admin actions | — |
| FR-26 | Export CSV | — |
| FR-29 | Login → Continue with Google → emulator account chooser → "Add new account" → welcome step | Finish without a suburb → field error; account is always a Resident |
| FR-30 | Forgot password with an email | Unknown email → the same message (no account enumeration) |
| FR-31 | Profile → change suburb → alerts feed follows | Phone "123" → error |
| FR-24 | Phone with push on (Profile → Turn on) → official assigns the report → notification on the phone; tap opens the report | Push off → no notification, in-app bell still updates |
| FR-33 / BR-23 | Resident: Map → tap an open issue → Me too → count rises | Tap again → "already confirmed"; own report → refused |
| FR-34 | Phone: Install CivicLink → airplane mode → open the app → saved reports + offline notice | Map shows only areas viewed before |
| FR-27 | Airplane mode → Report → … → **Save and send later** → Home shows "Saved on this phone" → airplane mode off → "Your saved report was sent" with its reference | Explain the clientId: a resend after a lost response is stored once (IT-OFF-01) |
| FR-28 / BR-24 | Official → New alert → Schedule for later → Scheduled tab → Cancel | Publish time 2 minutes ahead → "Schedule at least 10 minutes ahead"; locally publish with Admin → **Run scheduled rules now** |
| FR-25 / BR-25 | Resident profile: number + "emergency alerts by SMS" → official broadcasts an Emergency alert → Admin → System log → SMS outbox shows SIMULATED | Opt in without a number → field error; a Water alert creates no SMS |
| FR-35 | Queue → tick two reports under review → choose worker → Assign selected | One already assigned → listed with the reason, the rest still assigned |
| FR-36 | Log out → "See how the municipality is responding" → public page | No names, descriptions or locations; figures cached ≤ 5 min (DevTools: `x-vercel-cache: HIT`) |
| FR-37 | Resident confirms a fix with 4 stars → official sees "Resident rating: 4/5" | Rating is optional; 6 stars refused by the API |
| FR-38 | Signed out, open the site: alerts, open-issue map, figures; choose "Galeshewe" in "Show my area" | No names, descriptions or exact locations (≈ 100 m) |
| FR-39 / BR-26 | "Report an issue" without an account → submit → banner → Account → create account → report still under My reports | Sign out as a guest → warning first; 4th guest report in an hour refused; "I already have an account" moves the reports |
| NFR-13 / NFR-14 | DevTools → Network: assets `immutable`; Response headers: CSP, HSTS | Console shows no CSP violations |
| FR-32 / BR-22 | Profile → type DELETE → delete; sign-in now fails | Show that the old report now reads "Former resident" (official view) |
| BR-01 | Official or worker has no "Report" screen; guests can report because they are signed in anonymously | Show IT-RPT-06: officials, workers and anonymous callers are refused by the API |
| BR-05 | Official report page offers only the valid next actions for the current status | Explain the state machine (Figure 7) and UT-RSM-01..03; a stale action is refused (IT-TRI-02) |
| BR-20 | Naledi (Water) sees only Water reports in the queue | Johan (Roads) cannot open a Water report (rules RT-RPT-04, IT-TRI-04) |
| BR-21 | Admin → config → limit 2; resident submits a third report | "You have submitted 2 reports in the last hour" |
| NFR-01 | As resident, open /official → 403 page | Even with the guard bypassed, rules deny the data (show the RT test) |
| NFR-07 | DevTools 360 px | No horizontal scroll |

**Reset between attempts:** stop and rerun `npm run dev` (≈ 40 s). The data returns to the same seed.

## Defence questions to prepare

- **Why Firestore and not SQL? How do you keep integrity without foreign keys?** Transactions TX-1/2/3, server-only writes, append-only history, deactivation instead of deletion.
- **What stops two officials assigning at once?** The Firestore transaction re-reads `activeTaskId`; the second transaction retries, sees the task and fails (IT-ASG-07).
- **How is duplicate detection done?** Geohash range query for 100 m, then exact haversine distance, same category, open status, 72 h (`DuplicatePolicy`, UT-DUP-01..06).
- **Where is security enforced? What if someone calls Firestore directly?** Security Rules deny all client writes; reads are scoped by role, department and owner; functions re-check roles from the profile.
- **Why is SMS "simulated"?** Every SMS costs money; the gateway is an interface. With three Twilio variables it sends for real, and every message is recorded with its status either way.
- **How can a scheduled alert be on time without a paid scheduler?** Hourly cron as backstop, plus a background check (Vercel `waitUntil`) after API requests at most once a minute; publication is claimed in a transaction so it happens once.
- **Can't anyone flood the system as a guest?** Guests are authenticated anonymous users: 3 reports per hour each, at most 10 new guest sessions per network address per hour (stored as a hash), and the same duplicate detection and Security Rules (BR-26, IT-GST-05).
- **What was the hardest defect?** DEF-14: after enforcing the CSP, map tiles failed only for returning visitors, because the service worker fetches tiles under `connect-src`. Found on the live site, fixed, and NFT-12 now checks it.
- **Is SMS real?** Yes, through Twilio: the live test SMS was accepted by Twilio. The trial account only allows a predefined template, so the real alert text is kept in the outbox; a paid account sends the real text with no code change.
- **What would you do next?** A paid SMS gateway with a send queue, Cloud Scheduler, and a pilot with one department.
- **Did you use AI tools?** Be ready to explain any file: open it from the traceability matrix and walk through the logic.
