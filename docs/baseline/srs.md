# CivicLink: Consolidated Requirements Baseline (v1.0)

Status: **Approved baseline for Stage 4. Release statuses final (19 Oct 2026).** This document controls the project. Phases 1–3 are kept as the academic record, and differences from them are recorded in `change-log.md`.
Release status is finalised at the code freeze (30 Oct 2026). Anything still *Planned* then becomes *Included* if it is verified, and goes to §3.4 Known Limitations if it is not.

## 1. Context, problem, purpose

**Domain:** municipal service-delivery incident reporting and public communication.
**Client / users:** Sol Plaatje Local Municipality (Kimberley, Northern Cape). The users are residents, municipal officials (call centre / department supervisors), field workers, and system administrators.
**Basis:** a real organisation and real events (the 31 March 2026 workers' strike, recurring water outages), studied through a *simulated* stakeholder interview and published sources. This is not a commissioned system.

**Problem statement.** Residents report burst pipes, outages, potholes and illegal dumping by phone, walk-in or WhatsApp. Reports are logged manually and have no precise location. The same incident is reported many times. Field workers are dispatched by phone with no audit trail. Residents get no status feedback, and urgent notices (strikes, outages) go out only by radio or social media. The results are 24–72 h response times, wasted call-centre capacity, repeat site visits and loss of public trust.

**Purpose.** Provide one system in which residents report located, evidenced incidents and track them, officials triage, assign and broadcast targeted alerts, and field workers receive and close tasks with proof. Every status change is recorded and visible to the right people.

### Success criteria

| ID | Criterion | Verified by |
|---|---|---|
| SC-01 | The complete incident lifecycle runs end-to-end on the submitted system: resident submits → official triages and assigns → field worker completes with proof → resident sees *Resolved* with a full status history. | E2E-01, demo |
| SC-02 | Key business rules are enforced server-side, not just in the UI: duplicate detection, allowed status transitions, one active task per report, valid assignment, SLA escalation. | Unit and integration tests for BR-03–BR-11, all passing |
| SC-03 | Role-based access control holds: each role can perform exactly the functions in the permission matrix, and nothing else. | Rules tests and function auth tests covering every matrix cell |
| SC-04 | Residents get timely, targeted information: a status change or suburb alert appears in the resident's app within 5 seconds without a refresh. | NFR-05 timing test |
| SC-05 | Officials have operational visibility from live data: dashboard metrics match the known seeded dataset. | IT-ANL-01 |

## 2. Actors and glossary

| Actor / term | Definition |
|---|---|
| Resident | Self-registered member of the public. Role `RESIDENT`. |
| Official | Municipal staff member who triages, assigns and broadcasts. Belongs to a department. Role `OFFICIAL`. |
| Field Worker | Municipal staff member who carries out tasks. Belongs to a department. Role `FIELD_WORKER`. |
| Administrator | Manages accounts and configuration. Role `ADMIN`. |
| Report | An incident submitted by a resident. Identified by a reference `CL-YYYY-NNNN`. |
| Task | One assignment of a report to one field worker. |
| Alert | A broadcast notice from an official to residents in target suburbs. |
| Open report | A report in status SUBMITTED, UNDER_REVIEW, IN_PROGRESS or ESCALATED. |
| Active task | A task in status ASSIGNED, ACCEPTED or IN_PROGRESS. |

**Report statuses:** SUBMITTED, UNDER_REVIEW, IN_PROGRESS, ESCALATED, RESOLVED, CLOSED, REJECTED, DUPLICATE.
**Task statuses:** ASSIGNED, ACCEPTED, IN_PROGRESS, COMPLETED, REASSIGNED, CANCELLED.
**Categories (default):** Burst Pipe, Water Leak, Electricity, Road Damage, Illegal Dumping, Public Safety, Vandalism, Other.
**Departments (default):** Water & Sanitation, Electricity, Roads & Infrastructure, Waste Management, Public Safety.
**Severity:** HIGH, MEDIUM, LOW.

## 3. Scope

### 3.1 Solution boundary
Inside the system: the web client (resident, official, field worker and admin views), the Cloud Functions API (commands, triggers, schedules), Firestore, Cloud Storage and Firebase Authentication. External: the four human actors and OpenStreetMap tile servers. The assessed runtime is the **Firebase Emulator Suite on a local machine** (ADR-0003), with optional deployment to a Firebase project.

### 3.2 Final release scope (target)
Core: registration and role login, located incident reporting with photos, reference numbers, duplicate detection, status tracking with history, official queue/triage/reject/assign, field worker accept/start/complete with proof, real-time in-app notifications, suburb-targeted alerts with read receipts, admin user management.
Supporting: reassignment, escalation (manual + SLA-automatic), resident reopen/confirm with auto-close, community map, analytics dashboard, department/category configuration, alert history.

### 3.3 Excluded and deferred capabilities

| Capability | Status | Reason |
|---|---|---|
| SMS fallback (Twilio) (FR-25) | Deferred | Paid external service. Cannot be verified in the assessment environment |
| Offline report drafting with sync (FR-27) | Deferred | Conflict handling for drafts and uploads is beyond the 2-week build |
| Scheduled (future-dated) alerts (FR-28) | Deferred | Low value for the MVP. Immediate alerts cover the strike scenario |
| Bulk assignment of reports | Deferred | Efficiency feature. Single assignment covers the workflow |
| Native mobile apps (iOS/Android) | Excluded | A responsive web app meets the device need (Phase 1) |
| Google Maps / Geocoding | Excluded, replaced | Replaced by Leaflet + OpenStreetMap (ADR-0004) |
| Turn-by-turn routing, road-closure rerouting | Excluded | Handled by linking to the device's map app |
| 99.5% uptime, 10,000 concurrent users, multi-region failover | Excluded (production targets) | Cannot be verified in a student environment. Firebase's managed scaling is noted as the production path |
| AI/ML prediction | Excluded | Not part of the product. "Community intelligence" means analytics and duplicate detection |

### 3.4 Known limitations

| Area | Limitation | Impact | Status / workaround |
|---|---|---|---|
| Notifications (FR-15) | In-app only; residents must open the app to see updates (no push or SMS) | A resident who does not open CivicLink is not alerted | FR-24 (FCM push) and FR-25 (SMS) deferred |
| Scheduled rules (FR-13, FR-14) | The emulator does not fire schedules on its own | In the local demo, escalation and auto-close run when an admin presses "Run SLA & auto-close now" | Deployed Cloud Scheduler runs them hourly/daily |
| Alert broadcast (FR-16) | Recipient records are written in batches after the alert document, so they are not one atomic unit | A crash mid-broadcast could leave `recipientCount` higher than the stored delivery records | Acceptable at municipal scale; recipients can be re-derived from the suburb query |
| Location (FR-03) | No reverse geocoding; address = suburb + optional landmark | Officials rely on the map pin and landmark text | Deliberate (ADR-0004) |
| Photos | Images are uploaded at full size (≤ 5 MB) without client compression | Slower uploads on low-end connections | Possible future improvement |


## 4. Functional requirements

Priority uses MoSCoW. Release status is *Planned* until the freeze, then becomes *Included*, *Deferred* or *Excluded*.

| ID | Requirement | Actor | Priority | Release | BRs |
|---|---|---|---|---|---|
| FR-01 | The system shall allow a member of the public to register as a Resident with name, email, password, suburb and optional phone number. | Resident | Must | Included | BR-16 |
| FR-02 | The system shall authenticate users by email and password and route each user to the interface for their role. Deactivated accounts are refused. | All | Must | Included | BR-15, BR-16 |
| FR-03 | The system shall allow an authenticated Resident to submit an incident report with category, description, map location, suburb, optional landmark, severity and 0–3 photos. | Resident | Must | Included | BR-01, BR-02 |
| FR-04 | The system shall give each accepted report a unique reference (CL-YYYY-NNNN), status SUBMITTED, a default department derived from its category, and a first status-history entry. | System | Must | Included | BR-04, BR-05 |
| FR-05 | The system shall detect when a new report duplicates an open report, link it to the original, and tell the resident the original's reference. | System | Must | Included | BR-03 |
| FR-06 | The system shall allow a Resident to list their reports (All / Active / Resolved) and view a report's details and full status timeline. | Resident | Must | Included | BR-17 |
| FR-07 | The system shall show a community map of open reports with category filtering, without revealing reporter identity or photos. | Resident, Official | Should | Included | BR-17 |
| FR-08 | The system shall allow an Official to view the report queue with filters (status, category, department, severity, unassigned) and search by reference. | Official | Must | Included | — |
| FR-09 | The system shall allow an Official to triage a SUBMITTED report (→ UNDER_REVIEW, confirm or change department) or reject it with a reason (→ REJECTED). | Official | Must | Included | BR-05, BR-12, BR-19 |
| FR-10 | The system shall allow an Official to assign an UNDER_REVIEW or ESCALATED report to an active field worker in its department, with notes. This creates a Task and moves the report to IN_PROGRESS. | Official | Must | Included | BR-06, BR-07, TX-2 |
| FR-11 | The system shall allow a Field Worker to view their tasks, open task details (description, photos, location with an "open in maps" link, history), and accept, start and complete a task. Completion requires notes and at least one proof photo and resolves the report. | Field Worker | Must | Included | BR-08, BR-09, TX-3 |
| FR-12 | The system shall allow an Official to reassign an active task to another eligible field worker. The old task becomes REASSIGNED. | Official | Should | Included | BR-06, BR-07 |
| FR-13 | The system shall escalate open reports that exceed their department's SLA hours (automatically, by schedule) and allow an Official to escalate manually with a reason. | System, Official | Should | Included | BR-10 |
| FR-14 | The system shall allow the reporting Resident to confirm (→ CLOSED) or reopen (→ UNDER_REVIEW, with a reason) a RESOLVED report within 7 days, and shall auto-close RESOLVED reports after 7 days. | Resident, System | Should | Included | BR-11 |
| FR-15 | The system shall notify users in-app in real time: the resident on every status change of their report (and of the parent of a duplicate), the department's officials on a new report, and the field worker on assignment. | System | Must | Included | — |
| FR-16 | The system shall allow an Official to broadcast an alert with type, title, message, target suburbs (or all) and expiry, and shall record a delivery record for each targeted resident. | Official | Must | Included | BR-13 |
| FR-17 | The system shall show Residents the active, unexpired alerts for their suburb (newest first, emergencies pinned), with unread counts and mark-as-read. | Resident | Must | Included | BR-14 |
| FR-18 | The system shall allow an Official to view sent alerts with recipient count, read count and status, and to deactivate an alert early. | Official | Should | Included | — |
| FR-19 | The system shall show Officials an analytics dashboard from live data: open reports by status and category, average resolution time, SLA compliance per department, and the 30-day submission trend. | Official | Should | Included | — |
| FR-20 | The system shall allow an Administrator to create staff accounts (Official, Field Worker, Admin) with a department, change roles, and deactivate or reactivate any account. | Admin | Must | Included | BR-15, BR-16 |
| FR-21 | The system shall allow an Administrator to manage departments (name, SLA hours, active) and categories (name, default department, active). | Admin | Should | Included | BR-19 |
| FR-22 | The system shall allow Officials and Field Workers to add internal comments to a report that residents cannot see. | Official, Field Worker | Could | Included | BR-18 |
| FR-23 | The system shall record significant system events (function errors, admin actions) and show them to Administrators. | Admin | Could | Included | — |
| FR-24 | The system shall send web push notifications (FCM) for status changes and alerts. | System | Could | Deferred | — |
| FR-25 | The system shall send SMS alerts to residents without data access. | System | Won't (this release) | Deferred | — |
| FR-26 | The system shall allow an Official to export the filtered report queue as CSV. | Official | Could | Included | — |
| FR-27 | The system shall let residents draft reports offline and submit when connectivity returns. | Resident | Won't (this release) | Deferred | — |
| FR-28 | The system shall allow alerts to be scheduled for a future time. | Official | Won't (this release) | Deferred | — |

## 5. Non-functional requirements

All are verified in the assessment environment: local Firebase Emulator Suite, seeded dataset (~150 reports, 12 users), Chrome and Firefox latest.

| ID | Attribute | Requirement | Verification |
|---|---|---|---|
| NFR-01 | Security: authorisation | Every role-restricted read or write is enforced server-side (Firestore/Storage Security Rules and role checks in Cloud Functions), independently of the UI. | Rules unit tests and function auth tests (permission matrix) |
| NFR-02 | Security: authentication | Passwords are handled only by Firebase Authentication (minimum 8 characters). No password or credential is stored in Firestore or the repository. Roles are carried as signed custom claims. | Code review, rules tests, secret scan |
| NFR-03 | Security: input validation | All commands validate input server-side against shared schemas. Invalid input is rejected with a field-level message and no data change. | Function integration tests (invalid cases) |
| NFR-04 | Security: secrets | No secrets in source control. Configuration comes from environment variables with a committed `.env.example`. | Secret scan in CI (gitleaks) |
| NFR-05 | Performance: propagation | Under the demo workload, a new report appears on the official queue, and a status change appears on the resident's view, within 5 seconds without a manual refresh. | Playwright timing test |
| NFR-06 | Performance: responsiveness | Key screens become interactive within 3 seconds on the demo machine. Commands complete within 2 seconds (p95 of 50 runs on the emulator). | NFT-06 (Playwright timing) |
| NFR-07 | Usability: mobile | Resident and field worker flows work at a 360×640 viewport with no horizontal scrolling. Submitting a report takes at most 3 steps. | Playwright mobile project, manual check |
| NFR-08 | Accessibility | The login, report form, my-reports and queue pages have no serious or critical WCAG 2.1 A/AA violations in an automated axe-core audit. | NFT-08 (axe-core in Playwright) |
| NFR-09 | Compatibility | Core flows pass on the latest Chrome and Firefox. | Playwright chromium and firefox projects |
| NFR-10 | Integrity and reliability | Multi-document operations (TX-1–TX-3) are atomic. Concurrent conflicting commands (e.g. two officials assigning the same report) result in exactly one success. Failed operations leave no partial data. | Concurrency integration tests |
| NFR-11 | Privacy (POPIA) | Residents' identity, contact details and photos are visible only to the reporter and staff. Public map data excludes personal information. Only the data needed for service delivery is collected. | Rules tests, data classification review |
| NFR-12 | Maintainability | TypeScript strict mode, lint clean, domain logic in a shared tested package, CI runs all tests on each push, at least 80% line coverage of the shared domain package. | CI badge and coverage report |

## 6. Business rules

| ID | Rule |
|---|---|
| BR-01 | Only an authenticated, active user with role RESIDENT may submit a report. |
| BR-02 | A report needs a category (active), a description of 10–300 characters, a location inside the Sol Plaatje municipal bounding box, a suburb from the configured list, and a severity. A report may carry 0–3 photos, each JPEG/PNG/WebP and at most 5 MB. |
| BR-03 | A new report is a duplicate if an *open* report with the same category exists within 100 m and was created in the last 72 hours. The duplicate is stored with status DUPLICATE and `parentReportId`, and the parent's `affectedCount` is incremented. DUPLICATE is terminal. |
| BR-04 | References are `CL-<year>-<4-digit sequence>`, allocated in a transaction, unique and never reused. |
| BR-05 | A report's status may change only along the transitions in the Report state machine (§7). Every change appends an immutable status-history entry (from, to, actor, role, note, time). History entries are never edited or deleted. |
| BR-06 | A report has at most one active task at any time. |
| BR-07 | A report may be assigned only to an active Field Worker whose department equals the report's department, and only while the report is UNDER_REVIEW or ESCALATED (or IN_PROGRESS, for reassignment). |
| BR-08 | Only the assigned Field Worker may accept, start or complete a task, and only in order ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED. |
| BR-09 | Completion requires notes of at least 10 characters and 1–3 proof photos. Completing a task sets the report to RESOLVED and records `resolvedAt` in the same transaction. |
| BR-10 | An open report not resolved within its department's `slaHours` of creation is moved to ESCALATED by the hourly schedule (once). Officials may escalate manually with a reason. |
| BR-11 | Only the reporting Resident may confirm or reopen a RESOLVED report, and only within 7 days of `resolvedAt`. After 7 days the schedule closes it. CLOSED, REJECTED and DUPLICATE are terminal. |
| BR-12 | Rejection requires a reason (10–300 characters), and only SUBMITTED or UNDER_REVIEW reports may be rejected. |
| BR-13 | Alerts may be created only by Officials or Admins. They require a title of at most 100 characters, a message of at most 500, at least one target suburb or ALL, and an expiry that is later than now and no more than 30 days ahead. |
| BR-14 | A resident sees an alert only if it is active, unexpired, and targets their suburb or ALL. |
| BR-15 | Only Administrators manage accounts and configuration. An Administrator cannot deactivate or demote their own account. |
| BR-16 | Self-registration always creates role RESIDENT. Staff roles are granted only by an Administrator. A deactivated account cannot sign in or call any function. |
| BR-17 | Reporter identity, contact details and report photos are visible only to the reporter and staff. Other residents see category, status, approximate location and age only. |
| BR-18 | Internal comments are visible only to Officials, Field Workers and Admins. |
| BR-19 | Inactive departments and categories cannot be selected for new reports or assignments. Existing records keep their reference. |
| BR-20 | Officials may triage, assign and escalate reports only for their own department. Admins may act on any department. |

### Critical transactions (integrity rules)

| ID | Transaction | Atomic unit | Integrity rule / failure behaviour |
|---|---|---|---|
| TX-1 | Submit report | read counter + duplicate candidates → write report, history, counter, parent `affectedCount`, notifications | Reference allocated exactly once even under concurrent submits. On any failure nothing is written and uploaded photos are orphaned to a quarantine path that is cleaned by a schedule |
| TX-2 | Assign / reassign | read report + active tasks + worker → write task(s), report status/assignee, history, notifications | Re-check BR-06/07 inside the transaction. Of two concurrent assigns, one fails with `failed-precondition` |
| TX-3 | Complete task | read task + report → write task COMPLETED, report RESOLVED + `resolvedAt`, history, notification | The task and the report can never disagree. If the report is no longer IN_PROGRESS/ESCALATED, the task completion is refused |

## 7. Report state machine

| From | Event | To | Who | Guard |
|---|---|---|---|---|
| (new) | submit | SUBMITTED | Resident | BR-01, BR-02, not duplicate |
| (new) | submit | DUPLICATE | System | BR-03 |
| SUBMITTED | triage | UNDER_REVIEW | Official | BR-20 |
| SUBMITTED, UNDER_REVIEW | reject | REJECTED | Official | BR-12 |
| UNDER_REVIEW, ESCALATED | assign | IN_PROGRESS | Official | BR-06, BR-07 |
| SUBMITTED, UNDER_REVIEW, IN_PROGRESS | escalate | ESCALATED | System (SLA) / Official | BR-10 |
| IN_PROGRESS, ESCALATED | completeTask | RESOLVED | Field Worker | BR-09 |
| RESOLVED | confirm / auto-close | CLOSED | Resident / System | BR-11 |
| RESOLVED | reopen | UNDER_REVIEW | Resident | BR-11 |

Task: ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED. Any active state goes to REASSIGNED (on reassignment) or CANCELLED (if the report is rejected or closed by an official).

## 8. Acceptance criteria (included and planned FRs)

**FR-01 Register.** Valid details create an account with role RESIDENT and a profile document. A duplicate email is refused with "email already registered". A password under 8 characters is refused. A missing suburb is refused. A user cannot choose a role.

**FR-02 Sign in.** Valid credentials redirect to `/resident`, `/official`, `/worker` or `/admin` by role. Wrong credentials show a generic error. A deactivated account is refused with "account deactivated". Opening another role's route shows the permission-denied page. Sign-out clears the session.

**FR-03 Submit report.** The form validates every BR-02 field with field-level messages before submission, and the server re-validates. A pin outside the municipal box is refused. A fourth photo, a file over 5 MB or a non-image is refused. On success the resident sees a confirmation with the reference.

**FR-04 Reference.** Two reports submitted at the same time get distinct sequential references. A new report has status SUBMITTED, the category's default department and one history entry.

**FR-05 Duplicate.** Same category within 100 m of an open report from the last 72 h → stored as DUPLICATE, linked, parent count +1, and the resident is shown "already reported as CL-…, you'll be notified of progress". At 101 m, a different category, a resolved parent or a parent older than 72 h → a new report.

**FR-06 My reports.** Only the resident's own reports are listed. The tabs filter correctly. The detail page shows the timeline in chronological order with actor role and notes. Opening another resident's report ID is denied. An empty state is shown when there are no reports.

**FR-07 Map.** Open reports are shown as category markers. The filter works. Popups show category, status and age only. No name or photo appears in the network payload.

**FR-08 Queue.** Officials see their department's reports (Admins see all). Filters combine. Search by an exact reference finds the report. Unassigned reports are flagged. An empty result shows an empty state.

**FR-09 Triage / reject.** Triage moves SUBMITTED→UNDER_REVIEW and records history. Reject requires a reason and moves to REJECTED. Triage from any other status is refused. Acting on another department's report is refused.

**FR-10 Assign.** Only active workers of the report's department are listed. Assigning creates an ASSIGNED task and moves the report to IN_PROGRESS with history and notifications to the resident and worker. Assigning a report that already has an active task is refused. Two concurrent assignments → exactly one succeeds.

**FR-11 Field worker.** The worker sees only their own tasks, grouped by status. Accept → start → complete must happen in order, and skipping a step is refused. Completing without notes or a photo is refused. Completion sets the task to COMPLETED and the report to RESOLVED, and notifies the resident. Another worker cannot act on the task.

**FR-12 Reassign.** The old task becomes REASSIGNED, a new ASSIGNED task is created for the new worker, the report stays IN_PROGRESS, and history records the change. Reassigning to the same worker or to an ineligible worker is refused.

**FR-13 Escalate.** A report past its SLA becomes ESCALATED on the next scheduled run (testable by invoking the schedule with a fixed clock), with a single history entry. Manual escalation requires a reason. An escalated report can be assigned.

**FR-14 Confirm / reopen.** Within 7 days the resident can confirm (→ CLOSED) or reopen with a reason (→ UNDER_REVIEW). After 7 days both are refused, and the schedule closes the report. Another resident cannot act on it.

**FR-15 Notifications.** Each event above creates a notification for the right recipients. The badge count updates live. Opening a notification marks it read and navigates to the report or task.

**FR-16 Broadcast.** BR-13 validation, with field-level errors. A valid alert stores the alert and creates one recipient record per targeted active resident, and `recipientCount` matches. A Resident or Field Worker calling the function is refused.

**FR-17 Alerts feed.** Residents see only alerts for their suburb or ALL that are active and unexpired, emergencies first. Mark-as-read updates the unread badge and sets `readAt`. Expired alerts disappear.

**FR-18 Alert history.** Lists sent alerts with recipient and read counts that match the recipient records. Deactivation hides the alert from residents immediately.

**FR-19 Analytics.** For the seeded dataset the counts, average resolution hours and SLA compliance percentages equal the precomputed expected values. The empty department case shows "no data" rather than NaN.

**FR-20 User admin.** Creating a staff account sets claims and a profile. Deactivation blocks sign-in and function calls immediately. A role change takes effect on the user's next token refresh (forced). An admin cannot deactivate or demote themselves. Non-admins are refused.

**FR-21 Configuration.** SLA hours must be a whole number from 1 to 720. Deactivating a category hides it from the report form. Deactivating a department hides it from assignment. Names are unique.
