# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: SemVer. `v1.0.0` is the assessed release.

## [1.0.0] - 2026-11-06

### Added
- **Public (no account):** public home with active alerts, open-issue map with an incident list, and live figures; transparency page (time to fix, SLA compliance, satisfaction); guest reporting through anonymous sign-in, with the option to keep reports by creating or signing in to an account.
- **Residents:** self-registration; three-step located incident report with up to 3 photos; reference numbers; duplicate detection within 100 m / 72 h; my reports with a live progress bar and audit timeline; confirm with a 1–5 rating or reopen within 7 days; suburb alerts with read receipts; community map with "Me too"; web push and SMS for emergency alerts (opt-in); profile editing and POPIA self-deletion with anonymised records.
- **Officials:** department dashboard and report queue (filters, search, CSV export); triage, reject, assign singly or in bulk, reassign and escalate; internal notes; alerts sent now or scheduled, with delivery and read counts; analytics.
- **Field workers:** task list; accept, start and complete with notes and proof photos.
- **Administrators:** staff accounts, roles and activation; departments, categories and SLA targets; report limits; system log; SMS outbox and test SMS.
- **Offline and PWA:** installable app; every screen cached by the service worker; reports saved in an on-device outbox and sent on reconnect, with idempotent submission (`clientId`) so a resend never creates a second report.
- **Deployment:** free tier (Vercel + Firebase Spark): Node command API on Vercel, photos stored as binary Firestore documents, hourly GitHub Actions schedule, CDN-cached public endpoints, enforced Content Security Policy and HSTS.
- **Backend:** command API with role checks and shared Zod validation; transactions TX-1 (submit), TX-2 (assign), TX-3 (complete); SLA escalation, auto-close and scheduled alerts; Firestore Security Rules for every role; Twilio SMS gateway with a simulated fallback.
- **Quality:** 185 automated tests, all passing (unit, Security Rules, API integration, Playwright end-to-end, mobile, PWA and deployed-site checks); GitHub Actions CI with coverage gate and secret scan.

### Fixed
- DEF-01 to DEF-17 (see `docs/trackers/defect-log.md`).
