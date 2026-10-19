# CivicLink

Municipal incident reporting and community alerts for Sol Plaatje Local Municipality (Kimberley). NPRJ740 final project, Advanced Diploma in ICT, Sol Plaatje University, 2026.

Residents report located, photo-evidenced incidents and track them. Officials triage, assign and broadcast suburb-targeted alerts. Field workers complete tasks with proof. Every status change is recorded.

> **Status:** Stage 4 in progress. The application is not scaffolded yet. See [the implementation plan](docs/plan/implementation-plan.md).

## Documentation map

| Document | Purpose |
|---|---|
| [docs/baseline/srs.md](docs/baseline/srs.md) | **Controlling baseline**: success criteria, scope, FR/NFR/BR, acceptance criteria, state machine |
| [docs/baseline/change-log.md](docs/baseline/change-log.md) | Every change from Phases 1–3 and during build (CR-xx) |
| [docs/adr/](docs/adr/README.md) | Architecture decision records |
| [docs/plan/implementation-plan.md](docs/plan/implementation-plan.md) | Architecture, schedule, definition of done, report and presentation plan |
| [docs/trackers/traceability-matrix.md](docs/trackers/traceability-matrix.md) | Requirement → rule → screen → code → data → test |
| [docs/trackers/test-catalog.md](docs/trackers/test-catalog.md) | Test IDs used in code and in the report |
| [docs/trackers/defect-log.md](docs/trackers/defect-log.md) | Defect summary |
| [docs/review/phase-1-3-review.md](docs/review/phase-1-3-review.md) | Gap review of Phases 1–3 against the rubric |
| [docs/phases/](docs/phases) | Phase 1–3 submissions (academic record) |

## Stack

React + Vite + TypeScript + Tailwind · Firebase Authentication · Cloud Firestore · Cloud Functions (Node 22) · Cloud Storage · Leaflet + OpenStreetMap · Vitest · Playwright · GitHub Actions. The assessed runtime is the Firebase Emulator Suite (ADR-0003).

## Setup

Prerequisites: Node 22 (`nvm use`), Java 17+ (for the Firebase emulators), `npm i -g firebase-tools`.

The setup steps, environment variables, seeding and demo accounts are added on Day 1 and verified on a clean clone before the `v1.0.0` tag.

## Workflow

- `main` is always green. Work happens on `feat/<issue>-<slug>` branches and merges through a PR that says `Closes #n` and lists the FR/BR IDs.
- Test IDs from the test catalogue go in the test names.
- The submitted version is the tag `v1.0.0`.
