# CivicLink

Municipal incident reporting and community alerts for Sol Plaatje Local Municipality (Kimberley). NPRJ740 final project, Advanced Diploma in ICT, Sol Plaatje University, 2026.

Residents report located, photo-evidenced incidents and follow them to resolution. Officials triage, assign and broadcast suburb-targeted alerts. Field workers complete tasks with proof. Every status change is recorded in an audit trail.

**Live system:** https://civiclink-five.vercel.app (Vercel + Firebase Spark, Johannesburg database). Open it signed out to see the public home page, or report a problem without an account. The demo password for the live accounts is supplied separately.

## What it does (39 functional requirements, all included)

| Area | Capabilities |
|---|---|
| Public (no account) | Public home with active alerts, open-issue map and figures (FR-38); report as a guest and keep the report later with an account (FR-39); transparency page with time-to-fix, SLA compliance and satisfaction (FR-36) |
| Residents | Register, sign in with password or Google, reset password (FR-01, FR-29, FR-30); 3-step located report with photos, reference number and duplicate detection (FR-03 to FR-05); track reports live (FR-06); confirm with a 1–5 rating or reopen (FR-14, FR-37); community map with "Me too" (FR-07, FR-33); suburb alerts, web push and SMS for emergencies (FR-17, FR-24, FR-25); installable app that saves reports offline and sends them on reconnect (FR-27, FR-34); profile and POPIA account deletion (FR-31, FR-32) |
| Officials | Department queue with filters, search and CSV export (FR-08, FR-26); triage, reject, assign singly or in bulk, reassign, escalate (FR-09 to FR-13, FR-35); alerts now or scheduled, with delivery and read counts (FR-16, FR-18, FR-28); analytics (FR-19); internal notes (FR-22) |
| Field workers | Accept, start and complete tasks with notes and proof photos (FR-11) |
| Administrators | Staff accounts and roles, departments, categories, SLA targets, report limits, system log, SMS outbox and test SMS (FR-20, FR-21, FR-23) |
| Rules and quality | SLA escalation and auto-close on a schedule (FR-13, FR-14); transactions TX-1 to TX-3; Security Rules for every role; CDN caching and an enforced Content Security Policy (NFR-13, NFR-14) |

The requirements, rules and acceptance criteria are in [docs/baseline/srs.md](docs/baseline/srs.md); the final report is [docs/report/CivicLink_Final_Project_Report.docx](docs/report/CivicLink_Final_Project_Report.docx).

## Quick start (local, about 5 minutes)

**Prerequisites:** Node.js 22, Java 21 or later (for the Firebase emulators), Git. No Firebase account or API keys are needed: the system runs entirely on the Firebase Emulator Suite (ADR-0003).

```bash
git clone https://github.com/altechemist/civiclink.git
cd civiclink
npx -y npm@11.6.2 ci      # npm 11 is required: npm 10 has a known workspace resolver bug
npm run dev               # builds functions, starts emulators, seeds demo data, starts the web app
```

Open **http://127.0.0.1:5173**. The emulator UI (data browser) is at http://127.0.0.1:4000.

### Demo accounts

All accounts use the password **`CivicLink#2026`**. The login page has one-click buttons for the main four.

| Role | Email | Notes |
|---|---|---|
| Resident | thandi@civiclink.demo | Galeshewe; has reports in every state |
| Resident | pieter@civiclink.demo | Roodepan |
| Official | naledi@civiclink.demo | Water & Sanitation |
| Official | thabo@civiclink.demo / johan@civiclink.demo | Electricity / Roads |
| Field worker | sipho@civiclink.demo | Water & Sanitation |
| Field worker | bongani@civiclink.demo / mpho@civiclink.demo | Electricity / Roads |
| Administrator | admin@civiclink.demo | Can also use all official screens |

Restarting `npm run dev` resets the database to the same deterministic seed.

### Configuration

The web app defaults to the local emulator, so no `.env` file is needed. The deployed system runs on free tiers (Vercel + Firebase Spark); see **[docs/deploy.md](docs/deploy.md)** and the variable list in [.env.example](.env.example): Firebase web config, web push key, service account, cron secret and, optionally, Twilio for SMS. Never commit real keys or service-account files.

Locally the emulator does not run schedules by itself: as the administrator, use **System log → Run scheduled rules now** (SLA escalation, auto-close, scheduled alerts).

## Tests

| Command | What it runs |
|---|---|
| `npm run test:unit` | Domain unit tests (state machines, duplicate/SLA policies, validation, analytics): `UT-*` |
| `npm run coverage` | Same, with coverage (CI fails below 80% lines) |
| `npm run test:emulator` | Security Rules matrix `RT-*` and Cloud Functions integration `IT-*` against the emulators |
| `npm run test:e2e` | Playwright end-to-end `E2E-*` / `NFT-*` (run `npx playwright install chromium` once) |
| `npm run test:e2e:http` | The same E2E suite through the Node HTTP API used on Vercel |
| `npm run test:pwa` | Installable app and offline shell on the production build (`NFT-10`) |
| `E2E_BASE_URL=https://… npx playwright test -g NFT-1[12]` | CDN caching and security headers on the deployed site |
| `python3 scripts/test-results.py` | Runs every suite and writes [docs/evidence/test-results.md](docs/evidence/test-results.md) (latest: 185 of 185 passed) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript strict mode |

Test IDs match [the test catalogue](docs/trackers/test-catalog.md) and the final report. CI runs all of the above plus a gitleaks secret scan on every push.

## Repository layout

```
apps/web/            React + Vite + TypeScript SPA (resident, official, field worker, admin)
functions/           Command API: commands.ts registry, services (TX-1..TX-3), adapters index.ts (Cloud Functions) and http.ts (Node/Vercel)
api/                 Vercel serverless entry points (use functions/lib/http.js)
packages/shared/     Domain logic shared by web and functions: schemas, state machines, policies
firestore.rules      Firestore Security Rules (role/permission matrix)
scripts/seed.ts      Deterministic demo data
tests/rules/         Security Rules tests
tests/e2e/           Playwright tests
tests/support/       Emulator test harness
docs/                Baseline SRS, ADRs, plan, trackers, diagrams, evidence, report
```

## Documentation map

| Document | Purpose |
|---|---|
| [docs/baseline/srs.md](docs/baseline/srs.md) | **Controlling baseline**: success criteria, scope, FR/NFR/BR, acceptance criteria, state machine |
| [docs/baseline/change-log.md](docs/baseline/change-log.md) | Every change from Phases 1–3 and during build (CR-xx) |
| [docs/adr/](docs/adr/README.md) | Architecture decision records |
| [docs/plan/implementation-plan.md](docs/plan/implementation-plan.md) | Architecture, permission matrix, schedule, report and presentation plan |
| [docs/trackers/traceability-matrix.md](docs/trackers/traceability-matrix.md) | Requirement → rule → screen → code → data → test |
| [docs/trackers/test-catalog.md](docs/trackers/test-catalog.md) | Test IDs used in code and in the report |
| [docs/trackers/defect-log.md](docs/trackers/defect-log.md) | Defect summary |
| [docs/deploy.md](docs/deploy.md) | Free-tier deployment runbook (Vercel, Firebase, GitHub schedule, push, Twilio) |
| [docs/evidence/](docs/evidence) | Screenshots and the complete automated test results |
| [docs/presentation/](docs/presentation) | Slides and the demonstration script |
| [docs/review/phase-1-3-review.md](docs/review/phase-1-3-review.md) | Gap review of Phases 1–3 against the rubric |
| [docs/phases/](docs/phases) | Phase 1–3 submissions (academic record) |

## Stack

React 19 · Vite · TypeScript · Tailwind CSS · React Router · Leaflet + OpenStreetMap · Recharts · Firebase Authentication (password, Google, anonymous guests) · Cloud Firestore (data and photos) · Firebase Cloud Messaging (web push) · Twilio (SMS, optional) · Node.js 22 command API on Vercel (CDN, serverless) or Cloud Functions · service worker + IndexedDB (offline) · Zod · Vitest · Playwright · axe-core · GitHub Actions.

## Workflow

- `main` is always green. Work goes on `feat/<issue>-<slug>` branches and merges through a PR that says `Closes #n` and lists the FR/BR IDs.
- The assessed version is the tag `v1.0.0`.
