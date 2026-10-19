# CivicLink

Municipal incident reporting and community alerts for Sol Plaatje Local Municipality (Kimberley). NPRJ740 final project, Advanced Diploma in ICT, Sol Plaatje University, 2026.

Residents report located, photo-evidenced incidents and follow them to resolution. Officials triage, assign and broadcast suburb-targeted alerts. Field workers complete tasks with proof. Every status change is recorded in an audit trail.

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

The web app defaults to the local emulator, so no `.env` file is needed. To point it at a real Firebase project, copy `.env.example` to `apps/web/.env.local`, set the project's web config and `VITE_USE_EMULATORS=false`, then deploy with `npx firebase deploy` (Cloud Functions require the Blaze plan). Never commit real keys or service-account files.

## Tests

| Command | What it runs |
|---|---|
| `npm run test:unit` | Domain unit tests (state machines, duplicate/SLA policies, validation, analytics): `UT-*` |
| `npm run coverage` | Same, with coverage (CI fails below 80% lines) |
| `npm run test:emulator` | Security Rules matrix `RT-*` and Cloud Functions integration `IT-*` against the emulators |
| `npm run test:e2e` | Playwright end-to-end `E2E-*` / `NFT-*` (run `npx playwright install chromium` once) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript strict mode |

Test IDs match [the test catalogue](docs/trackers/test-catalog.md) and the final report. CI runs all of the above plus a gitleaks secret scan on every push.

## Repository layout

```
apps/web/            React + Vite + TypeScript SPA (resident, official, field worker, admin)
functions/           Cloud Functions: callable command API, services, schedules (TX-1..TX-3)
packages/shared/     Domain logic shared by web and functions: schemas, state machines, policies
firestore.rules      Firestore Security Rules (role/permission matrix)
storage.rules        Storage rules (photo uploads)
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
| [docs/review/phase-1-3-review.md](docs/review/phase-1-3-review.md) | Gap review of Phases 1–3 against the rubric |
| [docs/phases/](docs/phases) | Phase 1–3 submissions (academic record) |

## Stack

React 19 · Vite · TypeScript · Tailwind CSS · React Router · Leaflet + OpenStreetMap · Recharts · Firebase Authentication · Cloud Firestore · Cloud Functions (Node 22, `africa-south1`) · Cloud Storage · Zod · Vitest · Playwright · GitHub Actions.

## Workflow

- `main` is always green. Work goes on `feat/<issue>-<slug>` branches and merges through a PR that says `Closes #n` and lists the FR/BR IDs.
- The assessed version is the tag `v1.0.0`.
