# CivicLink

Municipal incident reporting and community alerts for Sol Plaatje Local Municipality (Kimberley).
NPRJ740 final project, Advanced Diploma in ICT, Sol Plaatje University, 2026.

Residents report located, photo-evidenced problems (burst pipes, outages, potholes, dumping) and follow them until they are fixed. Officials triage, assign and send suburb alerts. Field workers close tasks with proof. Anyone can see open issues and alerts without an account.

## Start here

| I want to… | Go to |
|---|---|
| **Use the live system** | **https://civiclink-five.vercel.app**. Open it signed out to see the public home page, or press **Report an issue** to report as a guest. |
| **Read the final report** | [docs/report/CivicLink_Final_Project_Report.pdf](docs/report/CivicLink_Final_Project_Report.pdf) (opens in the browser) or the [.docx](docs/report/CivicLink_Final_Project_Report.docx) |
| **See the slides** | [docs/presentation/CivicLink_Presentation.pdf](docs/presentation/CivicLink_Presentation.pdf), or the [.pptx](docs/presentation/CivicLink_Presentation.pptx) with speaker notes |
| **See the diagrams** | [docs/diagrams/](docs/diagrams), listed [below](#diagrams) |
| **Run it on my computer** | Follow [Run locally](#run-locally): two commands, no cloud account |
| **Check the tests** | [Run the tests](#run-the-tests); latest results: [docs/evidence/test-results.md](docs/evidence/test-results.md) (**185 of 185 passed**) |
| **Trace a requirement to its code and test** | [docs/trackers/traceability-matrix.md](docs/trackers/traceability-matrix.md) |

The assessed version is the tag **`v1.0.0`** (see Releases).

## Use the live system

1. Open **https://civiclink-five.vercel.app**.
2. Without signing in you can view alerts, the open-issue map and the transparency figures, and report a problem as a guest.
3. To use a staff role, open **Sign in** and pick a demo account. During the assessment period the login page has one-tap demo buttons; otherwise the password is supplied with the submission.

The live system runs on free tiers: the web app and API on Vercel (Cape Town region), data on Firebase (Johannesburg region). The first request after a quiet period can take a few seconds while the API starts.

## Run locally

**You need:** Node.js 22, Java 21 or later (for the Firebase emulators) and Git. You do **not** need a Firebase account or any API keys: everything runs on the Firebase Emulator Suite.

```bash
git clone https://github.com/altechemist/civiclink.git
cd civiclink
git checkout v1.0.0           # the assessed version
npx -y npm@11.6.2 ci          # use npm 11; npm 10 has a workspace bug
npm run dev                   # builds the API, starts the emulators, loads demo data, starts the app
```

Then open **http://127.0.0.1:5173**. The emulator data browser is at http://127.0.0.1:4000.

Every restart of `npm run dev` resets the database to the same demo data. No `.env` file is needed locally.

### Demo accounts (local)

All local accounts use the password **`CivicLink#2026`**. The login page has one-click buttons for them.

| Role | Email | Notes |
|---|---|---|
| Resident | thandi@civiclink.demo | Galeshewe; has reports in every state |
| Resident | pieter@civiclink.demo | Roodepan |
| Official | naledi@civiclink.demo | Water & Sanitation |
| Official | thabo@civiclink.demo / johan@civiclink.demo | Electricity / Roads |
| Field worker | sipho@civiclink.demo | Water & Sanitation |
| Field worker | bongani@civiclink.demo / mpho@civiclink.demo | Electricity / Roads |
| Administrator | admin@civiclink.demo | Can also use every official screen |

Scheduled rules (SLA escalation, auto-close, scheduled alerts) do not run by themselves in the emulator. To run them, sign in as the administrator and use **System log → Run scheduled rules now**.

## Run the tests

| Command | What it checks |
|---|---|
| `npm run test:unit` | Domain rules: state machines, duplicate and SLA policies, validation, analytics (`UT-*`) |
| `npm run test:emulator` | Security Rules for every role (`RT-*`) and the command API against the emulators (`IT-*`) |
| `npm run test:e2e` | Full browser workflows and performance/accessibility checks (`E2E-*`, `NFT-*`). Run `npx playwright install chromium` once first. |
| `npm run test:e2e:http` | The same browser tests through the Node API used on Vercel |
| `npm run test:pwa` | Installable app and offline mode on the production build (`NFT-10`) |
| `E2E_BASE_URL=https://civiclink-five.vercel.app npx playwright test -g "NFT-1[12]"` | CDN caching and security headers on the live site |
| `npm run coverage` | Unit tests with coverage (CI fails below 80% of lines) |
| `npm run lint` / `npm run typecheck` | ESLint and strict TypeScript |

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs all of these, plus a secret scan, on every push. Test IDs match the [test catalogue](docs/trackers/test-catalog.md) and the report.

## Documents

| Document | What it contains |
|---|---|
| [Final report (PDF)](docs/report/CivicLink_Final_Project_Report.pdf) | The complete project report: context, requirements, design, implementation, testing, evaluation |
| [Slides (PDF)](docs/presentation/CivicLink_Presentation.pdf) | 12 slides on the design and implementation decisions |
| [Demo script](docs/presentation/demo-script.md) | Demonstration order and a drill sheet for every requirement |
| [SRS](docs/baseline/srs.md) | Final requirements: success criteria, scope, FR/NFR/BR, acceptance criteria, state machines |
| [Change log](docs/baseline/change-log.md) | Every change since Phases 1–3 (CR-01 to CR-45) |
| [Phase 1–3 documents](docs/phases) | The earlier phase submissions |
| [Architecture decisions](docs/adr/README.md) | ADR-0001 to ADR-0009 |
| [Traceability matrix](docs/trackers/traceability-matrix.md) | Requirement → rule → screen → code → data → test |
| [Test catalogue](docs/trackers/test-catalog.md) | Every automated test by ID |
| [Defect log](docs/trackers/defect-log.md) | DEF-01 to DEF-17, with cause and fix |
| [Test results](docs/evidence/test-results.md) | Latest full run, every test |
| [Screenshots](docs/evidence) | UI evidence used in the report |
| [Deployment guide](docs/deploy.md) | How the live system is set up (Firebase, Vercel, schedule, push, Twilio) |
| [Changelog](CHANGELOG.md) | What is in release 1.0.0 |

## Diagrams

All diagrams are in [docs/diagrams/](docs/diagrams) as PNG images and appear in the report.

| Diagram | File |
|---|---|
| System context | [context.png](docs/diagrams/context.png) |
| Use cases | [usecase.png](docs/diagrams/usecase.png) |
| Workflow 1, submit a report: activity / sequence | [activity-w1.png](docs/diagrams/activity-w1.png) / [sequence-w1.png](docs/diagrams/sequence-w1.png) |
| Workflow 2, resolve a report: activity / sequence | [activity-w2.png](docs/diagrams/activity-w2.png) / [sequence-w2.png](docs/diagrams/sequence-w2.png) |
| Report and task state machines | [state-report.png](docs/diagrams/state-report.png) / [state-task.png](docs/diagrams/state-task.png) |
| Architecture | [architecture.png](docs/diagrams/architecture.png) / [overview.png](docs/diagrams/overview.png) |
| Classes | [class.png](docs/diagrams/class.png), split into [class-domain.png](docs/diagrams/class-domain.png) and [class-services.png](docs/diagrams/class-services.png) |
| Data model | [data-model.png](docs/diagrams/data-model.png) |
| Deployment | [deployment.png](docs/diagrams/deployment.png) / [deploy-simple.png](docs/diagrams/deploy-simple.png) |

## What it does

All 39 functional requirements are in the release.

| Who | What they can do |
|---|---|
| Public (no account) | See active alerts, the open-issue map and live figures (FR-38); report as a guest and keep the report later with an account (FR-39); transparency page with time to fix, SLA compliance and satisfaction (FR-36) |
| Residents | Register, sign in with password or Google, reset password (FR-01, FR-29, FR-30); 3-step located report with photos, reference number and duplicate detection (FR-03 to FR-05); follow reports live (FR-06); confirm with a 1–5 rating or reopen (FR-14, FR-37); community map with "Me too" (FR-07, FR-33); suburb alerts, web push and SMS for emergencies (FR-17, FR-24, FR-25); install the app, report offline and send on reconnect (FR-27, FR-34); edit profile and delete the account (POPIA) (FR-31, FR-32) |
| Officials | Department queue with filters, search and CSV export (FR-08, FR-26); triage, reject, assign one or many, reassign, escalate (FR-09 to FR-13, FR-35); alerts now or scheduled, with delivery and read counts (FR-16, FR-18, FR-28); analytics (FR-19); internal notes (FR-22) |
| Field workers | Accept, start and complete tasks with notes and proof photos (FR-11) |
| Administrators | Staff accounts and roles, departments, categories, SLA targets, report limits, system log, SMS outbox and test SMS (FR-20, FR-21, FR-23) |

## Repository layout

```
apps/web/            React + Vite + TypeScript web app (all roles, service worker in public/sw.js)
functions/           Command API: commands.ts (all commands), services/, adapters index.ts (Cloud Functions) and http.ts (Vercel)
api/                 Vercel serverless entry points
packages/shared/     Rules shared by the app and the API: schemas, state machines, policies, analytics
firestore.rules      Security Rules (who can read what; all writes go through the API)
scripts/             Demo data (seed.ts), local Node API server, Vercel setup
tests/               Security Rules tests, Playwright end-to-end and PWA tests, emulator harness
docs/                Report, slides, diagrams, requirements, decisions, trackers, evidence, phase documents
```

## Stack

React 19 · Vite · TypeScript · Tailwind CSS · Leaflet + OpenStreetMap · Recharts · Firebase Authentication (password, Google, anonymous guests) · Cloud Firestore · Firebase Cloud Messaging · Twilio SMS · Node.js 22 API on Vercel · service worker + IndexedDB · Zod · Vitest · Playwright · axe-core · GitHub Actions.

## Configuration

Locally nothing needs configuring. For a deployment, copy [.env.example](.env.example) and follow [docs/deploy.md](docs/deploy.md). Never commit real keys or service-account files.
