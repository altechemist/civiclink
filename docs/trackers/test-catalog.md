# Test Catalogue

Generated from the test code by `python3 scripts/test-catalog.py`. Every ID cited in the report appears in a test title, so `grep -r "<ID>"` finds the test. Results for the submitted commit are in its GitHub Actions run.

**Total: 140 automated tests.**

## Unit (Vitest): 30 tests

| ID | Scenario | File |
|---|---|---|
| UT-RSM-01 | every allowed transition succeeds for its allowed actors | `packages/shared/test/domain.test.ts` |
| UT-RSM-02 | every other (status, event) pair is rejected | `packages/shared/test/domain.test.ts` |
| UT-RSM-03 | terminal statuses allow no events and actors are enforced | `packages/shared/test/domain.test.ts` |
| UT-TSM-01 | tasks move in order; skipping steps is rejected (BR-08) | `packages/shared/test/domain.test.ts` |
| UT-DUP-01 | distance boundary 99 m / 100 m / 101 m | `packages/shared/test/domain.test.ts` |
| UT-DUP-02 | time window 71 h / 73 h | `packages/shared/test/domain.test.ts` |
| UT-DUP-03 | different category is not a duplicate | `packages/shared/test/domain.test.ts` |
| UT-DUP-04 | parent must be open | `packages/shared/test/domain.test.ts` |
| UT-DUP-05 | picks the closest candidate, oldest on a tie | `packages/shared/test/domain.test.ts` |
| UT-DUP-06 | haversine distance sanity check (Kimberley CBD → Galeshewe ≈ 3.4 km) | `packages/shared/test/domain.test.ts` |
| UT-SLA-01 | breach only after slaHours | `packages/shared/test/domain.test.ts` |
| UT-SLA-02 | never re-escalates and ignores closed work | `packages/shared/test/domain.test.ts` |
| UT-RES-01 | 7-day window and auto-close | `packages/shared/test/domain.test.ts` |
| UT-REF-01 | reference format and padding (BR-04) | `packages/shared/test/domain.test.ts` |
| UT-PRV-01 | public location is rounded to ~110 m (BR-17) | `packages/shared/test/domain.test.ts` |
| UT-ANL-01 | metrics on a fixture | `packages/shared/test/domain.test.ts` |
| UT-ANL-02 | empty input yields nulls, not NaN | `packages/shared/test/domain.test.ts` |
| UT-CSV-01 | CSV quoting | `packages/shared/test/domain.test.ts` |
| UT-LOC-01 | municipal bounds and nearest suburb | `packages/shared/test/domain.test.ts` |
| UT-SCH-01 | description boundaries 9/10/300/301 | `packages/shared/test/schemas.test.ts` |
| UT-SCH-02 | photo count 0/3/4 and file size and type | `packages/shared/test/schemas.test.ts` |
| UT-SCH-03 | location inside / outside municipal bounding box | `packages/shared/test/schemas.test.ts` |
| UT-SCH-04 | rejects unknown suburb and severity with field errors | `packages/shared/test/schemas.test.ts` |
| UT-SCH-05 | password minimum, optional SA phone, no role field accepted | `packages/shared/test/schemas.test.ts` |
| UT-SCH-06 | completion requires notes ≥10 and 1–3 proof photos (BR-09) | `packages/shared/test/schemas.test.ts` |
| UT-SCH-ALR-01 | title/message boundaries and target suburbs (BR-13) | `packages/shared/test/schemas.test.ts` |
| UT-SCH-ALR-02 | expiry must be future and within 30 days | `packages/shared/test/schemas.test.ts` |
| UT-SCH-07 | staff users need a department unless admin | `packages/shared/test/schemas.test.ts` |
| UT-SCH-08 | department SLA hours 1–720 whole numbers | `packages/shared/test/schemas.test.ts` |
| UT-SCH-09 | real type is detected from magic bytes | `packages/shared/test/schemas.test.ts` |

## Security rules (emulator): 19 tests

| ID | Scenario | File |
|---|---|---|
| RT-USR-01 | a user reads their own profile and may only stamp lastLoginAt | `tests/rules/rules.test.ts` |
| RT-USR-02 | users cannot change their own role, department or active flag (BR-16) | `tests/rules/rules.test.ts` |
| RT-USR-03 | residents cannot read other users; staff read the staff directory only | `tests/rules/rules.test.ts` |
| RT-USR-04 | notifications are private; only readAt can be set | `tests/rules/rules.test.ts` |
| RT-USR-05 | deactivated or anonymous users read nothing | `tests/rules/rules.test.ts` |
| RT-RPT-01 | no client can create or modify reports or history (functions only) | `tests/rules/rules.test.ts` |
| RT-RPT-02 | the reporter and duplicate followers read the report and its history | `tests/rules/rules.test.ts` |
| RT-RPT-03 | residents cannot read others' reports or list all reports (BR-17) | `tests/rules/rules.test.ts` |
| RT-RPT-04 | officials read only their department (BR-20) | `tests/rules/rules.test.ts` |
| RT-RPT-05 | workers read only reports assigned to them | `tests/rules/rules.test.ts` |
| RT-RPT-06 | admins read every report | `tests/rules/rules.test.ts` |
| RT-CMT-01 | internal comments are hidden from residents (BR-18) | `tests/rules/rules.test.ts` |
| RT-PUB-01 | the public projection is readable by residents, officials and admins only | `tests/rules/rules.test.ts` |
| RT-TSK-01 | workers read own tasks; officials read their department; others denied | `tests/rules/rules.test.ts` |
| RT-ALR-01 | signed-in users read alerts; nobody writes them directly | `tests/rules/rules.test.ts` |
| RT-ALR-02 | residents read only their own delivery record; officials read all | `tests/rules/rules.test.ts` |
| RT-CFG-01 | configuration is readable, never client-writable; counters and logs locked | `tests/rules/rules.test.ts` |
| RT-PHO-01 | report photos and proof are visible to the reporter, followers and staff with access (BR-17) | `tests/rules/rules.test.ts` |
| RT-PHO-02 | other users cannot read photos, and nobody writes them directly | `tests/rules/rules.test.ts` |

## Cloud Functions integration (emulator): 76 tests

| ID | Scenario | File |
|---|---|---|
| IT-AUTH-04 | completeProfile creates a RESIDENT profile and claims once | `functions/test/account.test.ts` |
| IT-AUTH-05 | existing accounts and anonymous callers cannot use completeProfile | `functions/test/account.test.ts` |
| IT-PRF-01 | residents change suburb and phone; claims follow; invalid phone refused | `functions/test/account.test.ts` |
| IT-PRF-02 | staff may change name and phone but have no home suburb | `functions/test/account.test.ts` |
| IT-DEL-01 | deletion anonymises reports and removes photos, profile, receipts and the Auth account | `functions/test/account.test.ts` |
| IT-DEL-02 | staff cannot self-delete; anonymised reports still progress without notifying anyone | `functions/test/account.test.ts` |
| IT-RPT-11 | submissions beyond the hourly limit are refused | `functions/test/account.test.ts` |
| IT-CFG-05 | settings are admin-only and bounded | `functions/test/account.test.ts` |
| IT-AUTH-01 | self-registration creates a RESIDENT with claims and a profile | `functions/test/admin-alerts.test.ts` |
| IT-AUTH-02 | duplicate email and weak password are refused | `functions/test/admin-alerts.test.ts` |
| IT-AUTH-03 | a deactivated account is refused by every command | `functions/test/admin-alerts.test.ts` |
| IT-ALR-01 | broadcast creates one recipient per active resident in the target suburbs | `functions/test/admin-alerts.test.ts` |
| IT-ALR-02 | ALL targets every active resident | `functions/test/admin-alerts.test.ts` |
| IT-ALR-03 | validation: long title, empty targets, past or far expiry | `functions/test/admin-alerts.test.ts` |
| IT-ALR-04 | residents and field workers cannot broadcast | `functions/test/admin-alerts.test.ts` |
| IT-ALR-05 | mark-as-read counts once per resident | `functions/test/admin-alerts.test.ts` |
| IT-ALR-06 | deactivation hides the alert | `functions/test/admin-alerts.test.ts` |
| IT-ADM-01 | admin creates a staff account with claims | `functions/test/admin-alerts.test.ts` |
| IT-ADM-02 | staff accounts need an active department | `functions/test/admin-alerts.test.ts` |
| IT-ADM-03 | role change updates the profile and claims | `functions/test/admin-alerts.test.ts` |
| IT-ADM-04 | an admin cannot demote or deactivate themselves (BR-15) | `functions/test/admin-alerts.test.ts` |
| IT-ADM-05 | non-admins cannot manage users | `functions/test/admin-alerts.test.ts` |
| IT-ADM-06 | reactivation restores access | `functions/test/admin-alerts.test.ts` |
| IT-ADM-07 | admin actions are written to the system log (FR-23) | `functions/test/admin-alerts.test.ts` |
| IT-CFG-01 | SLA hours must be 1–720 | `functions/test/admin-alerts.test.ts` |
| IT-CFG-02 | names are unique (case-insensitive) | `functions/test/admin-alerts.test.ts` |
| IT-CFG-03 | categories link to an existing department and can be deactivated | `functions/test/admin-alerts.test.ts` |
| IT-CFG-04 | non-admins cannot change configuration | `functions/test/admin-alerts.test.ts` |
| IT-ANL-01 | metrics reflect live data and are restricted to officials and admins | `functions/test/admin-alerts.test.ts` |
| IT-HTTP-01 | a resident submits a report through the HTTP API | `functions/test/http.test.ts` |
| IT-HTTP-02 | authentication, roles and validation behave exactly as with Cloud Functions | `functions/test/http.test.ts` |
| IT-HTTP-03 | unknown commands and wrong methods are refused | `functions/test/http.test.ts` |
| IT-HTTP-04 | the cron endpoint requires the secret | `functions/test/http.test.ts` |
| IT-RPT-01 | valid submission creates a SUBMITTED report with a reference | `functions/test/reports.test.ts` |
| IT-RPT-02 | invalid fields are rejected with field errors and nothing is written | `functions/test/reports.test.ts` |
| IT-RPT-03 | location outside the municipality is rejected (BR-02) | `functions/test/reports.test.ts` |
| IT-RPT-04 | photos must really be images of the declared type and within the size limit | `functions/test/reports.test.ts` |
| IT-RPT-05 | inactive category is refused (BR-19) | `functions/test/reports.test.ts` |
| IT-RPT-06 | only residents may submit (BR-01) | `functions/test/reports.test.ts` |
| IT-RPT-07 | default department from category, one history entry, officials notified | `functions/test/reports.test.ts` |
| IT-RPT-08 | concurrent submissions get unique sequential references (BR-04, NFR-10) | `functions/test/reports.test.ts` |
| IT-RPT-09 | a nearby open report of the same category is linked as a duplicate (BR-03) | `functions/test/reports.test.ts` |
| IT-RPT-10 | optional fields sent as undefined/null by the web client are accepted (DEF-02) | `functions/test/reports.test.ts` |
| IT-TRI-01 | triage moves SUBMITTED → UNDER_REVIEW and records history | `functions/test/reports.test.ts` |
| IT-TRI-02 | triage from a non-SUBMITTED status is refused | `functions/test/reports.test.ts` |
| IT-TRI-03 | reject needs a reason ≥ 10 characters (BR-12) | `functions/test/reports.test.ts` |
| IT-TRI-04 | officials cannot act on another department's report (BR-20) | `functions/test/reports.test.ts` |
| IT-TRI-05 | rerouting to an inactive department is refused; active reroute works | `functions/test/reports.test.ts` |
| IT-ASG-01 | assignment creates a task, moves the report to IN_PROGRESS and notifies | `functions/test/reports.test.ts` |
| IT-ASG-02 | a worker from another department is refused (BR-07) | `functions/test/reports.test.ts` |
| IT-ASG-03 | an inactive worker is refused (BR-07) | `functions/test/reports.test.ts` |
| IT-ASG-04 | a report with an active task cannot be assigned again (BR-06) | `functions/test/reports.test.ts` |
| IT-ASG-05 | a SUBMITTED (untriaged) report cannot be assigned | `functions/test/reports.test.ts` |
| IT-ASG-06 | residents and workers cannot assign | `functions/test/reports.test.ts` |
| IT-ASG-07 | two concurrent assignments: exactly one succeeds (NFR-10) | `functions/test/reports.test.ts` |
| IT-ASG-08 | reassignment ends the old task and creates a new one | `functions/test/reports.test.ts` |
| IT-ASG-09 | reassigning to the same worker is refused | `functions/test/reports.test.ts` |
| IT-ASG-10 | reassigning without an active task is refused | `functions/test/reports.test.ts` |
| IT-TSK-01 | accept → start → complete resolves the report and notifies the resident | `functions/test/reports.test.ts` |
| IT-TSK-02 | another worker cannot act on the task (BR-08) | `functions/test/reports.test.ts` |
| IT-TSK-03 | steps cannot be skipped (BR-08) | `functions/test/reports.test.ts` |
| IT-TSK-04 | completion without notes or proof is refused (BR-09) | `functions/test/reports.test.ts` |
| IT-TSK-05 | proof photos must match their declared type | `functions/test/reports.test.ts` |
| IT-TSK-06 | a reassigned (stale) task cannot be completed | `functions/test/reports.test.ts` |
| IT-TSK-07 | officials and residents cannot complete tasks | `functions/test/reports.test.ts` |
| IT-ESC-01 | the schedule escalates reports past their SLA once, and is idempotent | `functions/test/reports.test.ts` |
| IT-ESC-02 | manual escalation requires a reason; escalated reports can be assigned | `functions/test/reports.test.ts` |
| IT-ESC-03 | only admins can run maintenance | `functions/test/reports.test.ts` |
| IT-RES-01 | the reporter can confirm a resolved report (→ CLOSED) | `functions/test/reports.test.ts` |
| IT-RES-02 | the reporter can reopen with a reason (→ UNDER_REVIEW); officials notified | `functions/test/reports.test.ts` |
| IT-RES-03 | after 7 days confirm/reopen are refused and the schedule closes the report | `functions/test/reports.test.ts` |
| IT-RES-04 | another resident cannot confirm or reopen | `functions/test/reports.test.ts` |
| IT-RES-05 | confirming an unresolved report is refused | `functions/test/reports.test.ts` |
| IT-AFF-01 | a resident confirms an open issue: count, follower and timeline update once | `functions/test/reports.test.ts` |
| IT-AFF-02 | own reports, closed reports and staff are refused | `functions/test/reports.test.ts` |
| IT-CMT-01 | staff with access can comment; residents and other departments cannot | `functions/test/reports.test.ts` |

## End-to-end and non-functional (Playwright): 14 tests

| ID | Scenario | File |
|---|---|---|
| E2E-08 | first Google sign-in completes a resident profile (FR-29, BR-16) | `tests/e2e/account.spec.ts` |
| E2E-09 | password reset gives the same answer whether or not the account exists (FR-30) | `tests/e2e/account.spec.ts` |
| E2E-10 | profile change and POPIA self-deletion (FR-31, FR-32) | `tests/e2e/account.spec.ts` |
| E2E-01 | full lifecycle: resident → official → field worker → resident (SC-01, NFT-05) | `tests/e2e/lifecycle.spec.ts` |
| E2E-02 | a second resident reporting the same issue is linked as a duplicate (FR-05) | `tests/e2e/lifecycle.spec.ts` |
| E2E-03 | suburb-targeted alert reaches Galeshewe but not Roodepan (FR-16, FR-17, BR-14) | `tests/e2e/lifecycle.spec.ts` |
| E2E-04 | each role is denied other roles’ areas (NFR-01) | `tests/e2e/lifecycle.spec.ts` |
| E2E-05 | invalid report input is rejected with field messages (BR-02, NFR-03) | `tests/e2e/lifecycle.spec.ts` |
| E2E-06 | wrong password shows a generic error (FR-02) | `tests/e2e/lifecycle.spec.ts` |
| E2E-07 | GPS outside Sol Plaatje is explained, not used; tapping the map sets the pin and suburb (FR-03, BR-02) | `tests/e2e/lifecycle.spec.ts` |
| E2E-11 | "Me too" from the community map raises the affected count (FR-33, BR-23) | `tests/e2e/lifecycle.spec.ts` |
| NFT-07 | mobile layouts fit a 360 px screen | `tests/e2e/mobile.spec.ts` |
| NFT-08 | accessibility of login, report form, my reports and queue | `tests/e2e/quality.spec.ts` |
| NFT-06 | responsiveness: screens interactive < 3 s, p95 command < 2 s | `tests/e2e/quality.spec.ts` |

## Installable PWA (Playwright, production build): 1 tests

| ID | Scenario | File |
|---|---|---|
| NFT-10 | the production build is installable and opens offline (FR-34) | `tests/pwa/pwa.spec.ts` |
