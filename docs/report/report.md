<!--
Source of the NPRJ740 Final Project Report. Build the .docx (template styles, auto-numbered headings) with:
  python3 docs/report/build_report.py
Conventions: "#!" = unnumbered Heading 1; "#" Heading 1; "##" Heading 2; "###" Heading 3; "- " bullet;
"Table: x" caption before a pipe table; "![Figure: caption](path)" image; "> VERIFY:" highlighted note;
"{{COMMIT}}", "{{TAG}}", "{{REPO}}" are filled from git at build time; "\pagebreak" page break.
-->

#! EXECUTIVE SUMMARY

Sol Plaatje Local Municipality in Kimberley receives reports of burst pipes, power outages, potholes and illegal dumping by telephone, walk-in visits and community WhatsApp groups. Reports are logged by hand without a precise location. The same incident is reported many times. Field teams are dispatched by phone with no record of progress, and residents hear nothing back unless they call again. When municipal workers went on strike on 31 March 2026 and blocked roads across the city, there was no official way to warn commuters.

CivicLink is a web application that connects four groups in one workflow. **Residents** report incidents from their phones with a map location, photos and a severity, receive a reference number, and follow the report live until it is fixed. **Municipal officials** triage reports for their department, assign them to field workers, escalate overdue work and broadcast alerts to specific suburbs. **Field workers** receive tasks on their phones, record progress and close each task with completion notes and a proof photo. **Administrators** manage staff accounts, departments and incident categories.

The final release implements 31 of the 34 specified functional requirements, including all 14 Must-have requirements. The core lifecycle runs end to end: report, duplicate detection, triage, assignment, field completion, and resident confirmation or reopening. It is supported by real-time notifications, suburb-targeted alerts with read receipts, a privacy-safe community map, live service-delivery analytics, SLA-based automatic escalation, a complete audit trail, web push notifications, a "Me too" button to confirm existing issues, an installable app that opens offline, Google sign-in, and self-service account deletion that meets POPIA's right to erasure. SMS alerts, offline drafting and scheduled alerts were deliberately deferred.

The system is built with React and TypeScript on Firebase Authentication and Cloud Firestore, with a Node.js command API. Every state-changing operation runs on the server inside a database transaction, and access is enforced by Security Rules. It runs entirely on free tiers: the deployed system uses Vercel and Firebase's free Spark plan, and a local configuration using the Firebase Emulator Suite can be reproduced with two commands and no cloud account. It is verified by 143 automated tests (unit, security-rule, API integration, end-to-end and non-functional) running in continuous integration. All five success criteria were achieved.

# PROJECT CONTEXT

**Application domain.** Municipal service delivery: the reporting, dispatch and resolution of infrastructure and community incidents (water, electricity, roads, waste and public safety), and communication between a municipality and its residents.

**Primary users and client.** The intended client is Sol Plaatje Local Municipality, Northern Cape. Its users are residents of the municipal area (Kimberley, Galeshewe, Roodepan, Ritchie, Platfontein and surrounding areas), municipal officials in the five service departments, field workers who carry out repairs, and system administrators.

**Basis of the project.** The project is based on a **real organisation and real events** (the municipality, its departments and the 31 March 2026 strike). The requirements were gathered through a **simulated** stakeholder interview with a senior infrastructure official, an analysis of the municipality's daily reporting transactions, and published sources. CivicLink has not been commissioned or deployed by the municipality.

# PROBLEM, PURPOSE AND SUCCESS CRITERIA

## Problem Statement

Residents of Sol Plaatje have no dependable digital channel for reporting service failures, and the municipality has no single system for managing them. The Phase 1 investigation found the following:

- **No precise capture.** Calls are written on paper or in spreadsheets, without GPS coordinates or photos, so field teams are sent to the wrong place and repeat visits are common, especially for illegal dumping.
- **Duplicate reports.** The same burst pipe or outage is reported many times across channels, which wastes call-centre time and distorts priorities.
- **No accountability for dispatch.** Supervisors phone field workers directly, leaving no record of who was assigned, when work started, or whether it was finished.
- **No feedback to residents.** Residents are not told when a report is accepted or resolved, so they call back repeatedly. This adds to the call-centre load and erodes trust.
- **No targeted public communication.** During the 31 March 2026 strike, road closures were communicated only by radio and informal WhatsApp groups. Residents and taxi commuters received no official guidance.
- **No management visibility.** Without data, the municipality cannot measure response times, compare departments or identify hotspots.

The stakeholder questionnaire reported response times of 24–72 hours for burst pipes, mainly because reports were routed to the wrong team. These problems are structural rather than individual: they come from analogue, fragmented processes. A shared digital system that records every report, assignment and status change in one place, enforces routing and accountability rules, and pushes updates to the people affected directly addresses each of them.

Published evidence supports these findings. Sol Plaatje is home to 270,078 people (Statistics South Africa, 2023). The municipality's own plan sets a turnaround strategy for water and electricity losses (Sol Plaatje Local Municipality, 2022), and municipal management has reported physical and technical water losses of about 60%, with inner-city pipelines bursting frequently (Noordkaap Bulletin, 2024). Residents have publicly criticised slow responses to near-daily burst pipes (Diamond Fields Advertiser, 2026), the same response-time gap identified in the interview. Nationally, only 34 of South Africa's municipalities (13%) obtained clean audits in 2022-23, and the Auditor-General reports weak controls over performance information and service delivery (Auditor-General South Africa, 2024). Accountable, traceable records of service delivery are therefore a recognised need, not only a local one.

> VERIFY: Quick final check of the two press figures (60% water losses; near-daily bursts) against the articles listed in the references.

## Project Purpose

CivicLink is intended to replace the municipality's manual, fragmented incident reporting with one accountable digital workflow. Residents should be able to report a located, evidenced incident in under a minute and follow it to resolution. Officials should be able to route and dispatch work and warn affected suburbs immediately. Field workers should be able to close tasks with proof. Every action should leave an auditable record.

## Success Criteria

Table: Success criteria

| ID | Success criterion | How it is verified |
|---|---|---|
| SC-01 | The complete incident lifecycle runs end-to-end on the submitted system: a resident submits, an official triages and assigns, a field worker completes with proof, and the resident sees the report resolved with a full status history. | End-to-end test E2E-01; demonstration |
| SC-02 | The key business rules are enforced on the server, not only in the interface: duplicate detection, allowed status transitions, one active task per report, valid assignment and SLA escalation. | Unit and integration tests for BR-03 to BR-11 |
| SC-03 | Role-based access control holds: each role can perform exactly the functions in the permission matrix and nothing else. | Security-rule tests RT-*, API authorisation tests, E2E-04 |
| SC-04 | Residents receive timely, targeted information: a status change or a suburb alert appears in the resident's app within 5 seconds, without refreshing. | NFT-05, E2E-03 |
| SC-05 | Officials have operational visibility from live data: dashboard metrics match the known dataset. | UT-ANL-01, IT-ANL-01 |

# SOLUTION OVERVIEW AND SCOPE

## Solution Overview

CivicLink is a responsive web application backed by Firebase. The system boundary contains the React single-page application (with separate resident, official, field-worker and administrator areas), a Node.js command API (served by Cloud Functions locally and by Vercel serverless functions when deployed), Cloud Firestore and Firebase Authentication. The external actors are the four user roles. The only external services are OpenStreetMap, which supplies map tiles, and the browser's geolocation service on the user's device.

Its major functional areas are:

- **Incident reporting:** a three-step report form with category, map location, suburb, landmark, description, severity and up to three photos; reference numbers; and duplicate detection within 100 m.
- **Tracking and feedback:** a live status lifecycle, an audit timeline, in-app notifications, confirmation or reopening by the resident, and automatic closure.
- **Dispatch:** a department-scoped report queue with triage, rejection, assignment, reassignment and escalation, plus internal staff notes.
- **Field work:** a mobile task list where the worker accepts, starts and completes tasks with notes and proof photos.
- **Community communication:** suburb-targeted alerts with delivery and read receipts, and a community incident map with approximate locations.
- **Management and administration:** live analytics on volumes, resolution time and SLA compliance; user, role, department and category management; and a system log.

![Figure: CivicLink system context diagram](docs/diagrams/context.png){width=5.5}

## Final Release Scope

The submitted release (tag {{TAG}}) includes the following capabilities. Each one is traceable to its requirements in Section 4 and to its tests in Section 7.

Table: Final release scope

| Capability | Requirements | Priority |
|---|---|---|
| Resident registration, sign-in and role-based routing; account deactivation | FR-01, FR-02, FR-20 | Must |
| Located incident report with photos; reference number; duplicate detection | FR-03, FR-04, FR-05 | Must |
| My reports with live status lifecycle and audit timeline | FR-06 | Must |
| Department report queue with filters, search and CSV export | FR-08, FR-26 | Must / Could |
| Triage, reject, assign field worker | FR-09, FR-10 | Must |
| Field-worker task list; accept, start, complete with proof | FR-11 | Must |
| Real-time in-app notifications | FR-15 | Must |
| Suburb-targeted alert broadcast and resident alerts feed | FR-16, FR-17 | Must |
| Reassignment; manual and SLA-based escalation; resident confirm/reopen; auto-close | FR-12, FR-13, FR-14 | Should |
| Community incident map (privacy-safe) | FR-07 | Should |
| Alert history with delivery and read counts | FR-18 | Should |
| Service-delivery analytics | FR-19 | Should |
| Department and category configuration | FR-21 | Should |
| Internal staff comments; system log | FR-22, FR-23 | Could |
| Google sign-in; password reset; profile editing; POPIA account deletion | FR-29–FR-32 | Should |
| "Me too" confirmation of open issues; installable app with offline shell | FR-33, FR-34 | Should |
| Web push notifications | FR-24 | Could |

## Excluded and Deferred Capabilities

Table: Excluded and deferred capabilities

| Capability | Status | Reason |
|---|---|---|
| SMS alerts for residents without data (FR-25) | Deferred | Paid external service (e.g. Twilio); cannot be verified in the assessment environment |
| Offline report drafting with synchronisation (FR-27) | Deferred | Conflict handling for drafts and uploads exceeds the time available |
| Scheduled (future-dated) alerts (FR-28) | Deferred | Low value for the MVP; immediate alerts cover the strike scenario |
| Bulk assignment of reports | Deferred | Efficiency feature; single assignment covers the workflow |
| Native Android/iOS apps | Excluded | The responsive web app works on low-end phones without app-store distribution |
| Google Maps and reverse geocoding | Excluded (replaced) | Replaced by Leaflet and OpenStreetMap (decision D4) |
| 99.5% availability, 10 000 concurrent users, multi-region failover | Excluded | Production targets from Phases 1–2 that cannot be verified in a student environment |
| AI/ML prediction | Excluded | Not part of the product |

## Known Limitations and Open Issues

All capabilities listed in Section 3.2 are complete and verified. The following limitations affect included functionality:

Table: Known limitations

| Area | Limitation | Impact | Status / workaround |
|---|---|---|---|
| Push (FR-24) | Push is best-effort and per device; on iPhone it works only for the installed app (iOS 16.4+) | A resident who has not turned push on sees updates only in the app | In-app notifications remain the guaranteed channel; SMS (FR-25) deferred |
| Offline (FR-34) | Offline mode is read-only | New reports cannot be queued without signal | Submit is disabled with an explanation; offline drafts (FR-27) deferred |
| Scheduled rules (FR-13, FR-14) | The local emulator does not fire scheduled functions | In the local demo, escalation and auto-close run when an administrator selects "Run SLA & auto-close now" | When deployed, Cloud Scheduler runs them hourly and daily |
| Alert broadcast (FR-16) | Delivery records are written in batches after the alert document, not in one transaction | A failure during a broadcast could leave the recipient count higher than the stored delivery records | Acceptable at municipal scale; records can be re-derived from the suburb query |
| Location (FR-03) | No street address; location is a map pin plus suburb and optional landmark | Officials rely on the pin and the landmark text | Deliberate (decision D4) |

# SYSTEM REQUIREMENTS SPECIFICATION

The requirements below are the consolidated baseline that controls the project. Changes from the Phase 1–3 documents (for example the added Administrator actor, the eight-state report lifecycle and the rewritten non-functional requirements) are recorded as change requests CR-01 to CR-32 in `docs/baseline/change-log.md`.

## Functional Requirements

Table: Functional requirements

| ID | Functional requirement | Priority | Release status |
|---|---|---|---|
| FR-01 | The system shall allow a member of the public to register as a Resident with name, email, password, suburb and optional phone number. | Must Have | Included |
| FR-02 | The system shall authenticate users by email and password and route each user to the interface for their role; deactivated accounts are refused. | Must Have | Included |
| FR-03 | The system shall allow an authenticated Resident to submit an incident report with category, description, map location, suburb, optional landmark, severity and 0–3 photos. | Must Have | Included |
| FR-04 | The system shall give each accepted report a unique reference (CL-YYYY-NNNN), status Submitted, a default department derived from its category, and a first history entry. | Must Have | Included |
| FR-05 | The system shall detect when a new report duplicates an open report, link it to the original and tell the resident the original's reference. | Must Have | Included |
| FR-06 | The system shall allow a Resident to list their reports (All / Active / Resolved) and view a report's details and full status timeline. | Must Have | Included |
| FR-07 | The system shall show a community map of open reports with category filtering, without revealing reporter identity or photos. | Should Have | Included |
| FR-08 | The system shall allow an Official to view the report queue with filters (status, category, department, severity, unassigned) and search by reference. | Must Have | Included |
| FR-09 | The system shall allow an Official to triage a Submitted report (to Under Review, confirming or changing the department) or reject it with a reason. | Must Have | Included |
| FR-10 | The system shall allow an Official to assign a report under review or escalated to an active field worker in its department, creating a task and moving the report to In Progress. | Must Have | Included |
| FR-11 | The system shall allow a Field Worker to view, accept, start and complete their tasks; completion requires notes and at least one proof photo and resolves the report. | Must Have | Included |
| FR-12 | The system shall allow an Official to reassign an active task to another eligible field worker. | Should Have | Included |
| FR-13 | The system shall escalate open reports that exceed their department's SLA hours automatically, and allow an Official to escalate manually with a reason. | Should Have | Included |
| FR-14 | The system shall allow the reporting Resident to confirm or reopen a resolved report within 7 days, and shall close resolved reports automatically after 7 days. | Should Have | Included |
| FR-15 | The system shall notify users in-app in real time: residents on every status change of their (or a followed) report, officials on new reports, and field workers on assignment. | Must Have | Included |
| FR-16 | The system shall allow an Official to broadcast an alert with type, title, message, target suburbs (or all) and expiry, recording a delivery record for each targeted resident. | Must Have | Included |
| FR-17 | The system shall show Residents the active, unexpired alerts for their suburb, emergencies first, with unread markers and read receipts. | Must Have | Included |
| FR-18 | The system shall allow an Official to view sent alerts with recipient and read counts and to end an alert early. | Should Have | Included |
| FR-19 | The system shall show Officials an analytics dashboard computed from live data: open reports, resolution time, SLA compliance per department and the daily trend. | Should Have | Included |
| FR-20 | The system shall allow an Administrator to create staff accounts, change roles and deactivate or reactivate accounts. | Must Have | Included |
| FR-21 | The system shall allow an Administrator to manage departments (name, SLA hours, active) and categories (name, default department, active). | Should Have | Included |
| FR-22 | The system shall allow Officials and Field Workers to add internal comments to a report that residents cannot see. | Could Have | Included |
| FR-23 | The system shall record significant system events and show them to Administrators. | Could Have | Included |
| FR-24 | The system shall send web push notifications for status changes, task assignments and suburb alerts to devices where the user has turned them on. | Could Have | Included |
| FR-25 | The system shall send SMS alerts to residents without data access. | Won't Have (this release) | Deferred |
| FR-26 | The system shall allow an Official to export the filtered report queue as CSV. | Could Have | Included |
| FR-27 | The system shall let residents draft reports offline and submit them when connectivity returns. | Won't Have (this release) | Deferred |
| FR-28 | The system shall allow alerts to be scheduled for a future time. | Won't Have (this release) | Deferred |
| FR-29 | The system shall allow users to sign in with a Google account; on first sign-in a new user completes a resident profile. | Should Have | Included |
| FR-30 | The system shall allow users to request a password-reset email without revealing whether an account exists. | Should Have | Included |
| FR-31 | The system shall allow users to update their name and phone number, and residents their suburb. | Should Have | Included |
| FR-32 | The system shall allow a Resident to delete their account; personal data is erased and their reports are kept anonymised. | Should Have | Included |
| FR-33 | The system shall allow a Resident to confirm an existing open issue from the community map ("Me too"), raising its affected count and following its progress. | Should Have | Included |
| FR-34 | The system shall be installable on a phone's home screen and shall open, with previously viewed information, without a connection. | Should Have | Included |

## Non-Functional Requirements

All non-functional requirements are verified in the assessment environment: the local Firebase Emulator Suite with the seeded dataset (150 reports, 15 users) on the latest Chrome and Firefox.

Table: Non-functional requirements

| ID | Quality attribute | Requirement | Verification |
|---|---|---|---|
| NFR-01 | Security: authorisation | Every role-restricted read or write is enforced server-side by Security Rules and Cloud Function role checks, independently of the user interface. | Security-rule tests, authorisation tests |
| NFR-02 | Security: authentication | Passwords are handled only by Firebase Authentication (minimum 8 characters); no credential is stored in Firestore or the repository; roles are carried as signed custom claims. | Code review, rule tests, secret scan |
| NFR-03 | Security: input validation | All commands validate input on the server against shared schemas; invalid input is rejected with field-level messages and no data change. | Integration tests |
| NFR-04 | Security: secrets | No secrets are kept in source control; configuration comes from environment variables with a committed `.env.example`. | Secret scan (gitleaks) |
| NFR-05 | Performance: propagation | A new report appears on the official's queue, and a status change appears on the resident's screen, within 5 seconds without a refresh. | Timing test NFT-05 |
| NFR-06 | Performance: responsiveness | Key screens become interactive within 3 seconds; commands complete within 2 seconds (95th percentile of 50 calls). | Timing test NFT-06 |
| NFR-07 | Usability: mobile | Resident and field-worker screens work at 360×640 with no horizontal scrolling; submitting a report takes at most 3 steps. | NFT-07 |
| NFR-08 | Accessibility | Key pages have no serious or critical WCAG 2.1 A/AA violations in an automated axe-core audit. | NFT-08 |
| NFR-09 | Compatibility | Core flows pass on the latest Chrome and Firefox. | End-to-end tests on both browsers |
| NFR-10 | Integrity | Multi-document operations are atomic; conflicting concurrent commands result in exactly one success; failures leave no partial data. | Concurrency tests |
| NFR-11 | Privacy (POPIA) | Residents' identity, contact details and photos are visible only to the reporter and staff; public map data contains no personal information. | Rule tests, data classification |
| NFR-12 | Maintainability | TypeScript strict mode, lint-clean, shared domain logic with at least 80% line coverage, and CI on every push. | CI, coverage report |

## Business Rules

Table: Business rules

| ID | Rule |
|---|---|
| BR-01 | Only an authenticated, active user with role Resident may submit a report. |
| BR-02 | A report needs an active category, a description of 10–300 characters, a location inside the Sol Plaatje municipal bounds, a suburb from the configured list and a severity. It may carry 0–3 photos, each a real JPEG/PNG/WebP image (checked by its content) of at most 700 KB once compressed; residents may pick files of up to 15 MB, which the app compresses. |
| BR-03 | A new report is a duplicate if an open report with the same category exists within 100 m and was created in the last 72 hours. The duplicate is stored as Duplicate, linked to the original; the original's affected count is incremented and the resident follows it. |
| BR-04 | References are CL-<year>-<sequence>, allocated in a transaction, unique and never reused. |
| BR-05 | A report's status may change only along the transitions of the report state machine (Figure 7). Every change appends an immutable history entry recording the actor, role, note and time. |
| BR-06 | A report has at most one active task at any time. |
| BR-07 | A report may be assigned only to an active Field Worker of the report's department, and only while it is Under Review, Escalated or (for reassignment) In Progress. |
| BR-08 | Only the assigned Field Worker may act on a task, and only in the order Assigned → Accepted → In Progress → Completed. |
| BR-09 | Completion requires notes of at least 10 characters and 1–3 proof photos, and sets the report to Resolved in the same transaction. |
| BR-10 | An open report not resolved within its department's SLA hours is escalated automatically (once); officials may escalate manually with a reason. |
| BR-11 | Only the reporting Resident may confirm or reopen a resolved report, within 7 days of resolution; afterwards it closes automatically. Closed, Rejected and Duplicate are terminal. |
| BR-12 | Rejection requires a reason of 10–300 characters and is allowed only for Submitted or Under Review reports. |
| BR-13 | Only Officials and Administrators may create alerts; an alert needs a title (≤ 100), message (≤ 500), at least one target suburb or All, and an expiry in the future and within 30 days. |
| BR-14 | A resident sees an alert only while it is active and unexpired and targets their suburb or All. |
| BR-15 | Only Administrators manage accounts and configuration; an Administrator cannot demote or deactivate their own account. |
| BR-16 | Self-registration always creates a Resident; staff roles are granted only by an Administrator; a deactivated account cannot sign in or call any function. |
| BR-17 | Reporter identity, contact details and photos are visible only to the reporter and staff; other residents see category, status, approximate location (about 100 m) and age only. |
| BR-18 | Internal comments are visible only to staff. |
| BR-19 | Inactive departments and categories cannot be selected for new reports, triage or assignment. |
| BR-20 | Officials may act only on reports of their own department; Administrators may act on any. |
| BR-21 | A resident may submit at most N reports in any rolling hour; N is set by an Administrator (1–100, default 10). |
| BR-23 | A resident may confirm ("Me too") an issue once, only while it is open, and not their own report. |
| BR-22 | When a resident deletes their account, their name, email, phone, photos, notifications, alert receipts, profile and sign-in are erased; their reports are kept for service records as "Former resident". Staff accounts are deactivated, never self-deleted. |

## Acceptance Criteria for Included Requirements

**FR-01 Register.** Valid details create a Resident account and profile. A duplicate email is refused with "Email already registered". A password shorter than 8 characters or a missing suburb is refused with a field message. A role sent by the client is ignored.

**FR-02 Sign in.** Valid credentials open the area for the user's role. Wrong credentials show a generic error. A deactivated account cannot sign in or call any function. Opening another role's page shows the access-denied page.

**FR-03 Submit report.** Every BR-02 rule is checked in the form and again on the server, with field-level messages. A location outside the municipality, a fourth photo, a file over 15 MB or a file that is not really an image is refused. On success the resident sees the reference number.

**FR-04 Reference.** Concurrent submissions receive distinct, sequential references. A new report is Submitted, routed to its category's department, and has one history entry.

**FR-05 Duplicate.** A report of the same category within 100 m of an open report from the last 72 hours is linked as a duplicate, and the resident is shown the original's reference. Beyond 100 m, a different category, or a closed original produces a new report.

**FR-06 My reports.** Only the resident's own (or followed) reports are shown. The tabs filter correctly. The timeline is chronological with actor role and note. Another resident's report cannot be opened. An empty state is shown when there are no reports.

**FR-07 Map.** Open reports appear as category-coloured markers with a working filter. Popups show category, status, suburb and age only. The public data contains no reporter, description or photos.

**FR-08 Queue.** Officials see only their department's reports (Administrators see all). Filters combine. Searching by reference finds the report. Unassigned reports are flagged. An empty result shows an empty state.

**FR-09 Triage / reject.** Triage moves Submitted to Under Review and records history. Rejection requires a reason. Triage from any other status, or by an official of another department, is refused.

**FR-10 Assign.** Only active workers of the report's department can be chosen. Assignment creates an Assigned task, moves the report to In Progress, and notifies the worker and resident. A report that already has an active task cannot be assigned again. Of two simultaneous assignments, exactly one succeeds.

**FR-11 Field worker.** Workers see only their own tasks. Steps must happen in order. Completion without notes or a proof photo is refused. Completion resolves the report and notifies the resident. Another worker cannot act on the task.

**FR-12 Reassign.** The old task becomes Reassigned and a new task is created. Reassigning to the same worker, or when there is no active task, is refused. A reassigned task can no longer be completed.

**FR-13 Escalate.** A report past its SLA is escalated by the next scheduled run, exactly once. Manual escalation requires a reason. An escalated report can still be assigned.

**FR-14 Confirm / reopen.** Within 7 days the reporter can confirm (Closed) or reopen with a reason (Under Review, officials notified). After 7 days both are refused and the schedule closes the report. Other residents cannot act on it.

**FR-15 Notifications.** Each lifecycle event creates notifications for the correct recipients. The unread badge updates live. Opening a notification marks it read and navigates to the record.

**FR-16 Broadcast.** BR-13 is enforced with field messages. A valid alert creates one delivery record per active resident in the target suburbs. Residents and field workers cannot broadcast.

**FR-17 Alerts feed.** Residents see only active, unexpired alerts for their suburb or All, emergencies first. Reading records a receipt once per resident.

**FR-18 Alert history.** Recipient and read counts match the delivery records. Ending an alert hides it from residents immediately.

**FR-19 Analytics.** The metrics match the dataset. Empty data shows "no data" rather than an invalid number. Residents cannot access analytics.

**FR-20 User administration.** Staff accounts are created with the correct role and department. Role changes and deactivation take effect immediately. Administrators cannot demote or deactivate themselves. Non-administrators are refused.

**FR-21 Configuration.** SLA hours must be a whole number from 1 to 720. Names are unique. A deactivated category disappears from the report form. The hourly report limit (BR-21) must be from 1 to 100.

**FR-22 Internal comments.** Officials of the report's department, its assigned field worker and Admins can add a note (1–1000 characters), and notes appear in time order with author and role. Residents and staff of other departments cannot read or add notes.

**FR-23 System log.** Administrative actions (account, role, configuration and settings changes), scheduled runs and unexpected server errors are recorded with level, source, time and actor. Only Administrators can view the log. Entries are never edited.

**FR-26 CSV export.** The export contains exactly the reports matching the current queue filters and search, with reference, category, department, suburb, severity, status, assignee, affected count and submitted/resolved times. Values with commas, quotes or line breaks are quoted correctly. The button is disabled when no reports match.

**FR-24 Web push.** With push turned on, a committed status change, new task or suburb alert produces one notification per device, and clicking it opens the related screen. A failed command sends nothing. Turning push off, or deleting the account, removes the device. The option is hidden where push is unavailable.

**FR-33 Me too.** From the map popup of an open issue, a resident confirms it once: the affected count increases, they follow its progress, and the timeline notes it. A repeat reports "already confirmed". Their own report, closed issues and staff callers are refused.

**FR-34 Installable and offline.** The browser offers to install CivicLink. With no connection, the app opens, previously viewed information still shows, and an offline notice explains that new reports need a connection (Submit is disabled).

**FR-29 Google sign-in.** A first-time Google user is taken to a profile step that needs a name and a suburb, and always becomes a Resident. An existing profile cannot be re-created.

**FR-30 Password reset.** The same confirmation is shown whether or not the email is registered.

**FR-31 Profile.** An invalid SA phone number is refused. A resident who changes suburb receives that suburb's alerts. Staff have no suburb.

**FR-32 Account deletion.** It requires typing DELETE. Afterwards the user cannot sign in. Their reports show "Former resident" without photos and generate no notifications. Staff cannot self-delete.

# SYSTEM DESIGN SPECIFICATION

The design described here is the final implemented design. Every diagram is generated from PlantUML source kept in the repository (`docs/diagrams/src`) and uses the identifiers of the code and the requirements.

## Use Cases and Workflows

The use-case diagram (Figure 2) shows the four human actors, plus the system scheduler that triggers SLA escalation and automatic closure. The Administrator inherits every Official capability.

![Figure: Use-case diagram of the final release](docs/diagrams/usecase.png){width=3.0}

Two end-to-end workflows were selected from the core functionality. Both diagrams for each workflow include the validation, authorisation, conflict and alternative paths, not only the successful path.

### Workflow W1: Submit an incident report (FR-03, FR-04, FR-05)

A resident completes the three-step form, and client validation gives immediate feedback. Photos are compressed in the browser (≤ 1280 px, ≤ 700 KB) and sent with the request. The `submitReport` command checks the caller's role and the input, verifies each photo's real type from its first bytes, and runs transaction TX-1, which also writes the photos as binary documents. TX-1 checks that the category is active, searches for open reports of the same category within 100 m, allocates the next reference, and writes either a new Submitted report (with the public map projection and notifications to the department's officials) or a Duplicate report linked to the original.

![Figure: Activity diagram, W1 submit incident report](docs/diagrams/activity-w1.png){width=3.9}

![Figure: Sequence diagram, W1 submit incident report](docs/diagrams/sequence-w1.png)

### Workflow W2: Triage, assign, complete and confirm (FR-09 to FR-14)

An official triages or rejects a report, then assigns it to an eligible field worker in transaction TX-2. The field worker accepts, starts and completes the task, and transaction TX-3 resolves the report. Finally the resident confirms the fix or reopens the report. The alternative and failure paths shown are: rejection; a report that already has an active task; an ineligible worker; skipped task steps; missing completion proof; a task that was reassigned while the worker was on site; and reopening.

![Figure: Activity diagram, W2 triage, assign, complete and confirm](docs/diagrams/activity-w2.png)

![Figure: Sequence diagram, W2 assign and complete](docs/diagrams/sequence-w2.png)

### Entity lifecycles

The **Report** has a meaningful lifecycle with eight states (Figure 7), implemented in `ReportStateMachine` in the shared package. Both the server (to enforce transitions) and the user interface (to offer only valid actions) use it. The **Task** lifecycle (Figure 8) is implemented in `TaskStateMachine`.

![Figure: State diagram of the Report entity](docs/diagrams/state-report.png){width=6.0}

![Figure: State diagram of the Task entity](docs/diagrams/state-task.png){width=2.4}

## System Architecture and Technology Stack

CivicLink follows a command–query separation on a serverless backend (Figure 9).
- **Reads** are made directly from Firestore through real-time listeners, protected by Security Rules.
- **State changes** go through callable Cloud Functions. These authenticate the caller, check the role, validate the input with the shared schemas, and run the business logic in Firestore transactions.
- **Domain logic** (schemas, state machines and policies) lives in a shared TypeScript package used by both the browser and the server.

![Figure: Logical architecture](docs/diagrams/architecture.png)

Table: Component responsibilities and technology stack

| Component | Technology | Responsibility |
|---|---|---|
| Web application | React 19, TypeScript, Vite, React Router, Tailwind CSS | Role-specific user interfaces, client-side validation, real-time views |
| Maps | Leaflet 1.9 with OpenStreetMap tiles | Location capture (GPS or draggable pin) and incident maps |
| Charts | Recharts 3 | Analytics visualisation |
| Command API | Node.js 22 command registry with two adapters: Vercel serverless functions (deployed) and Cloud Functions (local emulator) | Authentication and role checks, validation, business rules, transactions, notifications |
| Scheduled jobs | GitHub Actions (hourly) and Vercel Cron (daily) calling a secret-protected endpoint; Cloud Functions scheduler locally | SLA escalation, auto-close |
| Shared domain package | TypeScript, Zod 4 | Schemas, report/task state machines, duplicate, SLA and resolution policies, analytics |
| Database | Cloud Firestore | Persistent documents, real-time listeners, transactions |
| Photo storage | Cloud Firestore binary documents (`photos`) | Report and proof photos, compressed in the browser (decision D3) |
| Authentication | Firebase Authentication with custom claims | Email/password sign-in, role, department, suburb and active-account claims |
| Access control | Firestore Security Rules | Server-side enforcement of the permission matrix |
| Runtime: deployed | Vercel (static site + Node serverless functions, Cape Town region) and Firebase Spark (Auth, Firestore) | Free-tier production configuration (decision D3) |
| Runtime: local | Firebase Emulator Suite | Local Auth, Firestore and Functions for development, tests and offline demonstration |
| Testing / CI | Vitest, @firebase/rules-unit-testing, Playwright, axe-core, GitHub Actions, gitleaks | Automated verification |

## Key Architecture and Design Decisions

**D1: All state changes go through server-side commands (ADR-0001).**
- *Context:* the core rules span several documents: allocating a reference, the 100 m duplicate search, one active task per report, and resolving a report when its task completes.
- *Options:* (a) clients write to Firestore directly, guarded only by Security Rules; (b) callable Cloud Functions running transactions, with rules allowing only reads; (c) a custom Node/Express API with PostgreSQL.
- *Decision:* (b).
- *Rationale:* Security Rules cannot express multi-document transactional rules. (b) keeps a single enforcement point and still gets real-time reads from Firestore listeners. (c) would mean rebuilding authentication, real-time updates and storage, and abandoning three phases of design.
- *Consequences:* clean separation and testable services, and concurrency is handled by Firestore transactions. On the other hand, Firestore has no foreign-key constraints, so integrity depends on transactions and rules (Section 5.6), and deployed functions require Firebase's paid Blaze plan.

**D2: React single-page application instead of Next.js (ADR-0002).**
- *Context:* four role-specific interfaces, mobile-first for residents and workers.
- *Options:* Next.js, React with Vite, Flutter.
- *Decision:* React + Vite + React Router.
- *Rationale:* all data comes from the Firebase SDK in the browser, so server rendering adds complexity for no benefit. A static single-page app deploys to Firebase Hosting, and Phase 3 already used React Router conventions.
- *Consequences:* simple hosting and a fast build. Search-engine indexing is irrelevant for an authenticated application.

**D3: Free-tier deployment: Firebase Spark, a Node API on Vercel, and photos stored in Firestore (ADR-0006).**
- *Context:* the system had to be deployable without cost. Cloud Functions and Cloud Storage both require Firebase's paid Blaze plan.
- *Options:* (a) Blaze with a budget alert; (b) port to Supabase; (c) keep the free Spark plan (Auth, Firestore), serve the command API from a free Node host, and store photos in Firestore.
- *Decision:* (c). Vercel serverless functions run the API next to the static web app; photos are compressed to ≤ 700 KB and stored as binary documents.
- *Rationale:* the commands were already transport-independent, so a second adapter reuses every service unchanged and speaks the same callable protocol (the client only switches its URL). Vercel's free functions do not sleep, which matters in a live demonstration. A Supabase port would have meant rewriting the backend and about 90 tests.
- *Consequences:* two adapters must stay equivalent, so CI runs the complete E2E suite through both. Photo size is bounded by Firestore's 1 MiB document limit, and each photo view is one document read. The hourly SLA job runs from GitHub Actions, because Vercel's free cron is daily. The local emulator configuration remains for development, tests and an offline demonstration.

**D4: Leaflet and OpenStreetMap instead of Google Maps (ADR-0004).**
- *Context:* residents must pinpoint incidents, and staff must see them.
- *Options:* Google Maps with Geocoding, Mapbox, Leaflet with OpenStreetMap.
- *Decision:* Leaflet with OpenStreetMap.
- *Rationale:* no API key or billing is needed, and the suburb, which drives alert targeting, is chosen from a list anyway.
- *Consequences:* there is no reverse geocoding, so officials rely on the pin and the landmark text. Tile usage must follow the OpenStreetMap policy, which suits low volumes.

## Application Class Design

Figure 10 shows the implemented classes in two parts. The complete single diagram is `docs/diagrams/class.png`. The classes fall into three groups:
- **Domain entities** (`packages/shared/src/models.ts`), stored as Firestore documents.
- **Domain logic** (`packages/shared/src`): `ReportStateMachine` and `TaskStateMachine` define the allowed transitions; `DuplicatePolicy` (100 m, 72 h), `SlaPolicy` and `ResolutionPolicy` (7 days) are pure, fully unit-tested rules.
- **Application services** (`functions/src/services`), described below.

How the services fit together:
- **Entry point:** every callable is wrapped by `command()`, which authenticates the caller, loads their profile (refusing deactivated accounts), checks the role, validates the input and maps errors.
- **Report and task services:** `ReportService` implements submission (TX-1), triage, rejection, escalation, assignment (TX-2), reassignment, confirmation and reopening. `TaskService` implements the field-worker steps and completion (TX-3).
- **Single path for status changes:** both services use `ReportLifecycle.applyTransition`, so every status change is validated by the state machine, recorded in the history, reflected in the public projection and notified.
- **Other services:** `AlertService`, `UserService`, `ConfigService`, `CommentService`, `AnalyticsService` and `MaintenanceService` implement the remaining capabilities.

![Figure 10a: Class diagram (part 1), domain entities and relationships](docs/diagrams/class-domain.png)

![Figure 10b: Class diagram (part 2), application services and domain logic](docs/diagrams/class-services.png){width=5.6}

## User Interface and Interaction Design

There are four user roles, each with its own area:
- **Residents** use a mobile layout with a bottom navigation bar (Home, Map, Report, My reports, Alerts).
- **Field workers** use the same mobile layout, coloured green and reduced to their task list.
- **Officials and administrators** use a desktop layout with a sidebar.

Every screen handles loading, empty, error and permission-denied states. The screenshots below were captured from the submitted system with the seeded data (`tests/evidence/capture.spec.ts`). The photos in them are illustrative sample images.

Table: User interface evidence

| Figure | User | Purpose and main action | Requirement / workflow |
|---|---|---|---|
| 11 | Any | Sign in; demo-account shortcuts in the emulator | FR-02 |
| 12 | Resident | Three-step report: details with map pin, suburb, description, severity and photo | FR-03, W1 |
| 13 | Resident | Validation errors before submission | BR-02, NFR-03 |
| 14 | Resident | Duplicate detected; resident follows the original report | FR-05, W1 alternative path |
| 15 | Official | Department dashboard with KPIs and reports needing action | FR-08 |
| 16 | Official | Triage and assignment, with history and internal notes | FR-09, FR-10, W2 |
| 17 | Field worker | Task completion with notes and proof photo | FR-11, W2 |
| 18 | Resident | Completed state: resolved report with proof, confirm or reopen | FR-06, FR-14 |
| 19 | Official | Alert composition with a live resident preview | FR-16 |
| 20 | Resident | Suburb alerts feed (strike emergency pinned first) | FR-17 |
| 21 | Official | Analytics computed from live data | FR-19 |
| 22 | Administrator | User and role management | FR-20 |
| 23 | Resident | Permission denied when opening an official page | NFR-01 |
| 24 | Official | Empty state in the report queue | FR-08 |
| 25 | New resident | First Google sign-in completes the profile | FR-29 |
| 26 | Resident | Profile editing and POPIA account deletion | FR-31, FR-32 |

![Figure: Sign in (all roles)](docs/evidence/01-login.png){width=2.6}

![Figure: Resident, report step 2 (location, details and photo)](docs/evidence/06-report-step2-details.png){width=2.6}

![Figure: Resident, validation errors](docs/evidence/05-report-validation-errors.png){width=2.6}

![Figure: Resident, duplicate report detected](docs/evidence/09-report-duplicate.png){width=2.6}

![Figure: Official dashboard](docs/evidence/20-official-dashboard.png)

![Figure: Official, triage and assignment](docs/evidence/23-triage-assign.png)

![Figure: Field worker, completion with proof](docs/evidence/43-worker-completed.png){width=2.6}

![Figure: Resident, resolved report with proof and confirm/reopen](docs/evidence/11-report-resolved-confirm.png){width=2.6}

![Figure: Official, alert composer with preview](docs/evidence/26-alert-composer.png)

![Figure: Resident, alerts feed](docs/evidence/13-resident-alerts.png){width=2.6}

![Figure: Service-delivery analytics](docs/evidence/28-analytics.png)

![Figure: Administrator, user management](docs/evidence/30-admin-users.png)

![Figure: Permission-denied state](docs/evidence/15-permission-denied.png){width=2.6}

![Figure: Empty state in the report queue](docs/evidence/22-queue-empty-state.png)

![Figure: First Google sign-in, profile completion](docs/evidence/16-google-welcome.png){width=2.6}

![Figure: Resident profile with POPIA account deletion](docs/evidence/17-profile-popia.png){width=2.6}

## Data Design

CivicLink stores its persistent data in **Cloud Firestore**, a document database with real-time listeners and ACID transactions. Photos are stored in Firestore as well, as binary documents in the `photos` collection (decision D3), so the system needs no separate file store. Figure 27 shows the implemented document model. Collections are shown as entities; references between documents (Firestore has no foreign keys) are shown as relationships with their cardinalities.

![Figure: Firestore document model](docs/diagrams/data-model.png)

Table: Data dictionary (principal collections)

| Collection / field | Type | Key / required | Purpose |
|---|---|---|---|
| **users/{uid}** | | uid = Auth user id (PK) | Profile for every account |
| name, email | string | required | Display name; sign-in email (unique in Firebase Auth) |
| role | enum RESIDENT, OFFICIAL, FIELD_WORKER, ADMIN | required | Authorisation, mirrored as a custom claim |
| departmentId | string | FK departments; required for officials and workers | Department scope (BR-20) |
| suburb | string | required for residents | Alert targeting (BR-14) |
| isActive | boolean | required | Deactivation (BR-16) |
| **reports/{id}** | | auto id (PK) | Incident report |
| ref | string | required, unique | CL-YYYY-NNNN (BR-04) |
| reporterId, reporterName | string | FK users, required | Reporter (staff-only visibility) |
| categoryId, departmentId | string | FK, required | Routing |
| description | string (10–300) | required | Resident description |
| location, geohash | {lat,lng}, string | required | Map position; geohash for the 100 m duplicate query |
| suburb, landmark | string | suburb required | Human-readable location |
| severity | enum HIGH, MEDIUM, LOW | required | Priority of the resulting task |
| photoIds | string[0..3] | required (may be empty) | Ids of evidence photos (`photos`) |
| status | enum (8 states) | required | Lifecycle (Figure 7) |
| assignedWorkerId, activeTaskId | string | FK, optional | Current assignment (BR-06) |
| parentReportId, followerIds, affectedCount | string, string[], int | optional / required | Duplicate linkage (BR-03) |
| resolutionNotes, resolutionPhotoPaths | string, string[] | optional | Copied from the completed task |
| createdAt, updatedAt, resolvedAt, escalatedAt, closedAt | timestamp | createdAt/updatedAt required | Lifecycle times, SLA and analytics |
| **reports/{id}/history/{id}** | | auto id | Append-only audit trail: from, to, event, actorId, actorRole, actorName, note, at |
| **reports/{id}/comments/{id}** | | auto id | Internal notes: authorId, authorRole, text, createdAt |
| **publicReports/{id}** | | id = report id | Privacy-safe projection: ref, category, status, location rounded to about 100 m, suburb, isOpen |
| **tasks/{id}** | | auto id | Assignment: reportId (FK), workerId (FK), assignedBy, departmentId, priority, status, notes, completionNotes, proofPaths, timestamps |
| **alerts/{id}** | | auto id | type, title (≤ 100), message (≤ 500), targetSuburbs[], createdBy (FK), isActive, recipientCount, readCount, createdAt, expiresAt |
| **alerts/{id}/recipients/{uid}** | | uid (PK, FK users) | Delivery record: channel, deliveredAt, readAt |
| **users/{uid}/notifications/{id}** | | auto id | type, title, body, link, readAt, createdAt |
| **departments/{id}**, **categories/{id}** | | slug id | name (unique), slaHours (1–720) / icon and departmentId (FK), isActive |
| **users/{uid}/pushTokens/{hash}** | | SHA-256 of token | uid, token, createdAt (FR-24; server-only) |
| **photos/{id}** | | auto id | reportId (FK), ownerId (FK users), kind EVIDENCE/PROOF, contentType, size, data (bytes ≤ 700 KB), createdAt; readable by whoever can read the report |
| **counters/reports-{year}** | | year | next reference sequence |
| **settings/app** | | fixed id | reportsPerHour (BR-21) |
| **systemLogs/{id}** | | auto id | level, source, message, actorId, createdAt |

**Integrity mechanisms.** Firestore enforces no schema, so integrity is enforced in five ways:
1. **Server-only writes.** Clients cannot write reports, tasks, history, alerts or configuration at all; they may only stamp their own last-login time and mark their own notifications read.
2. **Shared schema validation.** Every command validates its input with the same Zod schemas the forms use.
3. **Transactions.** TX-1 (submission: reference counter, duplicate search, report, history, projection, notifications), TX-2 (assignment: one-active-task check, eligible worker, task, report, history) and TX-3 (completion: task and report resolved together) each commit atomically. Firestore retries a transaction on contention, so of two concurrent assignments only one can succeed (test IT-ASG-07).
4. **Append-only history.** History entries are never updated or deleted.
5. **Stable references.** Departments and categories are deactivated rather than deleted (BR-19), so existing references stay valid.

**Data-organisation decisions:**
- History, comments, recipients and notifications are **subcollections**, so their access rules follow the parent document.
- **Duplicated fields** (names, category names) avoid extra reads in lists, accepting that a renamed user keeps their old name on past records.
- A **geohash field** supports the 100 m proximity query, and **composite indexes** are declared in `firestore.indexes.json`.

## Security, Privacy and Access Control

**Authentication.** Users sign in with email and password through Firebase Authentication. Passwords are never stored by CivicLink. On registration or role change, the server sets signed custom claims (`role`, `dept`, `suburb`, `active`), which the Security Rules use. Every command also reloads the caller's profile and refuses deactivated accounts. Deactivation additionally disables the Auth account and revokes its sessions. The client refreshes its token when an administrator changes the user's role.

Table: Role / permission matrix (✓ allowed; scope in brackets)

| Function | Resident | Official | Field Worker | Administrator |
|---|---|---|---|---|
| Register, sign in (password or Google), reset password, edit own profile | ✓ | ✓ (no registration) | ✓ (no registration) | ✓ (no registration) |
| Delete own account (POPIA) | ✓ | — | — | — |
| "Me too" on an open issue | ✓ | — | — | — |
| Turn push notifications on/off for own device | ✓ | ✓ | ✓ | ✓ |
| Submit report; view own reports; confirm/reopen | ✓ | — | — | — |
| View community map | ✓ | ✓ | — | ✓ |
| View report queue and full report details | — | ✓ (own dept) | ✓ (assigned) | ✓ |
| Triage, reject, assign, reassign, escalate | — | ✓ (own dept) | — | ✓ |
| Accept, start, complete task | — | — | ✓ (own tasks) | — |
| Internal comments | — | ✓ (own dept) | ✓ (assigned) | ✓ |
| Broadcast / end alert; alert history | — | ✓ | — | ✓ |
| View alerts feed | ✓ (own suburb) | ✓ | — | ✓ |
| Analytics | — | ✓ | — | ✓ |
| Manage users, departments, categories; system log | — | — | — | ✓ |

Table: Security controls

| Area | Risk | Implemented control |
|---|---|---|
| Authentication | Unauthorised access | Firebase Authentication with email/password (minimum 8 characters) or Google; signed ID tokens on every request; new Google users can only become Residents |
| Account enumeration | Attackers discover which emails are registered | Password reset and sign-in errors give the same message whether or not an account exists |
| Abuse | Flooding the queue with fake reports | Configurable per-resident hourly limit checked before the submission transaction (BR-21); "Me too" counted once per resident (BR-23) |
| Push tokens | Notifications sent to the wrong person or a stale device | Tokens stored server-side per user (no client access), sent only after the command commits, pruned when FCM reports them dead, deleted with the account |
| Authorisation | A user reaches another role's data or functions | Firestore Security Rules per the matrix (photos inherit their report's access); role and department checks in every command; client route guards for usability only |
| Account lifecycle | A deactivated user keeps access | Auth account disabled, refresh tokens revoked, profile check on every command |
| Input | Malicious or invalid data | Zod schemas on the server; geographic bounds; length limits; photo size limit and real-type check from magic bytes, so renamed or script-bearing files (e.g. SVG) are refused; request body limited to 4 MB |
| Integrity | Race conditions or partial updates | Firestore transactions TX-1 to TX-3; append-only history; no client writes |
| File uploads | Malicious or oversized files | Photos accepted only through commands, re-checked server-side (type sniffing, ≤ 700 KB); never served as HTML; displayed from bytes with an explicit image content type |
| Sensitive data (POPIA) | Exposure or indefinite retention of residents' identity, location or photos | Reports readable only by the reporter, followers and staff; public map uses an anonymised projection with location rounded to about 100 m; minimal data collected; processing region africa-south1; residents can erase their personal data (FR-32), leaving anonymised service records (BR-22) |
| Secrets | API key or credential exposure | Service-account key and cron secret only in Vercel's encrypted environment; none in the repository (`.env.example` lists names only); gitleaks scan in CI; the cron endpoint compares the secret in constant time |
| Error handling | Leaking internals | Unexpected errors return a generic message and are written to the system log |
| Logging and audit | Unaccountable actions | Immutable status history with actor; administrator actions and errors in the system log |

**Data classification.**

| Data | Class | Visible to |
|---|---|---|
| Names, emails, phone numbers | Personal | Owner, staff |
| Report photos and exact locations | Personal (may identify a home) | Reporter, staff |
| Report category, status and approximate location | Public | All signed-in users |
| Passwords | Secret | Firebase Auth only |

## Deployment and Runtime Design

CivicLink has two runtime configurations built from the same code (Figure 28):

- **Deployed (free tier):** the static web app and the Node command API run on **Vercel** (serverless functions in the Cape Town region). Authentication and Firestore run on Firebase's free **Spark** plan. The API uses a service-account key held in Vercel's encrypted environment. A GitHub Actions schedule calls the protected maintenance endpoint hourly, and Vercel Cron calls it daily. The deployed URL is given in Appendix 11.2.
- **Local:** the web app runs on Vite. Auth, Firestore and Cloud Functions run in the Firebase Emulator Suite on one machine, with the same command registry served by the Cloud Functions adapter. This configuration is used for development, all automated tests and an offline demonstration.

In both configurations the browser loads map tiles from OpenStreetMap over HTTPS.

![Figure: Deployment diagram](docs/diagrams/deployment.png)

# SYSTEM IMPLEMENTATION

## Codebase and Repository Structure

The repository is an npm-workspaces monorepo. Each top-level folder corresponds to one component of the architecture in Figure 9.

Table: Repository structure

| Path | Architecture component | Contents |
|---|---|---|
| `apps/web/` | Web application | `src/pages/{auth,resident,official,worker,admin,common}`, `src/components` (UI kit, maps, timeline, notification bell), `src/auth` (AuthProvider, RequireRole), `src/lib` (Firebase setup, typed API client, live hooks, uploads) |
| `functions/` | Command API and schedules | `src/index.ts` (callable and scheduled exports), `src/lib/command.ts` (auth/role/validation wrapper), `src/services/*` (business services), `test/` (integration tests) |
| `packages/shared/` | Shared domain package | `src/schemas.ts`, `stateMachines.ts`, `policies.ts`, `analytics.ts`, `models.ts`, `constants.ts`; `test/` (unit tests) |
| `firestore.rules`, `firestore.indexes.json` | Access control and indexes | Security Rules and composite indexes |
| `api/`, `vercel.json`, `functions/src/http.ts`, `functions/src/commands.ts` | Deployed API | Vercel entry points; Node HTTP adapter; the single command registry shared with Cloud Functions |
| `scripts/seed.ts` | Data initialisation | Deterministic demonstration data |
| `tests/rules`, `tests/e2e`, `tests/evidence`, `tests/support` | Verification | Rules tests, Playwright tests, screenshot capture, emulator harness |
| `docs/` | Documentation | Baseline SRS, change log, ADRs, diagrams (source and rendered), traceability matrix, test catalogue, defect log, evidence, report |

The principal dependency and build files are the root `package.json` (workspaces, scripts), the per-workspace `package.json` files, `package-lock.json`, `firebase.json` (emulators, hosting, functions), `tsconfig.base.json`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js` and `.github/workflows/ci.yml`. Cloud Functions are bundled with esbuild, so the shared package is included in the deployable artefact.

## Implementation of Core Capabilities

Table: Capability implementation

| Capability | Requirement(s) | Main implementation components |
|---|---|---|
| Register and sign in | FR-01, FR-02 | RegisterPage, LoginPage, AuthProvider, RequireRole; `registerResident` → UserService; `command()`/`loadActor`; users, Auth claims |
| Submit report with duplicate detection | FR-03–FR-05 | NewReportPage, LocationPicker, upload.ts; `submitReport` → ReportService.submit (TX-1), DuplicatePolicy, formatReference; reports, history, publicReports, counters, photos (photoService: decode, size, type sniffing) |
| Track reports | FR-06, FR-15 | MyReportsPage, ResidentReportPage, Timeline, NotificationBell, useLiveQuery/useLiveDoc listeners; reports, history, notifications |
| Triage and dispatch | FR-08–FR-10, FR-12, FR-13 | ReportQueuePage, OfficialReportPage; ReportService.triage/reject/assign (TX-2)/reassign/escalate; applyTransition; tasks, reports, history |
| Field completion | FR-11 | WorkerHome, TaskPage; `updateTask`, `completeTask` → TaskService (TX-3), TaskStateMachine; tasks, reports, photos |
| Confirm, reopen, SLA | FR-13, FR-14 | ResidentReportPage; ReportService.confirm/reopen; MaintenanceService with `escalateOverdue` and `autoCloseResolved` schedules and admin `runMaintenance` |
| Alerts | FR-16–FR-18 | NewAlertPage, AlertsAdminPage, AlertsFeedPage, useResidentAlerts; AlertService; alerts, recipients |
| Push notifications | FR-24 | ProfilePage (PushCard), `lib/push.ts`, `public/sw.js`; `register/unregisterPushToken`; pushService (intents recorded by NotificationService, delivered by `execute()` after commit) |
| Me too and offline | FR-33, FR-34 | CommunityMapPage (MeToo) → `affirmReport` → ReportService.affirm; `public/sw.js`, manifest, `components/pwa.tsx` |
| Accounts | FR-01, FR-02, FR-29–FR-32 | LoginPage, RegisterPage, WelcomePage, ProfilePage, AuthProvider (Google popup, password reset); `registerResident`, `completeProfile`, `updateProfile`, `deleteMyAccount` → UserService; users, Auth claims, photos |
| Insight and administration | FR-19–FR-23, FR-26 | AnalyticsPage → AnalyticsService → computeAnalytics; UsersPage → UserService; ConfigPage → ConfigService; LogsPage, logService; CommentService; toCsv |

**Validation.** Forms validate on the client with the same Zod schemas the server uses, and show field-level messages that clear as the user corrects them. The `command()` wrapper validates every request again and returns `invalid-argument` with a `fields` map, which the client displays against the matching inputs.

**Business-rule enforcement.** Status changes go through a single function, `applyTransition`. It calls `ReportStateMachine.next(from, event, actor)`, which throws for invalid transitions or actors. It then updates the report, appends a history entry, updates the public projection and creates notifications, all within the caller's transaction. Rules that need a database read are re-checked inside the transaction, so a concurrent change causes a retry rather than a violation. Examples are BR-06 (`activeTaskId`), BR-07 (worker eligibility) and BR-03 (duplicate candidates).

**Duplicate detection (BR-03).** Each report stores a geohash. Submission queries the geohash ranges covering a 100 m radius (geofire-common) inside the transaction. The candidates are filtered by `DuplicatePolicy` (same category, open status, at most 72 hours old, exact haversine distance at most 100 m), and the closest match is chosen.

**Error handling.** Expected failures are raised as typed `DomainError`s or state-machine errors and mapped to callable error codes (`invalid-argument`, `failed-precondition`, `permission-denied`, `not-found`, `already-exists`). Unexpected errors are logged and returned as a generic message. The client maps network and timeout errors to friendly messages, and every page has loading, empty, error and access-denied states.

## APIs, Integrations and External Dependencies

**Command API.** The command API is a set of HTTPS callable functions, invoked with the user's ID token. Reads are not exposed as functions; clients read Firestore directly under the Security Rules.

Table: Callable command API

| Command | Roles | Purpose | Notable errors |
|---|---|---|---|
| registerResident | public | Create resident account | already-exists, invalid-argument |
| completeProfile | signed in, no profile yet | Finish first Google sign-in as a Resident | already-exists |
| updateProfile | any role | Own name, phone; residents' suburb | invalid-argument, permission-denied |
| deleteMyAccount | Resident | POPIA erasure with anonymisation | invalid-argument (confirmation) |
| affirmReport | Resident | "Me too" on an open issue | failed-precondition (own/closed) |
| registerPushToken, unregisterPushToken | any role | Device push registration | invalid-argument |
| submitReport | Resident | TX-1 submission | invalid-argument, permission-denied |
| triageReport, rejectReport, escalateReport | Official, Admin | Lifecycle actions | failed-precondition, permission-denied |
| assignReport, reassignTask | Official, Admin | TX-2 dispatch | failed-precondition, invalid-argument |
| updateTask, completeTask | Field Worker | Task steps, TX-3 completion | failed-precondition, permission-denied |
| confirmResolution, reopenReport | Resident | Respond to resolution | failed-precondition |
| addComment | Staff | Internal note | permission-denied |
| broadcastAlert, deactivateAlert | Official, Admin | Alerts | invalid-argument |
| markAlertRead | Resident | Read receipt | not-found |
| createStaffUser, setUserRole, setUserActive | Admin | Accounts | permission-denied (self) |
| upsertDepartment, upsertCategory, updateSettings | Admin | Configuration, report limit | invalid-argument |
| getAnalytics | Official, Admin | Metrics | — |
| runMaintenance | Admin | Run SLA/auto-close on demand | — |

**External integrations.**
- **OpenStreetMap tiles** are fetched by the browser over HTTPS. If tiles are unavailable, the map shows a blank background but still works: the pin, map clicks and coordinates function, and the report form, lists and timelines do not depend on tiles.
- **Browser geolocation** is optional. If permission is denied, or the position is outside the municipality, the user is told to drag the pin instead.

**Two adapters, one API.** `functions/src/commands.ts` defines all 26 commands once. `index.ts` exposes them as Cloud Functions (local emulator), and `http.ts` exposes them as a plain Node handler (Vercel). The Node adapter verifies the Firebase ID token (rejecting revoked sessions), limits the request size, and returns errors in the callable protocol. The client therefore uses `httpsCallableFromURL` with no other changes. In the local configuration, Firebase services come from the official Emulator Suite. No integration is mocked in the application code.

## AI / Machine-Learning Component

Not applicable. CivicLink contains no AI or machine-learning component. Duplicate detection, SLA escalation and analytics are deterministic, rule-based functions that are fully specified in Section 4.3 and unit-tested.

# VERIFICATION AND TESTING

## Test Approach

Verification combines four automated levels and a set of non-functional checks. All of them run on every push in GitHub Actions (`.github/workflows/ci.yml`). Each test's identifier appears in its name, so every row in this section can be found in the code (for example, `grep -r "IT-ASG-07"`).

Table: Test levels

| Level | Tool | Scope | Count |
|---|---|---|---|
| Unit | Vitest | Shared domain: schemas, state machines, duplicate/SLA/resolution policies, location helpers, image sniffing, references, analytics, CSV (≈ 98% line coverage) | 30 |
| Security rules | @firebase/rules-unit-testing on the emulator | Allow and deny case for every permission-matrix cell, including photos | 19 |
| API integration | Vitest + Firebase client SDK against the emulators | Every command: success, validation, boundary, authorisation, state conflict and concurrency; the Node HTTP adapter; web push with a fake sender | 79 |
| Installable PWA | Playwright against the production build (`vite preview`) | Manifest, icons, service worker control, offline reload (NFT-10) | 1 |
| End-to-end | Playwright (Chromium and Firefox; 360 px mobile) | Full lifecycle across three browser sessions, duplicates, alerts, access control, validation, out-of-area GPS, Google sign-in, password reset, profile and account deletion | 11 + 3 non-functional (run through both API adapters) |
| Non-functional | Playwright timing, axe-core, gitleaks, ESLint, TypeScript | NFR-04 to NFR-09, NFR-12 | — |

Everything except visual review was tested automatically. **Manual testing** consisted of exploratory sessions in each role and a review of every screenshot in Section 5.5, including mobile layouts. Seeded data (`scripts/seed.ts`) gives every test run the same starting state.

## Functional and Business-Rule Verification

The table below lists the principal test cases. The complete list of 143 automated tests, with their results, is produced by CI for the submitted commit (Appendix 11.3). All tests listed passed. "As expected" means the actual result matched the expected result exactly.

Table: Functional and business-rule test results

| Test ID | Requirement / rule | Test scenario | Type | Expected result | Actual result | Status |
|---|---|---|---|---|---|---|
| E2E-01 | SC-01, FR-03–FR-14 | Resident submits → official triages and assigns → worker accepts, starts, completes with proof → resident sees Resolved and confirms | End-to-end | Report Closed; full timeline; updates live | As expected | Pass |
| IT-RPT-01 | FR-03, FR-04 | Valid submission with photo | Integration | Submitted, CL- reference | As expected | Pass |
| IT-RPT-02 | BR-02 | Short description and unknown suburb | Validation | invalid-argument with both field errors; nothing written | As expected | Pass |
| IT-RPT-03 | BR-02 | Location in Johannesburg | Boundary | Refused | As expected | Pass |
| IT-RPT-04 | BR-02 | Photo path of another user / missing file | Authorisation | Refused | As expected | Pass |
| IT-RPT-06 | BR-01 | Official, worker and anonymous submit | Authorisation | permission-denied / unauthenticated | As expected | Pass |
| IT-RPT-08 | BR-04, NFR-10 | 12 concurrent submissions | Concurrency | 12 unique, consecutive references | As expected | Pass |
| UT-DUP-01..04 | BR-03 | 99/100/101 m; 71/72/73 h; other category; closed original | Boundary | Duplicate only within 100 m, 72 h, same category, open | As expected | Pass |
| IT-RPT-09, E2E-02 | FR-05 | Second resident reports the same issue 33–60 m away | Integration / E2E | Linked as duplicate; original count 2; follower added | As expected | Pass |
| UT-RSM-01..03 | BR-05 | Every allowed and every disallowed (status, event, actor) | Unit | Only the transitions of Figure 7 succeed | As expected | Pass |
| IT-TRI-02 | BR-05 | Triage an already-reviewed report | State conflict | failed-precondition | As expected | Pass |
| IT-TRI-03 | BR-12 | Reject with a 2-character reason | Validation | Refused; valid reason → Rejected | As expected | Pass |
| IT-TRI-04 | BR-20 | Roads official triages a water report | Authorisation | permission-denied | As expected | Pass |
| IT-ASG-02, -03 | BR-07 | Assign to a roads worker / deactivated worker | Validation | Refused | As expected | Pass |
| IT-ASG-04 | BR-06 | Assign a report with an active task | State conflict | failed-precondition | As expected | Pass |
| IT-ASG-07 | NFR-10 | Two officials assign the same report simultaneously | Concurrency | Exactly one succeeds; one task exists | As expected | Pass |
| IT-ASG-08 | FR-12 | Reassign | Integration | Old task Reassigned, new task Assigned | As expected | Pass |
| IT-TSK-02 | BR-08 | Another worker accepts the task | Authorisation | permission-denied | As expected | Pass |
| IT-TSK-03 | BR-08 | Start before accept; complete before start | State conflict | failed-precondition | As expected | Pass |
| IT-TSK-04 | BR-09 | Complete with 2-character notes and no photo | Validation | invalid-argument | As expected | Pass |
| IT-TSK-06 | BR-09, NFR-10 | Complete a task reassigned while on site | Failure | Refused; report unchanged | As expected | Pass |
| IT-ESC-01 | BR-10 | Run schedule with clock 49 h after creation (SLA 48 h); run again | Boundary | Escalated once; second run no change | As expected | Pass |
| IT-RES-02 | FR-14 | Reporter reopens with a reason | Integration | Under Review; officials notified | As expected | Pass |
| IT-RES-03 | BR-11 | Respond 8 days after resolution; run schedule | Boundary | Refused; report auto-closed | As expected | Pass |
| IT-RES-04 | BR-11 | Another resident confirms | Authorisation | permission-denied | As expected | Pass |
| IT-ALR-01 | FR-16, BR-14 | Broadcast to Galeshewe | Integration | Delivery record only for the active Galeshewe resident | As expected | Pass |
| IT-ALR-03 | BR-13 | Title 101 chars; no suburbs; past expiry; expiry 31 days | Boundary | All refused | As expected | Pass |
| E2E-03 | FR-17, BR-14 | Galeshewe and Roodepan residents open alerts | End-to-end | Visible to Galeshewe only | As expected | Pass |
| IT-AUTH-02 | FR-01 | Duplicate email; 5-character password | Validation | already-exists / invalid-argument | As expected | Pass |
| IT-AUTH-03 | BR-16 | Admin deactivates a signed-in resident who then submits / signs in | Authorisation | Command refused; sign-in refused | As expected | Pass |
| IT-ADM-04 | BR-15 | Admin demotes or deactivates own account | Authorisation | permission-denied | As expected | Pass |
| IT-CFG-01 | FR-21 | SLA hours 0 / 721 / 96 | Boundary | 0 and 721 refused; 96 saved | As expected | Pass |
| IT-CFG-03 | BR-19 | Deactivate category, then submit with it | Integration | Refused | As expected | Pass |
| IT-ANL-01, UT-ANL-01 | FR-19, SC-05 | Metrics on fixture and after a new report | Integration | Counts, averages and SLA % exact; no NaN on empty data | As expected | Pass |
| E2E-04 | NFR-01 | Each role opens other roles' pages | End-to-end | Access-denied page; anonymous → login | As expected | Pass |
| E2E-05 | BR-02 | Submit report with short text, no location and no severity | Validation | Three field messages; cannot proceed | As expected | Pass |
| E2E-07 | FR-03, BR-02 | Device GPS reports Johannesburg | Boundary | Distance explained; no location set; tapping the map sets the pin and suburb | As expected | Pass |
| IT-RPT-11 | BR-21 | Limit set to 2; resident submits 3 reports | Boundary | Third refused (resource-exhausted) | As expected | Pass |
| IT-AUTH-04, E2E-08 | FR-29, BR-16 | First Google sign-in; client sends role ADMIN | Authorisation | Profile step required; account is a Resident; second completion refused | As expected | Pass |
| E2E-09 | FR-30 | Reset for a registered and an unregistered email | Security | Identical confirmation for both | As expected | Pass |
| IT-DEL-01, E2E-10 | FR-32, BR-22 | Resident deletes account (wrong confirmation, then DELETE) | Integration | Refused, then reports anonymised; photos, profile, receipts and Auth account removed; sign-in fails | As expected | Pass |
| IT-AFF-01, E2E-11 | FR-33, BR-23 | Second resident taps "Me too" on the map, then again | Integration / E2E | Count 2, follower added, one timeline note; repeat says already confirmed | As expected | Pass |
| IT-AFF-02 | BR-23 | "Me too" on own report, by an official, and on a rejected report | Authorisation / state | Refused | As expected | Pass |
| IT-PSH-02 | FR-24 | Official triages a report; then repeats the triage (refused) | Integration | Exactly one push to the reporter's device; none for the refused command | As expected | Pass |
| IT-PSH-03 | FR-24 | Suburb alert with one live and one dead device token | Failure | Both targeted; dead token pruned | As expected | Pass |
| IT-DEL-02 | BR-22 | Staff self-delete; triage an anonymised report | Authorisation | Refused; anonymised report progresses without notifications | As expected | Pass |

## Non-Functional and Security Verification

Table: Non-functional verification results

| NFR | Test | Result | Status |
|---|---|---|---|
| NFR-01 Authorisation | RT-* (20 tests: every matrix cell, e.g. a resident cannot read another's report or list all reports, a roads official cannot read water reports, no client can write reports/tasks/history) and API authorisation tests | All denied cases denied; all allowed cases allowed | Pass |
| NFR-02 Authentication | RT-USR-02 (users cannot change their own role, department or active flag); review: no password fields in Firestore | Pass | Pass |
| NFR-03 Validation | IT-RPT-02, IT-TRI-03, IT-ALR-03, IT-CFG-01, E2E-05 | Field-level errors, no data written | Pass |
| NFR-04 Secrets | gitleaks over the full git history in CI | 0 findings | Pass |
| NFR-05 Propagation | NFT-05 inside E2E-01 | Submit → official queue 0.09 s; completion → resident screen 2.47 s (target 5 s) | Pass |
| NFR-06 Responsiveness | NFT-06 | Dashboard 1.10 s, queue 0.92 s, alerts 0.92 s (target 3 s); p95 of 50 commands 28 ms (target 2 s) | Pass |
| NFR-07 Mobile | NFT-07 at 360×640 on resident and worker screens; report form has 3 steps | No horizontal overflow | Pass |
| NFR-08 Accessibility | NFT-08 axe-core WCAG 2.1 A/AA on login, report form, my reports, queue | 0 violations (after DEF-03) | Pass |
| NFR-09 Compatibility | E2E suite on Chromium and Firefox in CI | All pass | Pass |
| NFR-10 Integrity | IT-RPT-08, IT-ASG-07, IT-TSK-06 | Atomic, exactly-once outcomes | Pass |
| NFR-11 Privacy | RT-RPT-03, RT-PUB-01, RT-PHO-01, RT-PHO-02, UT-PRV-01, IT-RPT-07 | No PII in public data; photos restricted | Pass |
| FR-34 Installable / offline | NFT-10 on the production build: manifest and icons, service worker in control, reload with the network off | App shell and offline notice shown | Pass |
| NFR-12 Maintainability | CI: ESLint, TypeScript strict, coverage threshold | 0 lint errors; 97.9% line coverage of the domain package | Pass |

Timings were measured on the development laptop running the emulators, Vite and the browsers at the same time (local configuration).

**Production verification.** The same Playwright tests were run against the deployed system (https://civiclink-five.vercel.app) on 20 October 2026:

| Test | Result on the live system |
|---|---|
| E2E-01 full lifecycle (three browser sessions) | Pass. New report on the official's queue after 0.11 s; resolution on the resident's screen after 0.85 s (NFR-05 target 5 s) |
| E2E-02 duplicate detection, E2E-07 out-of-area GPS | Pass |
| E2E-04 access denied per role, E2E-06 wrong password | Pass |
| NFT-06 page loads | Dashboard 1.02 s, queue 1.06 s, alerts 0.50 s (target 3 s) |
| NFT-08 accessibility (axe-core) | 0 violations |
| Hourly maintenance schedule (GitHub Actions → `/api/cron/maintenance`) | Run succeeded with the secret; refused without it |

## Defects and Known Issues

Table: Significant defects found and resolved

| ID | Found by | Description | Resolution |
|---|---|---|---|
| DEF-01 | IT-CFG-02 | Creating a department whose name produced an existing identifier silently overwrote that department | Creation now refuses existing identifiers; updates require an existing record |
| DEF-02 | E2E-01 | Submissions with an empty optional field were rejected, because the callable protocol sends `undefined` as `null` | The command wrapper treats top-level nulls as absent; regression test IT-RPT-10 |
| DEF-03 | NFT-08 | Three text styles were below the WCAG AA contrast ratio | Darker text colours |
| DEF-05 | E2E-10 | The profile form opened with an empty name, because it read the profile before it had loaded | The form is rendered only after the profile loads |
| DEF-06 | IT-RPT-08 in CI | Under concurrency, extra reads inside the submission transaction (rate-limit count, profile, settings, officials) caused lock timeouts | Those reads moved before the transaction; it now contends only on the reference counter |
| DEF-07 | E2E-01 run against production | Submission failed in production because the rate-limit query needed a composite index, which the emulator never requires | Index added and deployed; the E2E suite can now run against the deployed URL |
| DEF-08 | First Vercel deployment | API calls crashed because a firebase-admin dependency pulls in an ESM-only package that Vercel's loader cannot `require()` | Dependency pinned to a compatible version (npm override) |
| DEF-04 | CI on a clean checkout | An over-broad `lib/` ignore rule had kept two source folders out of the repository | Ignore rule narrowed to the build output; CI now builds from a clean clone on every push |

There are no unresolved defects. The limitations of included functionality are listed in Section 3.4.

# SYSTEM SETUP AND OPERATION

**Prerequisites.** Node.js 22, Java 21 or later (required by the Firebase emulators) and Git. No Firebase account, API keys or `.env` file are needed: by default the application connects to the local emulators with a demonstration project ID (`demo-civiclink`).

**Install and run.**

```
git clone {{REPO}}.git
cd civiclink
git checkout {{TAG}}
npx -y npm@11.6.2 ci
npm run dev
```

`npm run dev` builds the Cloud Functions, starts the Auth, Firestore and Functions emulators, initialises the database with the deterministic seed (departments, categories, 15 accounts, 150 reports with valid histories, and alerts), and starts the web application. Open **http://127.0.0.1:5173**. The emulator data browser is at http://127.0.0.1:4000. Restarting the command resets the database to the same seed. npm 11 is used because npm 10 has a known workspace-resolution defect.

**Demo accounts.** Locally, all accounts use the password `CivicLink#2026`, and the login page offers one-click shortcuts for the main four. The deployed system at **{{APP_URL}}** has the same accounts with a private password, supplied to the lecturer separately.

Table: Demo accounts

| Role | Email | Notes |
|---|---|---|
| Resident | thandi@civiclink.demo | Galeshewe; reports in every state |
| Resident | pieter@civiclink.demo | Roodepan |
| Official | naledi@civiclink.demo | Water & Sanitation (also thabo@ Electricity, johan@ Roads) |
| Field worker | sipho@civiclink.demo | Water & Sanitation (also bongani@ Electricity, mpho@ Roads) |
| Administrator | admin@civiclink.demo | All official and administrative functions |

**Tests.** `npm run test:unit`, `npm run test:emulator` (rules and API integration), and `npm run test:e2e` (run `npx playwright install chromium` once beforehand).

**Deployed configuration (free tier).** The full runbook is in `docs/deploy.md`. In summary:
1. In the Firebase console, enable Email/Password and Google sign-in and create the Firestore database (location africa-south1).
2. Deploy the rules and indexes with `npx firebase deploy --only firestore --project prod`.
3. Import the GitHub repository into Vercel, which reads the build settings from `vercel.json`.
4. Set the environment variables listed in `.env.example`: Firebase web config, `VITE_API_BASE=/api`, `VITE_USE_EMULATORS=false`, `FIREBASE_SERVICE_ACCOUNT` and `CRON_SECRET`.
5. Set the same `CRON_SECRET` and the `APP_URL` in the GitHub repository for the hourly schedule.
6. Seed the deployed project with `npm run seed:prod`.

**Alternative cloud deployment (Blaze plan).**
1. Copy `.env.example` to `apps/web/.env.local` and enter the web configuration of a Firebase project on the Blaze plan.
2. Set `VITE_USE_EMULATORS=false` and leave `VITE_API_BASE` empty.
3. Run `npm run build` followed by `npx firebase deploy --project prod`.

The same code also runs entirely on Firebase.

# SOLUTION EVALUATION

Table: Evaluation against the success criteria

| Success criterion | Outcome | Evidence |
|---|---|---|
| SC-01: The complete incident lifecycle runs end to end | Achieved | E2E-01 passes in Chromium and Firefox across three independent browser sessions (resident, official, field worker); Figures 12–18 |
| SC-02: Key business rules are enforced server-side | Achieved | BR-03 to BR-11 each have unit and integration tests that bypass the user interface and call the API directly (UT-DUP, UT-RSM, IT-ASG-04/07, IT-TSK-03/06, IT-ESC-01, IT-RES-03); all pass |
| SC-03: Role-based access control holds | Achieved | 20 Security Rule tests covering every cell of the permission matrix, plus authorisation cases for every command and E2E-04; all pass |
| SC-04: Residents receive timely, targeted information | Achieved | NFT-05: report visible to the official in 0.09 s and the resolution visible to the resident in 2.47 s (target 5 s); E2E-03 shows suburb targeting |
| SC-05: Officials have operational visibility from live data | Achieved | UT-ANL-01 and IT-ANL-01 reproduce the expected metrics; Figure 21 |

The final system meets its purpose for the scope that was set. A smaller set of capabilities was delivered completely, rather than the large and partly simulated scope of the Phase 3 prototype. Every included requirement is implemented on a real backend and verified automatically.

The main remaining gap for a production rollout is reaching residents without smartphones or data. SMS (FR-25) is the most valuable next step, followed by offline drafting (FR-27) for areas with poor coverage, and a pilot with one department to validate the SLA targets.

# REFERENCES

Auditor-General South Africa. (2024). *Consolidated general report on local government audit outcomes: MFMA 2022-23*. https://www.agsa.co.za/Reporting/MFMAReports/MFMA2022-2023.aspx

Diamond Fields Advertiser. (2026, February 16). *Kimberley residents frustrated as Sol Plaatje Municipality struggles with burst pipes and service delivery* [Opinion]. https://dfa.co.za/diamond-fields-advertiser/opinion/2026-02-16-kimberley-residents-frustrated-as-sol-plaatje-municipality-struggles-with-burst-pipes-and-service-delivery/

Firebase. (2026). *Cloud Firestore documentation*. Google. https://firebase.google.com/docs/firestore

Firebase. (2026). *Firebase Cloud Messaging: Web push*. Google. https://firebase.google.com/docs/cloud-messaging/js/client

Firebase. (2026). *Firebase Local Emulator Suite*. Google. https://firebase.google.com/docs/emulator-suite

Firebase. (2026). *Firebase Security Rules documentation*. Google. https://firebase.google.com/docs/rules

Leaflet. (2023). *Leaflet: An open-source JavaScript library for interactive maps* (Version 1.9.4) [Computer software]. https://leafletjs.com

Meta Platforms. (2026). *React* (Version 19) [Computer software]. https://react.dev

Microsoft. (2026). *Playwright* (Version 1.63) [Computer software]. https://playwright.dev

Noordkaap Bulletin. (2024, January 30). *Sol Plaatje 'has a plan' to solve water crisis*. News24. https://www.news24.com/news24/community-newspaper/noordkaapbulletin/sol-plaatje-has-a-plan-20240130

OpenStreetMap contributors. (2026). *OpenStreetMap* [Data set]. OpenStreetMap Foundation. https://www.openstreetmap.org

Protection of Personal Information Act 4 of 2013. (2013). *Government Gazette, 581*(37067). Republic of South Africa.

Sol Plaatje Local Municipality. (2022). *Integrated development plan 2022–2027*. https://lg.treasury.gov.za/supportingdocs/NC091/NC091_IDP%20Final_2023_Y_20220908T164950Z_kdeklerk.pdf

Statistics South Africa. (2023). *Census 2022: Municipal fact sheet*. https://census.statssa.gov.za/assets/documents/2022/Census_2022_Municipal_factsheet-Web.pdf

Vercel. (2026). *Vercel Functions documentation*. https://vercel.com/docs/functions

W3C. (2018). *Web Content Accessibility Guidelines (WCAG) 2.1*. World Wide Web Consortium. https://www.w3.org/TR/WCAG21/

W3C. (2023). *Web Application Manifest*. World Wide Web Consortium. https://www.w3.org/TR/appmanifest/

Zod. (2026). *Zod: TypeScript-first schema validation* (Version 4) [Computer software]. https://zod.dev

# APPENDICES

## GitHub Repository

Repository: **{{REPO}}** (private; access granted to the lecturer).

Submitted version: tag **{{TAG}}**, commit **{{COMMIT}}**.

## Deployed System

URL: **{{APP_URL}}** (Vercel + Firebase Spark, decision D3). Demo accounts are listed in Section 8. The local emulator configuration in Section 8 reproduces the same system offline.

## Additional Supporting Material

- **Complete automated test results:** the GitHub Actions run for commit {{COMMIT}} (tab "Actions"). It includes the Playwright HTML report and the coverage report as downloadable artefacts.
- **Traceability matrix** (requirement → rule → screen → code → data → test): `docs/trackers/traceability-matrix.md`.
- **Full test catalogue:** `docs/trackers/test-catalog.md`; **defect log:** `docs/trackers/defect-log.md`.
- **Baseline change log** reconciling Phases 1–3 (CR-01 to CR-32): `docs/baseline/change-log.md`.
- **Architecture decision records:** `docs/adr/README.md`.
- **Diagram sources** (PlantUML): `docs/diagrams/src/`; **all 31 UI screenshots:** `docs/evidence/`.
