# CivicLink: Stage 4 Implementation and Final Report Plan

Window: Mon 19 Oct → Mon 2 Nov 2026 (14 days). Feature freeze: **Fri 30 Oct**. Release tag `v1.0.0`: **Sun 1 Nov**.
Rule for the whole fortnight: **finish Musts end-to-end before starting any Should.** A smaller, complete, tested system beats a large one with stubs (rubric D2-1, lecturer slide 8).

## 1. Architecture (target, mirrored by folder structure)

```
Browser (React SPA, apps/web)
  ├─ Firebase Auth SDK ──────────────► Firebase Authentication (custom claims: role, dept, active)
  ├─ Firestore SDK (reads/listeners) ─► Cloud Firestore  ◄── Security Rules (firestore.rules)
  ├─ Storage SDK (photo upload) ──────► Cloud Storage    ◄── Storage Rules (storage.rules)
  ├─ httpsCallable (commands) ────────► Cloud Functions (functions/)
  │                                        ├─ api/        callable commands (auth + zod + service)
  │                                        ├─ services/   ReportService, TaskService, AlertService, UserAdminService, AnalyticsService
  │                                        ├─ repositories/ Firestore access, transactions
  │                                        ├─ triggers/   onUserCreated (claims + profile)
  │                                        └─ schedules/  escalateOverdue (hourly), autoCloseResolved (daily), expireAlerts (hourly)
  └─ Leaflet ─────────────────────────► OpenStreetMap tiles (external)
packages/shared: enums, zod schemas, ReportStateMachine, TaskStateMachine, DuplicatePolicy, SlaPolicy, reference formatter
```

### Repository layout

```
civiclink/
├─ apps/web/                 React + Vite + TS + Tailwind
│  └─ src/{app,routes/{auth,resident,official,worker,admin},components,features,lib/firebase,hooks}
├─ functions/                Cloud Functions v2 (Node 22, TS, bundled with esbuild)
│  └─ src/{api,services,repositories,triggers,schedules,lib}  test/
├─ packages/shared/          domain logic shared by web + functions  (src/, test/)
├─ tests/rules/              @firebase/rules-unit-testing (Firestore + Storage)
├─ tests/e2e/                Playwright (chromium, firefox, mobile)
├─ scripts/seed.ts           deterministic seed: depts, categories, 12 users, ~150 reports
├─ firestore.rules  storage.rules  firestore.indexes.json  firebase.json  .firebaserc
├─ docs/{baseline,adr,plan,trackers,review,diagrams,evidence,report}
├─ .github/workflows/ci.yml  lint → typecheck → unit → emulators:exec (rules + integration + e2e)
├─ .env.example  README.md  CHANGELOG.md  package.json (npm workspaces)
```

### Firestore collections (final)

| Path | Key fields | Written by |
|---|---|---|
| `users/{uid}` | name, email, phone?, role, departmentId?, suburb?, isActive, createdAt, lastLoginAt | trigger, admin fn, owner (name/phone/suburb only) |
| `users/{uid}/notifications/{id}` | type, title, body, link, readAt?, createdAt | functions; owner sets readAt |
| `reports/{id}` | ref, reporterId, categoryId, departmentId, description, location{lat,lng}, geohash, suburb, landmark?, severity, photoPaths[], status, assignedWorkerId?, activeTaskId?, parentReportId?, affectedCount, createdAt, updatedAt, resolvedAt?, escalatedAt?, closedAt? | functions only |
| `reports/{id}/history/{id}` | from, to, actorId, actorRole, note, at | functions only (append-only) |
| `reports/{id}/comments/{id}` | authorId, authorName, authorRole, text, createdAt | functions (Could) |
| `publicReports/{id}` | categoryId, status, approxLocation, suburb, createdAt | functions: privacy-safe projection for the map (BR-17) |
| `tasks/{id}` | reportId, reportRef, workerId, assignedBy, departmentId, priority, status, notes?, completionNotes?, proofPaths[], assignedAt, acceptedAt?, startedAt?, completedAt? | functions only |
| `alerts/{id}` | type, title, message, targetSuburbs[], createdBy, isActive, recipientCount, readCount, createdAt, expiresAt | functions only |
| `alerts/{id}/recipients/{uid}` | channel=IN_APP, deliveredAt, readAt? | functions; owner sets readAt via fn |
| `departments/{id}` | name, slaHours, isActive | admin fn |
| `categories/{id}` | name, icon, departmentId, isActive | admin fn |
| `counters/reports-{year}` | next | functions (TX-1) |
| `systemLogs/{id}` | level, source, message, actorId?, createdAt | functions (Could) |

### Role / permission matrix (target)

| Function | Resident | Official | Field Worker | Admin |
|---|---|---|---|---|
| Register / sign in | ✓ (self) | sign in | sign in | sign in |
| Submit report, view own reports | ✓ | — | — | — |
| Confirm / reopen own resolved report | ✓ | — | — | — |
| View community map | ✓ | ✓ | — | ✓ |
| View report queue / details (all fields) | — | own dept | assigned only | ✓ |
| Triage, reject, assign, reassign, escalate | — | own dept | — | ✓ |
| Accept / start / complete task | — | — | own tasks | — |
| Internal comments | — | own dept | assigned | ✓ |
| Broadcast / deactivate alert | — | ✓ | — | ✓ |
| View alerts feed | ✓ (own suburb) | ✓ (all) | — | ✓ |
| Analytics dashboard | — | ✓ | — | ✓ |
| Manage users, departments, categories | — | — | — | ✓ |
| View system log | — | — | — | ✓ |

### Data classification (POPIA)

| Data | Class | Who sees it | Control |
|---|---|---|---|
| Name, email, phone | Personal | owner, staff | rules on `users`, no public projection |
| Home suburb | Personal (low) | owner, functions | used only for targeting |
| Report location + photos | Personal (may identify a home) | reporter, staff | Storage rules. Public map uses `publicReports` with location rounded to about 100 m and no photos |
| Report description | Potentially personal | reporter, staff | not in the public projection |
| Status history | Operational | reporter, staff | rules |
| Passwords | Secret | nobody | Firebase Auth only |

## 2. Testing strategy (feeds report §7 and rubric D1-6 / D2-6)

| Level | Tool | What | Where |
|---|---|---|---|
| Unit | Vitest | state machines, DuplicatePolicy (99 m/100 m/101 m, 72 h boundary), SlaPolicy, schemas (boundaries 9/10/300/301 chars, 3/4 photos, 5 MB) | `packages/shared/test` |
| Rules | @firebase/rules-unit-testing | every matrix cell: allow and deny | `tests/rules` |
| Integration | Vitest + emulator + Admin SDK | each callable: success, validation, authz, wrong-state, concurrency (TX-1/2/3) | `functions/test` |
| E2E | Playwright (chromium, firefox, mobile 360×640) | E2E-01 full lifecycle, E2E-02 duplicate, E2E-03 alert broadcast→feed, E2E-04 permission-denied, NFR-05 timing | `tests/e2e` |
| Non-functional | Lighthouse CI, timing script, gitleaks | NFR-06/08/04 | CI |
| Manual | checklist with screenshots | UX states, cross-check of report screenshots | `docs/evidence` |

Test IDs follow `UT-*`, `RT-*`, `IT-*`, `E2E-*`, `NFT-*`. The ID goes in the test title so `grep` connects the report to the code (see `docs/trackers/test-catalog.md`).

## 3. Schedule

| Day | Date | Goal | Issues / IDs | Exit check |
|---|---|---|---|---|
| 0 | Mon 19 Oct | Review, baseline, repo, trackers | — | ✅ this commit |
| 1 | Tue 20 Oct | Scaffold workspaces, emulators, CI green. Auth, register, role routing, claims trigger. Seed users | FR-01, FR-02 | sign in as all 4 roles on emulator. CI passes |
| 2 | Wed 21 Oct | Shared domain: schemas, state machines, policies + unit tests. Rules v1 + rules tests | BR-02..BR-12, NFR-01 | ≥80% shared coverage |
| 3 | Thu 22 Oct | `submitReport` (TX-1, duplicate, counter), report form with map, photo upload | FR-03/04/05 | IT-RPT-* green |
| 4 | Fri 23 Oct | My reports, detail timeline, notifications centre (live) | FR-06, FR-15 | resident sees own reports and live badge |
| 5 | Sat 24 Oct | Official queue + filters, triage, reject, assign (TX-2) | FR-08/09/10 | IT-ASG concurrency green |
| 6 | Sun 25 Oct | Field worker tasks, accept/start/complete with proof (TX-3) | FR-11 | **E2E-01 lifecycle passes (SC-01)** |
| 7 | Mon 26 Oct | Reassign, escalate (manual + schedule), confirm/reopen/auto-close | FR-12/13/14 | Sprint 1 review: all Musts except alerts/admin done |
| 8 | Tue 27 Oct | Alerts: broadcast with recipients, feed, read, history | FR-16/17/18 | E2E-03 |
| 9 | Wed 28 Oct | Admin user management, departments/categories config | FR-20/21 | all Musts done |
| 10 | Thu 29 Oct | Community map (public projection), analytics dashboard | FR-07, FR-19 | IT-ANL-01 matches seed |
| 11 | Fri 30 Oct | **Feature freeze.** Could-haves only if all green (FR-22, FR-26, FR-23). NFR tests, Lighthouse, Firefox, mobile. Fix defects. Set release statuses | NFR-* | CI fully green. Release status final |
| 12 | Sat 31 Oct | Render final PlantUML diagrams from code. Capture screenshots incl. error/empty/denied states. Report §1–§5 | — | diagrams match code |
| 13 | Sun 1 Nov | Report §6–§10. Fresh-clone setup test. CHANGELOG. Tag `v1.0.0`. Add lecturer as collaborator | — | report and repo agree |
| 14 | Mon 2 Nov | Submit. Then presentation prep: slides, demo script, drill of lecturer-selected checks | — | — |

**Cut line if you fall behind** (cut in this order, and move each item to *Deferred* with a CR entry *before* the freeze): FR-26 → FR-23 → FR-22 → FR-24 → FR-07 → FR-18 → FR-12. Never cut a Must.

## 4. Definition of done (per issue)

1. The code is merged to `main` through a PR that references the issue (`Closes #n`) and the FR/BR IDs.
2. Server-side validation and authorisation are in place, and so are the UI empty, loading, error and permission-denied states.
3. Tests listed in the issue exist with their IDs in the test name, and pass in CI.
4. The traceability matrix row is updated (components, collections, tests, screen).
5. A screenshot of the success state and one failure state is saved to `docs/evidence/` for the report.

## 5. Final report plan (template section → source in repo)

| Template section | Content source | Marks it serves |
|---|---|---|
| Executive summary | write last, from §2–§9 | D1-8 |
| 1 Project context | srs §1 + Phase 1 §1 | D1-1 |
| 2 Problem, purpose, SC | srs §1, Phase 1 interview + **3–4 APA sources** (Sol Plaatje IDP, AGSA MFMA local-government report, Stats SA Census 2022, news coverage of the 31 Mar 2026 strike) | D1-1 |
| 3.1 Overview + context diagram | `docs/diagrams/context.puml` | D1-2 |
| 3.2–3.4 Scope, excluded, limitations | srs §3 + freeze outcome | D1-2, D2-1 |
| 4.1–4.4 FR, NFR, BR, AC | srs §4–§8 (copy tables) | D1-3 |
| 5.1 Use cases + workflows | `usecase.puml`. Workflows **W1 Submit & duplicate** and **W2 Assign → complete → confirm/reopen** (activity + sequence each, with alt/failure). State diagrams: Report, Task | D1-4 |
| 5.2 Architecture + stack | `architecture.puml`, §1 above | D1-4, D2-3 |
| 5.3 Decisions | `docs/adr` ADR-0001..0004 | D1-4 |
| 5.4 Class design | `class.puml`: domain entities + services + repositories + policies | D1-4, D2-2 |
| 5.5 UI design | screenshots from `docs/evidence` (login, submit, validation error, queue, assign, worker complete, resolved timeline, denied page, empty state) | D1-4 |
| 5.6 Data design | `erd.puml` (document model), data dictionary from §1 table + Phase 3 detail, integrity mechanisms (TX-1..3, rules, append-only history) | D1-4, D2-4 |
| 5.7 Security | role matrix, controls table, data classification (§1) | D1-4, D2-5 |
| 5.8 Deployment | `deployment.puml` (local emulator + optional cloud) | D1-4 |
| 6.1 Codebase | repo layout (§1) | D1-5, D2-7 |
| 6.2 Core capabilities | capability → FR → components table from traceability matrix | D1-5, D2-1 |
| 6.3 APIs / integrations | callable function catalogue (name, role, input, errors), OSM, emulator substitution | D1-5, D2-3 |
| 6.4 AI/ML | "Not applicable": state it explicitly | — |
| 7 Testing | test catalogue + CI run link + coverage + Lighthouse + defect log | D1-6, D2-6 |
| 8 Setup | README quick start (verified on clean clone), demo accounts | D1-7, D2-7 |
| 9 Evaluation | SC-01..05 table with test IDs | D1-7 |
| 10 References | APA 7: Firebase docs, React, Leaflet/OSM, POPIA Act 4 of 2013, sources above | D1-8 |
| 11 Appendices | repo URL + tag + commit hash, API catalogue, full test results | D2-7 |

## 6. Presentation plan (10 marks, 4 of them lecturer-selected)

- **Slides (≤6):** problem and evidence, solution and scope, architecture, 2 key decisions, testing summary, SC evaluation.
- **Demo path (≈5 min):** resident submits a burst pipe → a second resident gets the duplicate message → official triages and assigns → worker completes with photo → resident timeline shows Resolved live → official broadcasts a strike alert → resident feed.
- **Drill sheet:** for every included FR and BR, write a one-line "how to show it" plus a failure case (e.g. BR-07 assign to a worker in another department → refused. BR-12 reject without a reason. NFR-01 resident opens `/official` → denied). Rehearse with seeded accounts. Keep a "reset demo" script (`npm run seed -- --reset`).
- **Defence prep:** be able to open the code for any FR in under 30 seconds using the traceability matrix.
