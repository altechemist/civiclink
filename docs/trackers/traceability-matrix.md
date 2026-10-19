# Traceability Matrix

Problem evidence → Requirement → Rules → Use case / workflow → Screen → Code → Data → Tests.
Update the row in the same PR that implements the requirement. "Planned" component names come from the plan and are corrected to the real names when built.

Problem evidence keys (Phase 1): **P1** no digital capture / location · **P2** duplicates · **P3** no feedback to residents · **P4** phone-based dispatch, no audit · **P5** no targeted alerts (strike, outages) · **P6** no management visibility · **P7** no access control / accountability.

| FR | Evidence | BRs | Use case / workflow | Screen (route) | Main components (planned) | Data | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-01 | P7 | BR-16 | UC Register | `/register` | RegisterPage, `onUserCreated` trigger | users | IT-AUTH-01..03, E2E-04 | Planned |
| FR-02 | P7 | BR-15, BR-16 | UC Sign in | `/login`, `RoleGuard` | AuthProvider, RoleGuard | Auth claims | RT-USR-*, E2E-04 | Planned |
| FR-03 | P1 | BR-01, BR-02 | W1 Submit | `/resident/report/new` | ReportForm, LocationPicker, PhotoUploader, `submitReport` | reports, storage | UT-SCH-*, IT-RPT-01..06 | Planned |
| FR-04 | P1, P4 | BR-04, BR-05 | W1 Submit | confirmation | ReportService.submit (TX-1), ReferenceAllocator | counters, reports, history | IT-RPT-07, IT-RPT-08 (concurrency) | Planned |
| FR-05 | P2 | BR-03 | W1 Submit (alt: duplicate) | confirmation (duplicate variant) | DuplicatePolicy, ReportRepository.findNearbyOpen | reports.geohash | UT-DUP-01..06, IT-RPT-09, E2E-02 | Planned |
| FR-06 | P3 | BR-17 | UC Track report | `/resident/reports`, `/resident/reports/:id` | MyReportsPage, ReportTimeline | reports, history | RT-RPT-01..03 | Planned |
| FR-07 | P1, P6 | BR-17 | UC View map | `/map` | CommunityMap, `publicReports` projection | publicReports | RT-PUB-01, IT-PUB-01 | Planned |
| FR-08 | P4, P6 | BR-20 | W2 Assign | `/official/reports` | ReportQueue, QueueFilters | reports | RT-RPT-04..06 | Planned |
| FR-09 | P4 | BR-05, BR-12, BR-19, BR-20 | W2 Assign (alt: reject) | `/official/reports/:id` | TriagePanel, `triageReport`, `rejectReport` | reports, history | IT-TRI-01..05 | Planned |
| FR-10 | P4 | BR-06, BR-07, BR-20 | W2 Assign | `/official/reports/:id` | AssignPanel, `assignReport` (TX-2) | tasks, reports, history | IT-ASG-01..07 | Planned |
| FR-11 | P3, P4 | BR-08, BR-09 | W2 Complete | `/worker`, `/worker/tasks/:id` | TaskList, TaskDetail, CompletionForm, `updateTask`, `completeTask` (TX-3) | tasks, reports, storage | UT-TSM-*, IT-TSK-01..08, E2E-01 | Planned |
| FR-12 | P4 | BR-06, BR-07 | W2 (alt: reassign) | `/official/reports/:id` | `reassignTask` | tasks, history | IT-ASG-08..10 | Planned |
| FR-13 | P4, P6 | BR-10 | State: ESCALATED | queue badge | SlaPolicy, `escalateOverdue` schedule, `escalateReport` | reports, departments | UT-SLA-*, IT-ESC-01..04 | Planned |
| FR-14 | P3 | BR-11 | W2 (alt: reopen) | `/resident/reports/:id` | `confirmResolution`, `reopenReport`, `autoCloseResolved` | reports, history | IT-RES-01..05 | Planned |
| FR-15 | P3 | — | all workflows | `NotificationBell`, `/notifications` | NotificationService | users/*/notifications | IT-NTF-01..03, NFT-05 | Planned |
| FR-16 | P5 | BR-13 | W3 Broadcast | `/official/alerts/new` | AlertComposer, `broadcastAlert` | alerts, recipients | UT-SCH-ALR-*, IT-ALR-01..05 | Planned |
| FR-17 | P5 | BR-14 | W3 Broadcast | `/resident/alerts` | AlertsFeed, `markAlertRead` | alerts, recipients | RT-ALR-01..03, E2E-03 | Planned |
| FR-18 | P5, P6 | — | UC Manage alerts | `/official/alerts` | AlertHistory, `deactivateAlert` | alerts | IT-ALR-06..07 | Planned |
| FR-19 | P6 | — | UC View analytics | `/official/analytics` | AnalyticsService, charts | reports, departments | UT-ANL-*, IT-ANL-01 | Planned |
| FR-20 | P7 | BR-15, BR-16 | UC Manage users | `/admin/users` | UserAdminService, `createStaffUser`, `setUserRole`, `setUserActive` | users, Auth claims | IT-ADM-01..07 | Planned |
| FR-21 | P4 | BR-19 | UC Configure | `/admin/config` | `upsertDepartment`, `upsertCategory` | departments, categories | IT-CFG-01..04 | Planned |
| FR-22 | P4 | BR-18 | — | report detail (staff) | CommentThread, `addComment` | reports/*/comments | RT-CMT-01..02 | Planned (Could) |
| FR-23 | P7 | — | — | `/admin/logs` | Logger, SystemLogPage | systemLogs | IT-LOG-01 | Planned (Could) |
| FR-24 | P3, P5 | — | — | — | FCM | — | — | Planned (Could) |
| FR-25 | P5 | — | — | — | — | — | — | Deferred |
| FR-26 | P6 | — | — | queue export button | csvExport | — | UT-CSV-01 | Planned (Could) |
| FR-27 | P1 | — | — | — | — | — | — | Deferred |
| FR-28 | P5 | — | — | — | — | — | — | Deferred |

## NFR → verification

| NFR | Tests | Status |
|---|---|---|
| NFR-01 | RT-* (full matrix), IT-*-AUTHZ cases | Planned |
| NFR-02 | RT-USR-*, gitleaks, code review | Planned |
| NFR-03 | IT-* validation cases | Planned |
| NFR-04 | CI gitleaks job | Planned |
| NFR-05 | NFT-05 (Playwright timing) | Planned |
| NFR-06 | NFT-06 (Lighthouse + command timing script) | Planned |
| NFR-07 | E2E mobile project | Planned |
| NFR-08 | NFT-08 Lighthouse a11y | Planned |
| NFR-09 | E2E chromium + firefox | Planned |
| NFR-10 | IT-RPT-08, IT-ASG-07, IT-TSK-08 (concurrency/atomicity) | Planned |
| NFR-11 | RT-PUB-*, RT-RPT-03, data classification review | Planned |
| NFR-12 | CI lint/typecheck, coverage report | Planned |

## Screen inventory (each screen's states)

Mark each state ✓ when implemented. Every screen must handle: **L**oading, **E**mpty, **Err**or, **D**enied (wrong role).

| Route | FR | L | E | Err | D |
|---|---|---|---|---|---|
| /login, /register | FR-01/02 | | n/a | | n/a |
| /resident | FR-06/17 | | | | |
| /resident/report/new | FR-03 | | n/a | | |
| /resident/reports(/:id) | FR-06/14 | | | | |
| /resident/alerts | FR-17 | | | | |
| /map | FR-07 | | | | |
| /official | FR-08/19 | | | | |
| /official/reports(/:id) | FR-08..13 | | | | |
| /official/alerts(/new) | FR-16/18 | | | | |
| /official/analytics | FR-19 | | | | |
| /worker, /worker/tasks/:id | FR-11 | | | | |
| /admin/users, /admin/config | FR-20/21 | | | | |
| /403, /404 | NFR-01 | n/a | n/a | n/a | n/a |
