Run 2026-10-20 09:15 UTC on commit `0f52054`: **173 of 173 passed**.

Table: Complete automated test results

| Test ID | Scenario | Suite | Result |
|---|---|---|---|
| UT-RSM-01 | every allowed transition succeeds for its allowed actors | Unit | Pass |
| UT-RSM-02 | every other (status, event) pair is rejected | Unit | Pass |
| UT-RSM-03 | terminal statuses allow no events and actors are enforced | Unit | Pass |
| UT-TSM-01 | tasks move in order; skipping steps is rejected (BR-08) | Unit | Pass |
| UT-DUP-01 | distance boundary 99 m / 100 m / 101 m | Unit | Pass |
| UT-DUP-02 | time window 71 h / 73 h | Unit | Pass |
| UT-DUP-03 | different category is not a duplicate | Unit | Pass |
| UT-DUP-04 | parent must be open | Unit | Pass |
| UT-DUP-05 | picks the closest candidate, oldest on a tie | Unit | Pass |
| UT-DUP-06 | haversine distance sanity check (Kimberley CBD → Galeshewe ≈ 3.4 km) | Unit | Pass |
| UT-SLA-01 | breach only after slaHours | Unit | Pass |
| UT-SLA-02 | never re-escalates and ignores closed work | Unit | Pass |
| UT-RES-01 | 7-day window and auto-close | Unit | Pass |
| UT-REF-01 | reference format and padding (BR-04) | Unit | Pass |
| UT-PRV-01 | public location is rounded to ~110 m (BR-17) | Unit | Pass |
| UT-ANL-01 | metrics on a fixture | Unit | Pass |
| UT-ANL-02 | empty input yields nulls, not NaN | Unit | Pass |
| UT-CSV-01 | CSV quoting | Unit | Pass |
| UT-LOC-01 | municipal bounds and nearest suburb | Unit | Pass |
| UT-ALS-01 | publish time must be 10 min to 30 days ahead and before expiry | Unit | Pass |
| UT-ALS-02 | publishAt is optional in the broadcast schema | Unit | Pass |
| UT-OFF-01 | clientId is optional and limited to a safe id format | Unit | Pass |
| UT-BLK-01 | one to 20 reports per batch | Unit | Pass |
| UT-RAT-01 | ratings are whole stars from 1 to 5, with optional short feedback | Unit | Pass |
| UT-RAT-02 | average to one decimal; no ratings gives null; invalid values ignored | Unit | Pass |
| UT-PUB-01 | open reports per suburb exclude closed, rejected and duplicate reports | Unit | Pass |
| UT-SMS-01 | South African numbers convert to E.164 | Unit | Pass |
| UT-SMS-02 | SMS text fits one 160-character segment | Unit | Pass |
| UT-SMS-03 | opting in to SMS requires a mobile number | Unit | Pass |
| UT-SCH-01 | description boundaries 9/10/300/301 | Unit | Pass |
| UT-SCH-02 | photo count 0/3/4 and file size and type | Unit | Pass |
| UT-SCH-03 | location inside / outside municipal bounding box | Unit | Pass |
| UT-SCH-04 | rejects unknown suburb and severity with field errors | Unit | Pass |
| UT-SCH-05 | password minimum, optional SA phone, no role field accepted | Unit | Pass |
| UT-SCH-06 | completion requires notes ≥10 and 1–3 proof photos (BR-09) | Unit | Pass |
| UT-SCH-ALR-01 | title/message boundaries and target suburbs (BR-13) | Unit | Pass |
| UT-SCH-ALR-02 | expiry must be future and within 30 days | Unit | Pass |
| UT-SCH-07 | staff users need a department unless admin | Unit | Pass |
| UT-SCH-08 | department SLA hours 1–720 whole numbers | Unit | Pass |
| UT-SCH-09 | real type is detected from magic bytes | Unit | Pass |
| RT-USR-01 | a user reads their own profile and may only stamp lastLoginAt | Security rules | Pass |
| RT-USR-02 | users cannot change their own role, department or active flag (BR-16) | Security rules | Pass |
| RT-USR-03 | residents cannot read other users; staff read the staff directory only | Security rules | Pass |
| RT-USR-04 | notifications are private; only readAt can be set | Security rules | Pass |
| RT-USR-05 | deactivated or anonymous users read nothing | Security rules | Pass |
| RT-RPT-01 | no client can create or modify reports or history (functions only) | Security rules | Pass |
| RT-RPT-02 | the reporter and duplicate followers read the report and its history | Security rules | Pass |
| RT-RPT-03 | residents cannot read others' reports or list all reports (BR-17) | Security rules | Pass |
| RT-RPT-04 | officials read only their department (BR-20) | Security rules | Pass |
| RT-RPT-05 | workers read only reports assigned to them | Security rules | Pass |
| RT-RPT-06 | admins read every report | Security rules | Pass |
| RT-CMT-01 | internal comments are hidden from residents (BR-18) | Security rules | Pass |
| RT-PUB-01 | the public projection is readable by residents, officials and admins only | Security rules | Pass |
| RT-TSK-01 | workers read own tasks; officials read their department; others denied | Security rules | Pass |
| RT-ALR-01 | signed-in users read alerts; nobody writes them directly | Security rules | Pass |
| RT-ALR-02 | residents read only their own delivery record; officials read all | Security rules | Pass |
| RT-CFG-01 | configuration is readable, never client-writable; counters and logs locked | Security rules | Pass |
| RT-ALS-01 | scheduled alerts are visible to staff only until published; nobody writes them directly (FR-28) | Security rules | Pass |
| RT-SMS-01 | SMS records (phone numbers) are readable by administrators only (FR-25, NFR-11) | Security rules | Pass |
| RT-PHO-01 | report photos and proof are visible to the reporter, followers and staff with access (BR-17) | Security rules | Pass |
| RT-PHO-02 | other users cannot read photos, and nobody writes them directly | Security rules | Pass |
| IT-AUTH-04 | completeProfile creates a RESIDENT profile and claims once | Integration | Pass |
| IT-AUTH-05 | existing accounts and anonymous callers cannot use completeProfile | Integration | Pass |
| IT-PRF-01 | residents change suburb and phone; claims follow; invalid phone refused | Integration | Pass |
| IT-PRF-02 | staff may change name and phone but have no home suburb | Integration | Pass |
| IT-DEL-01 | deletion anonymises reports and removes photos, profile, receipts and the Auth account | Integration | Pass |
| IT-DEL-02 | staff cannot self-delete; anonymised reports still progress without notifying anyone | Integration | Pass |
| IT-RPT-11 | submissions beyond the hourly limit are refused | Integration | Pass |
| IT-CFG-05 | settings are admin-only and bounded | Integration | Pass |
| IT-AUTH-01 | self-registration creates a RESIDENT with claims and a profile | Integration | Pass |
| IT-AUTH-02 | duplicate email and weak password are refused | Integration | Pass |
| IT-AUTH-03 | a deactivated account is refused by every command | Integration | Pass |
| IT-ALR-01 | broadcast creates one recipient per active resident in the target suburbs | Integration | Pass |
| IT-ALR-02 | ALL targets every active resident | Integration | Pass |
| IT-ALR-03 | validation: long title, empty targets, past or far expiry | Integration | Pass |
| IT-ALR-04 | residents and field workers cannot broadcast | Integration | Pass |
| IT-ALR-05 | mark-as-read counts once per resident | Integration | Pass |
| IT-ALR-06 | deactivation hides the alert | Integration | Pass |
| IT-ADM-01 | admin creates a staff account with claims | Integration | Pass |
| IT-ADM-02 | staff accounts need an active department | Integration | Pass |
| IT-ADM-03 | role change updates the profile and claims | Integration | Pass |
| IT-ADM-04 | an admin cannot demote or deactivate themselves (BR-15) | Integration | Pass |
| IT-ADM-05 | non-admins cannot manage users | Integration | Pass |
| IT-ADM-06 | reactivation restores access | Integration | Pass |
| IT-ADM-07 | admin actions are written to the system log (FR-23) | Integration | Pass |
| IT-CFG-01 | SLA hours must be 1–720 | Integration | Pass |
| IT-CFG-02 | names are unique (case-insensitive) | Integration | Pass |
| IT-CFG-03 | categories link to an existing department and can be deactivated | Integration | Pass |
| IT-CFG-04 | non-admins cannot change configuration | Integration | Pass |
| IT-ANL-01 | metrics reflect live data and are restricted to officials and admins | Integration | Pass |
| IT-OFF-01 | a report re-sent with the same clientId is stored once and returns the same reference | Integration | Pass |
| IT-OFF-02 | another resident cannot reuse a clientId to read someone else’s report; malformed ids are refused | Integration | Pass |
| IT-SCH-01 | a scheduled alert is invisible until due, then published once with the same id | Integration | Pass |
| IT-SCH-02 | invalid times are refused; a cancelled alert is never published | Integration | Pass |
| IT-BLK-01 | assigns every eligible report and reports the rest without blocking them | Integration | Pass |
| IT-BLK-02 | other departments, residents and oversized batches are refused | Integration | Pass |
| IT-RAT-01 | the reporter rates the fix when confirming; out-of-range ratings are refused | Integration | Pass |
| IT-PUB-01 | anyone can GET anonymous figures, with CDN cache headers | Integration | Pass |
| IT-PUB-02 | the figures are only readable, not writable | Integration | Pass |
| IT-SMS-01 | emergency alerts are queued by SMS for opted-in residents only; other types are not | Integration | Pass |
| IT-SMS-02 | a gateway failure is recorded per message and logged, and does not fail the alert | Integration | Pass |
| IT-SMS-03 | removing the number ends the opt-in; deleting the account deletes the SMS records | Integration | Pass |
| IT-HTTP-01 | a resident submits a report through the HTTP API | Integration | Pass |
| IT-HTTP-02 | authentication, roles and validation behave exactly as with Cloud Functions | Integration | Pass |
| IT-HTTP-03 | unknown commands and wrong methods are refused | Integration | Pass |
| IT-HTTP-04 | the cron endpoint requires the secret | Integration | Pass |
| IT-PSH-01 | devices register and unregister; tokens are stored server-side only; anonymous refused | Integration | Pass |
| IT-PSH-02 | a committed status change pushes once to the reporter; a refused command pushes nothing | Integration | Pass |
| IT-PSH-03 | suburb alerts are pushed to targeted residents and dead tokens are pruned | Integration | Pass |
| IT-RPT-01 | valid submission creates a SUBMITTED report with a reference | Integration | Pass |
| IT-RPT-02 | invalid fields are rejected with field errors and nothing is written | Integration | Pass |
| IT-RPT-03 | location outside the municipality is rejected (BR-02) | Integration | Pass |
| IT-RPT-04 | photos must really be images of the declared type and within the size limit | Integration | Pass |
| IT-RPT-05 | inactive category is refused (BR-19) | Integration | Pass |
| IT-RPT-06 | only residents may submit (BR-01) | Integration | Pass |
| IT-RPT-07 | default department from category, one history entry, officials notified | Integration | Pass |
| IT-RPT-08 | concurrent submissions get unique sequential references (BR-04, NFR-10) | Integration | Pass |
| IT-RPT-09 | a nearby open report of the same category is linked as a duplicate (BR-03) | Integration | Pass |
| IT-RPT-10 | optional fields sent as undefined/null by the web client are accepted (DEF-02) | Integration | Pass |
| IT-TRI-01 | triage moves SUBMITTED → UNDER_REVIEW and records history | Integration | Pass |
| IT-TRI-02 | triage from a non-SUBMITTED status is refused | Integration | Pass |
| IT-TRI-03 | reject needs a reason ≥ 10 characters (BR-12) | Integration | Pass |
| IT-TRI-04 | officials cannot act on another department's report (BR-20) | Integration | Pass |
| IT-TRI-05 | rerouting to an inactive department is refused; active reroute works | Integration | Pass |
| IT-ASG-01 | assignment creates a task, moves the report to IN_PROGRESS and notifies | Integration | Pass |
| IT-ASG-02 | a worker from another department is refused (BR-07) | Integration | Pass |
| IT-ASG-03 | an inactive worker is refused (BR-07) | Integration | Pass |
| IT-ASG-04 | a report with an active task cannot be assigned again (BR-06) | Integration | Pass |
| IT-ASG-05 | a SUBMITTED (untriaged) report cannot be assigned | Integration | Pass |
| IT-ASG-06 | residents and workers cannot assign | Integration | Pass |
| IT-ASG-07 | two concurrent assignments: exactly one succeeds (NFR-10) | Integration | Pass |
| IT-ASG-08 | reassignment ends the old task and creates a new one | Integration | Pass |
| IT-ASG-09 | reassigning to the same worker is refused | Integration | Pass |
| IT-ASG-10 | reassigning without an active task is refused | Integration | Pass |
| IT-TSK-01 | accept → start → complete resolves the report and notifies the resident | Integration | Pass |
| IT-TSK-02 | another worker cannot act on the task (BR-08) | Integration | Pass |
| IT-TSK-03 | steps cannot be skipped (BR-08) | Integration | Pass |
| IT-TSK-04 | completion without notes or proof is refused (BR-09) | Integration | Pass |
| IT-TSK-05 | proof photos must match their declared type | Integration | Pass |
| IT-TSK-06 | a reassigned (stale) task cannot be completed | Integration | Pass |
| IT-TSK-07 | officials and residents cannot complete tasks | Integration | Pass |
| IT-ESC-01 | the schedule escalates reports past their SLA once, and is idempotent | Integration | Pass |
| IT-ESC-02 | manual escalation requires a reason; escalated reports can be assigned | Integration | Pass |
| IT-ESC-03 | only admins can run maintenance | Integration | Pass |
| IT-RES-01 | the reporter can confirm a resolved report (→ CLOSED) | Integration | Pass |
| IT-RES-02 | the reporter can reopen with a reason (→ UNDER_REVIEW); officials notified | Integration | Pass |
| IT-RES-03 | after 7 days confirm/reopen are refused and the schedule closes the report | Integration | Pass |
| IT-RES-04 | another resident cannot confirm or reopen | Integration | Pass |
| IT-RES-05 | confirming an unresolved report is refused | Integration | Pass |
| IT-AFF-01 | a resident confirms an open issue: count, follower and timeline update once | Integration | Pass |
| IT-AFF-02 | own reports, closed reports and staff are refused | Integration | Pass |
| IT-CMT-01 | staff with access can comment; residents and other departments cannot | Integration | Pass |
| E2E-08 | first Google sign-in completes a resident profile (FR-29, BR-16) | E2E (chromium) | Pass |
| E2E-09 | password reset gives the same answer whether or not the account exists (FR-30) | E2E (chromium) | Pass |
| E2E-10 | profile change and POPIA self-deletion (FR-31, FR-32) | E2E (chromium) | Pass |
| E2E-01 | full lifecycle: resident → official → field worker → resident (SC-01, NFT-05) | E2E (chromium) | Pass |
| E2E-02 | a second resident reporting the same issue is linked as a duplicate (FR-05) | E2E (chromium) | Pass |
| E2E-03 | suburb-targeted alert reaches Galeshewe but not Roodepan (FR-16, FR-17, BR-14) | E2E (chromium) | Pass |
| E2E-04 | each role is denied other roles’ areas (NFR-01) | E2E (chromium) | Pass |
| E2E-05 | invalid report input is rejected with field messages (BR-02, NFR-03) | E2E (chromium) | Pass |
| E2E-06 | wrong password shows a generic error (FR-02) | E2E (chromium) | Pass |
| E2E-07 | GPS outside Sol Plaatje is explained, not used; tapping the map sets the pin and suburb (FR-03, BR-02) | E2E (chromium) | Pass |
| E2E-11 | "Me too" from the community map raises the affected count (FR-33, BR-23) | E2E (chromium) | Pass |
| NFT-08 | accessibility of login, report form, my reports and queue | E2E (chromium) | Pass |
| NFT-06 | responsiveness: screens interactive < 3 s, p95 command < 2 s | E2E (chromium) | Pass |
| E2E-12 | a report made offline is saved on the phone and sent automatically on reconnect (FR-27) | E2E (chromium) | Pass |
| E2E-13 | an official schedules an alert for later and cancels it (FR-28) | E2E (chromium) | Pass |
| E2E-14 | an official assigns several reports to one field worker at once (FR-35) | E2E (chromium) | Pass |
| E2E-15 | the public transparency page works without signing in (FR-36) | E2E (chromium) | Pass |
| NFT-07 | mobile layouts fit a 360 px screen | E2E (mobile-360) | Pass |
| NFT-10 | the production build is installable and opens offline (FR-34) | PWA () | Pass |
| NFT-11 | CDN caching: immutable assets, cached public figures, uncached app shell (NFR-13) | Deployed site (chromium) | Pass |
| NFT-12 | security headers: CSP, HSTS, no framing, no sniffing (NFR-14) | Deployed site (chromium) | Pass |
