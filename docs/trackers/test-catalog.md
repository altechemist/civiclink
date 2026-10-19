# Test Catalogue

Each test's ID appears in its test title (e.g. `it('IT-ASG-07 concurrent assigns: exactly one succeeds', …)`) so the report and code can be cross-checked with `grep -r "IT-ASG-07"`.
Report §7.2 uses the columns: Test ID · Requirement/Rule · Scenario · Type · Expected · Actual · Status.
*Actual* and *Status* are filled from the CI run used for the `v1.0.0` tag.

Types: S = success, V = validation, B = boundary, A = authorisation, F = failure / state conflict, C = concurrency.

## Shared domain (unit)

| ID | Ref | Scenario | Type | Expected |
|---|---|---|---|---|
| UT-SCH-01 | BR-02 | description 9 / 10 / 300 / 301 chars | B | 10 and 300 accepted, 9 and 301 rejected |
| UT-SCH-02 | BR-02 | 0, 3, 4 photos. 5 MB vs 5 MB + 1 byte. image/gif | B,V | ≤3 and ≤5 MB jpeg/png/webp only |
| UT-SCH-03 | BR-02 | location just inside / outside municipal bounding box | B | outside rejected |
| UT-RSM-01 | BR-05 | every allowed transition in srs §7 | S | allowed |
| UT-RSM-02 | BR-05 | every other (from, to) pair | F | rejected with `invalid-transition` |
| UT-TSM-01 | BR-08 | task order ASSIGNED→ACCEPTED→IN_PROGRESS→COMPLETED. Skip steps | S,F | skips rejected |
| UT-DUP-01..06 | BR-03 | 99 m / 100 m / 101 m. 71 h / 73 h. Different category. Parent RESOLVED | B | duplicate only for ≤100 m, ≤72 h, same category, open parent |
| UT-SLA-01..03 | BR-10 | created + slaHours − 1 min / + 1 min. Already escalated | B | escalate only after SLA and once |
| UT-REF-01 | BR-04 | format CL-2026-0001, CL-2026-9999, rollover to 5 digits | B | correct formatting |
| UT-SCH-ALR-01 | BR-13 | title 100/101, message 500/501, empty suburbs, expiry past / >30 days | B,V | boundaries enforced |
| UT-ANL-01 | FR-19 | metric functions on fixture, including empty input | S,B | expected values, no NaN |

## Security rules

| ID | Ref | Scenario | Type | Expected |
|---|---|---|---|---|
| RT-USR-01 | NFR-01 | user reads / updates own profile name/phone/suburb | S | allowed |
| RT-USR-02 | BR-16 | user writes own `role` / `isActive` / `departmentId` | A | denied |
| RT-USR-03 | NFR-11 | resident reads another user's profile | A | denied |
| RT-RPT-01 | BR-01 | any client creates / updates `reports` directly | A | denied (functions only) |
| RT-RPT-02 | FR-06 | resident reads own report and its history | S | allowed |
| RT-RPT-03 | BR-17 | resident reads another's report | A | denied |
| RT-RPT-04..06 | BR-20 | official reads own-dept / other-dept. Worker reads assigned / unassigned | A | per matrix |
| RT-PUB-01 | BR-17 | anyone signed in reads `publicReports`. Payload has no PII fields | S | allowed, no PII |
| RT-ALR-01..03 | BR-14 | resident reads alert for own suburb / other suburb. Official reads all | A | per matrix |
| RT-STO-01..04 | BR-02 | upload to own path ≤5 MB image / to another uid / 6 MB / pdf. Read another's photo | A,V | only valid own uploads. Staff read allowed |
| RT-CMT-01..02 | BR-18 | resident reads comments / staff reads | A | denied / allowed |

## Cloud Functions (integration, emulator)

| ID | Ref | Scenario | Type | Expected |
|---|---|---|---|---|
| IT-AUTH-01..03 | FR-01, BR-16 | registration creates RESIDENT claims and profile. Deactivated user calls a function | S,A | claims set. `permission-denied` |
| IT-RPT-01 | FR-03 | valid submit | S | report SUBMITTED, ref returned |
| IT-RPT-02..05 | BR-02 | invalid fields (each) | V | `invalid-argument` with field, nothing written |
| IT-RPT-06 | BR-01 | official / worker / unauthenticated submit | A | `permission-denied` / `unauthenticated` |
| IT-RPT-07 | FR-04 | default department from category, one history entry | S | correct |
| IT-RPT-08 | BR-04, NFR-10 | 20 concurrent submits | C | 20 unique sequential refs |
| IT-RPT-09 | FR-05 | submit near an open same-category report | S | DUPLICATE, parent count +1, parent ref returned |
| IT-TRI-01..05 | FR-09 | triage ok. Triage non-SUBMITTED. Reject without reason. Other dept. Inactive dept | S,F,V,A | per rules |
| IT-ASG-01..06 | FR-10, BR-06/07 | assign ok. Worker in other dept. Inactive worker. Report has active task. Report SUBMITTED. Resident caller | S,A,F | per rules |
| IT-ASG-07 | NFR-10 | two concurrent assigns | C | exactly one succeeds |
| IT-ASG-08..10 | FR-12 | reassign ok. Same worker. No active task | S,F | per rules |
| IT-TSK-01..07 | FR-11, BR-08/09 | accept/start/complete ok. Wrong worker. Skip step. Complete without notes / photo. Report no longer open | S,A,F,V | per rules |
| IT-TSK-08 | NFR-10 | completion is atomic (forced failure leaves task and report unchanged) | C | no partial write |
| IT-ESC-01..04 | FR-13 | schedule with fixed clock. Idempotent rerun. Manual with / without reason | S,F,V | per rules |
| IT-RES-01..05 | FR-14 | confirm. Reopen. Day 8 refused. Other resident. Auto-close | S,F,A | per rules |
| IT-NTF-01..03 | FR-15 | notifications created for each event and recipient | S | correct recipients |
| IT-ALR-01..05 | FR-16, BR-13 | broadcast ok + recipients = targeted active residents. Invalid. Resident caller | S,V,A | per rules |
| IT-ALR-06..07 | FR-18 | read counts. Deactivate | S | correct |
| IT-ANL-01 | FR-19, SC-05 | seeded dataset metrics | S | equal to fixture expectations |
| IT-ADM-01..07 | FR-20, BR-15/16 | create staff. Role change. Deactivate blocks. Self-demote. Self-deactivate. Non-admin. Duplicate email | S,A,F,V | per rules |
| IT-CFG-01..04 | FR-21, BR-19 | SLA bounds. Unique names. Deactivated category hidden. Non-admin | V,A | per rules |

## End-to-end (Playwright) and non-functional

| ID | Ref | Scenario | Expected |
|---|---|---|---|
| E2E-01 | SC-01 | full lifecycle across 3 browser contexts (resident, official, worker) | resident sees RESOLVED + full timeline |
| E2E-02 | FR-05 | second resident reports the same issue | duplicate message with parent ref |
| E2E-03 | FR-16/17 | official broadcasts a strike alert to Galeshewe | Galeshewe resident sees it, Roodepan resident doesn't |
| E2E-04 | NFR-01 | each role opens another role's routes | 403 page, no data shown |
| NFT-05 | NFR-05, SC-04 | time from submit to queue row, and from status change to resident timeline | < 5 s |
| NFT-06 | NFR-06 | Lighthouse TTI on key pages. p95 command latency over 50 runs | < 3 s / < 2 s |
| NFT-07 | NFR-07 | resident and worker flows at 360×640 | no horizontal scroll, ≤ 3 steps |
| NFT-08 | NFR-08 | Lighthouse accessibility | ≥ 90 |
| NFT-09 | NFR-09 | E2E-01..04 on firefox | pass |
| NFT-04 | NFR-04 | gitleaks on full history | 0 findings |
