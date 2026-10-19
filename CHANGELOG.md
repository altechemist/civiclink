# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: SemVer. `v1.0.0` is the assessed release.

## [1.0.0] - 2026-10-30

### Added
- **Residents:** self-registration; three-step located incident report with up to 3 photos; reference numbers; duplicate detection within 100 m / 72 h; my reports with live lifecycle and audit timeline; confirm or reopen within 7 days; suburb alerts feed with read receipts; community map (privacy-safe projection); in-app notifications.
- **Officials:** department-scoped dashboard and report queue (filters, search, CSV export); triage, reject, assign, reassign and escalate; internal notes; alert composer with live preview; alert history with delivery and read counts; live analytics.
- **Field workers:** task list; accept, start and complete with notes and proof photos.
- **Administrators:** staff accounts, roles and activation; departments (SLA hours) and categories; system log; on-demand SLA escalation and auto-close.
- **Accounts:** Google sign-in with profile completion, password reset, profile editing, POPIA self-deletion with anonymised records; admin-configurable report rate limit; photo compression; offline cache of viewed screens; clearer location guidance.
- **Deployment:** free-tier configuration (Vercel + Firebase Spark): Node HTTP adapter for the command API, photos stored as binary Firestore documents, hourly GitHub Actions schedule.
- **Backend:** callable command API with role checks and shared Zod validation; transactions TX-1 (submit), TX-2 (assign), TX-3 (complete); hourly SLA escalation and daily auto-close schedules; Firestore and Storage Security Rules.
- **Quality:** 136 automated tests (unit, security rules, API integration, Playwright E2E on Chromium and Firefox, accessibility and timing); GitHub Actions CI with secret scan.
- **Documentation:** consolidated SRS, change log CR-01 to CR-28, ADRs, PlantUML diagrams, traceability matrix, test catalogue, defect log, UI evidence, final report builder, demo script.

### Fixed
- DEF-01 to DEF-05 (see `docs/trackers/defect-log.md`).

### Deferred
- FR-24 web push, FR-25 SMS, FR-27 offline drafts, FR-28 scheduled alerts, bulk assignment.
