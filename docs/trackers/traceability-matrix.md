# Traceability Matrix

Problem evidence → Requirement → Rules → Workflow / use case → Screen → Code → Data → Tests.
This matrix reflects the **implemented** system (updated 20 Oct 2026). Paths are relative to the repo root: `web/` = `apps/web/src/`, `fn/` = `functions/src/`, `shared/` = `packages/shared/src/`.

Problem evidence keys (Phase 1): **P1** no digital capture / location · **P2** duplicates · **P3** no feedback to residents · **P4** phone-based dispatch, no audit · **P5** no targeted alerts (strike, outages) · **P6** no management visibility · **P7** no access control / accountability.

| FR | Evidence | BRs | Workflow / UC | Screen (route) | Main components | Data | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-01 | P7 | BR-16 | UC Register | `/register` | `web/pages/auth/RegisterPage.tsx` → `registerResident` → `fn/services/userService.ts` | users, Auth claims | UT-SCH-05, IT-AUTH-01, IT-AUTH-02 | Included |
| FR-02 | P7 | BR-15, BR-16 | UC Sign in | `/login`, all routes | `web/auth/AuthProvider.tsx`, `web/auth/RequireRole.tsx`, `fn/lib/command.ts` (`loadActor`) | Auth claims, users | IT-AUTH-03, RT-USR-05, E2E-04, E2E-06 | Included |
| FR-03 | P1 | BR-01, BR-02 | W1 | `/resident/report/new` | `web/pages/resident/NewReportPage.tsx`, `web/components/maps.tsx` (LocationPicker), `web/lib/upload.ts` (compression), `ReportService.submit`, `photoService` | reports, photos | UT-SCH-01..04, UT-SCH-09, IT-RPT-01..06, IT-RPT-10, RT-PHO-01, E2E-05, E2E-07 | Included |
| FR-04 | P1, P4 | BR-04, BR-05 | W1 (TX-1) | submit result | `ReportService.submit`, `shared/policies.ts` (`formatReference`) | counters, reports, history | UT-REF-01, IT-RPT-07, IT-RPT-08 | Included |
| FR-05 | P2 | BR-03 | W1 (alt: duplicate) | duplicate result | `shared/policies.ts` (`DuplicatePolicy`), geohash query in `ReportService.submit` | reports.geohash, followerIds | UT-DUP-01..06, IT-RPT-09, E2E-02 | Included |
| FR-06 | P3 | BR-17 | UC Track | `/resident`, `/resident/reports`, `/resident/reports/:id` | `MyReportsPage.tsx`, `ResidentReportPage.tsx`, `components/domain.tsx` (Timeline, LifecycleProgress) | reports, history | RT-RPT-02, RT-RPT-03, E2E-01 | Included |
| FR-07 | P1, P6 | BR-17 | UC Map | `/map` | `web/pages/common/CommunityMapPage.tsx`, `IncidentMap` | publicReports | UT-PRV-01, RT-PUB-01, IT-RPT-07 | Included |
| FR-08 | P4, P6 | BR-20 | W2 | `/official`, `/official/reports` | `OfficialDashboard.tsx`, `ReportQueuePage.tsx`, `useStaffReports.ts` | reports | RT-RPT-04, RT-RPT-06, E2E-01 | Included |
| FR-09 | P4 | BR-05, BR-12, BR-19, BR-20 | W2 (alt: reject) | `/official/reports/:id` | `OfficialReportPage.tsx`, `ReportService.triage/reject`, `reportLifecycle.ts` | reports, history | IT-TRI-01..05 | Included |
| FR-10 | P4 | BR-06, BR-07, BR-20 | W2 (TX-2) | `/official/reports/:id` | `OfficialReportPage.tsx`, `ReportService.assign` | tasks, reports, history | IT-ASG-01..07, E2E-01 | Included |
| FR-11 | P3, P4 | BR-08, BR-09 | W2 (TX-3) | `/worker`, `/worker/tasks/:id` | `WorkerHome.tsx`, `TaskPage.tsx`, `TaskService.update/complete`, `shared/stateMachines.ts` | tasks, reports, photos | UT-TSM-01, UT-SCH-06, IT-TSK-01..07, RT-PHO-01, E2E-01 | Included |
| FR-12 | P4 | BR-06, BR-07 | W2 (alt: reassign) | `/official/reports/:id` | `ReportService.reassign` | tasks, history | IT-ASG-08..10, IT-TSK-06 | Included |
| FR-13 | P4, P6 | BR-10 | State ESCALATED | queue, dashboard | `shared/policies.ts` (`SlaPolicy`), `MaintenanceService.escalateOverdue`, `escalateOverdue` schedule, `ReportService.escalate` | reports, departments | UT-SLA-01..02, IT-ESC-01..03 | Included |
| FR-14 | P3 | BR-11 | W2 (alt: confirm/reopen) | `/resident/reports/:id` | `ReportService.confirm/reopen`, `MaintenanceService.autoCloseResolved` | reports, history | UT-RES-01, IT-RES-01..05, E2E-01 | Included |
| FR-15 | P3 | — | all workflows | `NotificationBell` (all shells) | `fn/services/notificationService.ts`, `components/domain.tsx` | users/*/notifications | IT-RPT-07, IT-ASG-01, IT-TSK-01, RT-USR-04, NFT-05 | Included |
| FR-16 | P5 | BR-13 | UC Broadcast | `/official/alerts/new` | `NewAlertPage.tsx`, `AlertService.broadcast` | alerts, recipients | UT-SCH-ALR-01..02, IT-ALR-01..04, E2E-03 | Included |
| FR-17 | P5 | BR-14 | UC Alerts | `/resident/alerts`, `/resident` | `AlertsFeedPage.tsx`, `useResidentAlerts.ts`, `AlertService.markRead` | alerts, recipients | RT-ALR-01..02, IT-ALR-05, E2E-03 | Included |
| FR-18 | P5, P6 | — | UC Manage alerts | `/official/alerts` | `AlertsAdminPage.tsx`, `AlertService.deactivate` | alerts | IT-ALR-05, IT-ALR-06 | Included |
| FR-19 | P6 | — | UC Analytics | `/official/analytics` | `AnalyticsPage.tsx`, `AnalyticsService`, `shared/analytics.ts` | reports, departments | UT-ANL-01..02, IT-ANL-01 | Included |
| FR-20 | P7 | BR-15, BR-16 | UC Manage users | `/admin/users` | `UsersPage.tsx`, `UserService` | users, Auth | UT-SCH-07, IT-ADM-01..06, IT-AUTH-03 | Included |
| FR-21 | P4 | BR-19 | UC Configure | `/admin/config` | `ConfigPage.tsx`, `ConfigService` | departments, categories | UT-SCH-08, IT-CFG-01..04, IT-RPT-05 | Included |
| FR-22 | P4 | BR-18 | — | `/official/reports/:id` (internal notes) | `CommentService`, `OfficialReportPage.tsx` | reports/*/comments | IT-CMT-01, RT-CMT-01 | Included |
| FR-23 | P7 | — | UC System log | `/admin/logs` | `fn/services/logService.ts`, `LogsPage.tsx`, `runMaintenance` | systemLogs | IT-ADM-07, RT-CFG-01 | Included |
| FR-24 | P3, P5 | — | all workflows | `/profile` (push toggle) | `fn/services/pushService.ts` (intents, `deliverPushes`), `NotificationService.add`, `execute()`, `web/lib/push.ts`, `public/sw.js` | users/*/pushTokens | IT-PSH-01..03; manual live check | Included |
| FR-25 | P5 | BR-26 | `ReportService.submit` guest limit; `GuestService.start` per-address limit (`rateLimits`); `guests: false` on `updateProfile`; transfer codes hashed, single-use, 15 min | IT-GST-02, IT-GST-04, IT-GST-05, RT-GST-01 |
| BR-25 | UC Broadcast alert (SMS) | `/profile` (opt-in), `/admin/logs` (SMS outbox) | `fn/services/smsService.ts` (SmsGateway: Twilio / simulated), `AlertService.publish`, `UserService.updateProfile`, `LogsPage.tsx` | smsOutbox, users.smsAlerts, alerts.smsCount | UT-SMS-01..03, IT-SMS-01..03, RT-SMS-01 | Included |
| FR-26 | P6 | — | — | queue "Export CSV" | `shared/analytics.ts` (`toCsv`), `ReportQueuePage.tsx` | — | UT-CSV-01 | Included |
| FR-27 | P1 | BR-01, BR-02 | W1 (offline path) | `/resident/report/new`, `/resident` (saved reports) | `web/lib/outbox.ts` (IndexedDB), `web/components/outbox.tsx` (OutboxSync, OutboxCard), `ReportService.submit` (`clientId`) | reports (id from user + clientId) | UT-OFF-01, IT-OFF-01, IT-OFF-02, E2E-12 | Included |
| FR-28 | P5 | BR-13, BR-24 | UC Schedule alert | `/official/alerts/new`, `/official/alerts?tab=scheduled` | `AlertService.broadcast/publishDue/cancelScheduled`, `MaintenanceService.runAll`, `http.ts` (background check), `NewAlertPage.tsx`, `AlertsAdminPage.tsx` | scheduledAlerts, alerts | UT-ALS-01..02, IT-SCH-01..02, RT-ALS-01, E2E-13 | Included |
| FR-29 | P7 | BR-16 | UC Sign in (Google) | `/login`, `/welcome` | `AuthProvider.signInWithGoogle`, `WelcomePage.tsx`, `completeProfile` → `UserService.completeProfile` | users, Auth claims | IT-AUTH-04, IT-AUTH-05, E2E-08 | Included |
| FR-30 | P7 | — | UC Sign in | `/login` | `AuthProvider.resetPassword` (Firebase Auth reset email) | Auth | E2E-09 | Included |
| FR-31 | P5 | BR-14, BR-16 | UC Profile | `/profile` | `ProfilePage.tsx`, `updateProfile` → `UserService.updateProfile` | users, Auth claims | IT-PRF-01, IT-PRF-02, E2E-10 | Included |
| FR-33 | P2 | BR-23 | UC Me too | `/map` (popup) | `CommunityMapPage.tsx` (MeToo), `affirmReport` → `ReportService.affirm` | reports, publicReports, history | IT-AFF-01, IT-AFF-02, E2E-11 | Included |
| FR-34 | P1 | — | UC Install | all (offline banner), `/resident` (install) | `public/sw.js`, `public/manifest.webmanifest`, `components/pwa.tsx` | Firestore offline cache | NFT-10 | Included |
| FR-35 | P4 | BR-06, BR-07, BR-20 | UC Bulk assign | `/official/reports` (checkboxes) | `ReportQueuePage.tsx` (BulkAssignBar), `assignReports` → `ReportService.assignMany` | tasks, reports, history | UT-BLK-01, IT-BLK-01..02, E2E-14 | Included |
| FR-36 | P3, P6 | BR-17 | UC View transparency page | `/transparency` (public) | `pages/public/TransparencyPage.tsx`, `GET /api/public/stats` → `PublicStatsService`, `shared/analytics.ts` | reports (aggregated), categories, departments | UT-PUB-01, UT-RAT-02, IT-PUB-01..02, E2E-15, NFT-11 | Included |
| FR-37 | P3 | BR-11 | W2 (confirm) | `/resident/reports/:id` (stars) | `ResidentReportPage.tsx`, `confirmResolution` → `ReportService.confirm`, `OfficialReportPage.tsx` | reports.rating, reports.feedback | UT-RAT-01, IT-RAT-01, E2E-01 | Included |
| FR-38 | P3, P5 | BR-17 | UC View what's happening | `/` (signed out) | `pages/public/PublicHomePage.tsx`, `GET /api/public/feed` → `PublicFeedService` | publicReports, alerts | IT-PUB-03, E2E-16, NFT-08 | Included |
| FR-39 | P1, P3 | BR-01, BR-26 | UC Report as guest; W1 | `/report`, `/account` | `AuthProvider.startGuest`, `App.tsx` (ReportEntry), `GuestAccountPage.tsx`, `fn/services/guestService.ts` (start, upgrade, startTransfer, claim), `execute()` (`guests: false`) | users.isGuest, guestTransfers, rateLimits, reports | UT-GST-01, IT-GST-01..05, RT-GST-01, E2E-16, E2E-17 | Included |
| FR-32 | P7 | BR-22 | UC Delete account | `/profile` | `ProfilePage.tsx`, `deleteMyAccount` → `UserService.deleteMyAccount` | users, reports, photos, recipients, notifications, Auth | IT-DEL-01, IT-DEL-02, E2E-10 | Included |

## Business rules → enforcement → tests

| BR | Enforced in | Tests |
|---|---|---|
| BR-01 | `execute()` role list for `submitReport` (both adapters) | IT-RPT-06, IT-HTTP-02 |
| BR-02 | `submitReportSchema`, `photoFileSchema`, `photoInputSchema`, `photoService.decodePhotos` (size, magic bytes), `insideMunicipality` | UT-SCH-01..04, UT-SCH-09, UT-LOC-01, IT-RPT-02..04, E2E-05, E2E-07 |
| BR-03 | `DuplicatePolicy` inside TX-1 | UT-DUP-01..06, IT-RPT-09, E2E-02 |
| BR-04 | counter document inside TX-1, `formatReference` | UT-REF-01, IT-RPT-08 |
| BR-05 | `ReportStateMachine` via `applyTransition`; history client-write denied | UT-RSM-01..03, IT-TRI-02, RT-RPT-01 |
| BR-06 | `activeTaskId` check inside TX-2 | IT-ASG-04, IT-ASG-07 |
| BR-07 | `eligibleWorker()` | IT-ASG-02, IT-ASG-03 |
| BR-08 | `TaskStateMachine`, `ownTask()` | UT-TSM-01, IT-TSK-02, IT-TSK-03 |
| BR-09 | `completeTaskSchema`, TX-3 | UT-SCH-06, IT-TSK-04..06 |
| BR-10 | `SlaPolicy`, `MaintenanceService.escalateOverdue` | UT-SLA-01..02, IT-ESC-01 |
| BR-11 | `ResolutionPolicy`, `residentResolution()`, `autoCloseResolved` | UT-RES-01, IT-RES-01..05 |
| BR-12 | `rejectReportSchema` (reason) + state machine | IT-TRI-03 |
| BR-13 | `broadcastAlertSchema`, `validateAlertExpiry` | UT-SCH-ALR-01..02, IT-ALR-03, IT-ALR-04 |
| BR-14 | feed query `array-contains-any [suburb, ALL]`; recipients by suburb | IT-ALR-01, IT-ALR-02, E2E-03 |
| BR-15 | admin-only commands; self-change refused | IT-ADM-04, IT-ADM-05 |
| BR-16 | `registerResident` fixes role; `loadActor` refuses inactive; Auth `disabled` | UT-SCH-05, IT-AUTH-01, IT-AUTH-03, RT-USR-02 |
| BR-17 | `canReadReport` rule (reports, history, photos); `publicReports` projection | UT-PRV-01, RT-RPT-03, RT-PUB-01, RT-PHO-01, RT-PHO-02 |
| BR-18 | comments rule `isStaff()`; `CommentService` access check | RT-CMT-01, IT-CMT-01 |
| BR-19 | active checks in submit, triage, staff creation | IT-RPT-05, IT-TRI-05, IT-CFG-03 |
| BR-20 | `assertDepartmentAccess`; rules `departmentId == dept()` | IT-TRI-04, RT-RPT-04, RT-TSK-01 |
| BR-21 | `settings/app.reportsPerHour` read and enforced inside TX-1; `updateSettings` (admin) | IT-RPT-11, IT-CFG-05 |
| BR-22 | `UserService.deleteMyAccount`; notifications skip `deleted-user` | IT-DEL-01, IT-DEL-02, E2E-10 |
| BR-23 | `ReportService.affirm` (open, not own, once) | IT-AFF-01, IT-AFF-02, E2E-11 |
| BR-24 | `validateAlertSchedule`; claim SCHEDULED → PUBLISHED in a transaction; `alerts.create()` with the scheduled id | UT-ALS-01, IT-SCH-01, IT-SCH-02 |
| BR-25 | `AlertService.publish` (EMERGENCY + opted in + phone); `updateProfileSchema` refine; smsOutbox rule admin-only; deletion erases records | UT-SMS-03, IT-SMS-01, IT-SMS-03, RT-SMS-01 |

## NFR → verification

| NFR | Verification | Result |
|---|---|---|
| NFR-01 | RT-* (22 rules tests), IT-*-authz cases, E2E-04 | Pass |
| NFR-02 | Firebase Auth only; custom claims; RT-USR-02; no password fields in Firestore | Pass |
| NFR-03 | IT-RPT-02, IT-TRI-03, IT-ALR-03, IT-CFG-01, E2E-05 | Pass |
| NFR-04 | gitleaks CI job; `.env.example`; demo config only | Pass |
| NFR-05 | NFT-05 in E2E-01: submit→queue 72 ms, complete→resident 1.90 s (full local run, 20 Oct) | Pass |
| NFR-06 | NFT-06: `/official` 1.20 s, `/official/reports` 1.32 s, `/official/alerts` 0.95 s to interactive (< 3 s); p95 of 50 `getAnalytics` calls 73 ms (< 2 s) | Pass |
| NFR-07 | NFT-07 (360×640, no horizontal scroll; report in 3 steps) | Pass |
| NFR-08 | NFT-08 axe-core WCAG 2.1 A/AA: login, report form, my reports, queue → 0 violations (after DEF-03 fix) | Pass |
| NFR-09 | E2E on Chromium and Firefox in CI | Pass (CI) |
| NFR-10 | IT-RPT-08, IT-ASG-07, IT-TSK-06 | Pass |
| NFR-11 | RT-RPT-03, RT-PUB-01, RT-PHO-01, RT-PHO-02, UT-PRV-01; data classification (plan §1) | Pass |
| NFR-12 | strict TS, ESLint, CI, shared coverage 97.9% lines (threshold 80%) | Pass |
| NFR-13 | NFT-11 on the deployed site: assets immutable for a year, app shell revalidated, `/api/public/stats` served from the Vercel edge cache (HIT after the first request); service-worker tile cache | Pass |
| NFR-14 | NFT-12 on the deployed site: CSP (no `unsafe-eval`), HSTS, X-Frame-Options, nosniff; 0 CSP violations across all screens and the Google sign-in popup | Pass |

## Screen inventory (states implemented)

L = loading, E = empty, Err = error, D = permission-denied (via `RequireRole` → `ForbiddenPage`, and rules-denied reads show the access message in `ErrorState`).

| Route | FR | L | E | Err | D | Evidence |
|---|---|---|---|---|---|---|
| /login, /register | FR-01/02 | ✓ | n/a | ✓ | n/a | 01, 02 |
| /resident | FR-06/17 | ✓ | ✓ | ✓ | ✓ | 03 |
| /resident/report/new | FR-03..05 | ✓ | n/a | ✓ | ✓ | 04–09 |
| /resident/reports(/:id) | FR-06/14 | ✓ | ✓ | ✓ | ✓ | 10–12 |
| /resident/alerts | FR-17 | ✓ | ✓ | ✓ | ✓ | 13 |
| /map | FR-07 | ✓ | ✓ | ✓ | ✓ | 14 |
| /official | FR-08 | ✓ | ✓ | ✓ | ✓ | 20 |
| /official/reports(/:id) | FR-08..13, 22, 26 | ✓ | ✓ | ✓ | ✓ | 21–24 |
| /official/alerts(/new) | FR-16/18 | ✓ | ✓ | ✓ | ✓ | 25–27 |
| /official/analytics | FR-19 | ✓ | ✓ (no data) | ✓ | ✓ | 28 |
| /worker, /worker/tasks/:id | FR-11 | ✓ | ✓ | ✓ | ✓ | 40–43 |
| /admin/users, /admin/config, /admin/logs | FR-20/21/23 | ✓ | ✓ | ✓ | ✓ | 30–32 |
| 403 (any wrong-role route) | NFR-01 | n/a | n/a | n/a | ✓ | 15 |
