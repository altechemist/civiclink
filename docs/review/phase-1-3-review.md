# CivicLink: Review of Phases 1–3 against the Final Rubric and Report Template

Reviewed: 19 October 2026
Inputs: `CivicLink_Phase1_v2.pdf`, `CivicLink_Phase2.pdf`, `CivicLink_Phase3.pdf`, `FINAL PROJECT RUBRIC.pdf`, `NPRJ740_Final_Project_Report_Template.docx`, lecturer feedback slides ("Building One Coherent System").

## 1. Overall verdict

The project idea is strong, grounded in a real context (Sol Plaatje Municipality, the 31 March 2026 strike) and has a large, well-designed UI and a detailed data dictionary. The weaknesses are the same ones the lecturer called out for the whole cohort:

1. **No golden thread.** Phase 1 and 2 requirements are unnumbered bullets. Phase 3 cites "FR1–FR9" and "NFR 1–8", which were never defined. Nothing links requirements to business rules, tests or code.
2. **The scope is uncontrolled and part of it is untestable.** It includes 99.5% uptime, 10,000 concurrent users, TLS 1.3, offline sync, Twilio SMS, FCM, Google Maps, CSV export, bulk assign, scheduled alerts and system telemetry. Phase 3 had already marked most of the backend as "Prototype" or "Future target". Rubric D2-1 says that *Included-but-stubbed functionality reduces the mark*.
3. **The models disagree with each other** on actors, statuses, task model, categories and collection names (see §3).
4. **Design is happy-path only.** There is one activity diagram and one sequence diagram, neither has alternative or failure flows, there are no business rules, no transaction or integrity rules, no security design and no deployment design.
5. **No success criteria, acceptance criteria or test evidence.** The rubric gives 6 marks for requirements, 6 for testing documentation and 7 for testing in the implementation, and all of these depend on them.

None of this is fatal. Everything has been fixed in the consolidated baseline (`docs/baseline/`). That baseline now controls the project. Phases 1–3 remain the academic record.

## 2. Rubric-by-rubric assessment

Legend: ✅ adequate · ⚠️ partial · ❌ missing · *Fix* = where it is resolved.

### Deliverable 1: Final Project Documentation (40)

| # | Criterion (marks) | Current state in Phases 1–3 | Risk | Fix |
|---|---|---|---|---|
| 1 | Context, problem, purpose, success criteria (3) | ✅ Context and problem are vivid and local. ⚠️ The evidence is a *mock* interview. ❌ No success criteria. ⚠️ Population "≈250,000" is uncited. | Medium | Add 3–4 cited published sources (municipal IDP, AGSA MFMA report, Stats SA census, news on the strike and water outages). Keep the interview but label it honestly. Use SC-01–SC-05 in `baseline/srs.md` |
| 2 | Solution overview and final scope (3) | ⚠️ The context diagram shows Firebase as an *external* entity, which is the exact anti-pattern on the feedback slide. ❌ No Included / Excluded / Deferred / Known-limitations split. | Medium | New context diagram with Firestore inside the boundary, plus the scope tables in `srs.md` §3 |
| 3 | SRS (6) | ❌ No IDs, no MoSCoW, no release status. ❌ No business rules. ❌ No acceptance criteria. ⚠️ The NFRs are unverifiable (99.5% uptime, 10k users). | **High** | FR-01–FR-28, NFR-01–NFR-12, BR-01–BR-20 and AC per included FR, all in `srs.md` |
| 4 | System design (12) | ⚠️ Use case diagram has 3 actors (no Admin). ⚠️ 1 activity + 1 sequence diagram, both happy path (≥2 workflows needed, each with both diagrams). ✅ State diagram models a real entity, but reopen is inconsistent with Phase 3. ⚠️ "Three-box" architecture with Twilio in the data layer. ❌ Class diagram has entities only: no services, Admin, Department, Category, StatusHistory. ✅ Screens are good but ❌ have no error, empty or permission-denied states. ⚠️ Data dictionary is good but has no schema diagram. ❌ No role matrix or security controls. ❌ No deployment diagram. | **High (12 marks)** | All diagrams redrawn as PlantUML from the code (`docs/diagrams/`). Design decisions in `docs/adr/` |
| 5 | Implementation docs (4) | ❌ Nothing yet (expected) | — | Written from the repo in week 2 |
| 6 | Verification and testing (6) | ❌ Nothing. The Phase 2 UAT is planned but has no test cases. | **High** | Test catalogue `docs/trackers/test-catalog.md` with IDs that map to automated tests |
| 7 | Setup and evaluation (3) | ❌ | Low (easy marks) | README quick start, verified on a clean clone. SC evaluation table |
| 8 | Communication, consistency, referencing (3) | ⚠️ System name is stable (good). ⚠️ Terminology drifts. ❌ Almost no references, and none in APA. ⚠️ The supervisor name differs (Dr Tuyikeze vs Dr Verkijika on the template). | Medium | Glossary and status enums are fixed in `srs.md`. Use the template cover page as given |

### Deliverable 2: System Implementation (50)

There is no code yet, so the risk is all in scope control. The plan (`docs/plan/implementation-plan.md`) is built around these points:

- **Functional (12):** every FR marked *Included* must be real end-to-end on Firebase. Anything not done by the code freeze (30 Oct) is moved to *Known limitations* (§3.4 of the report), **not** quietly relabelled *Deferred*. The template forbids that.
- **Code quality (9) and architecture (7):** shared domain package (state machine, rules, schemas) → callable Cloud Functions (commands) → Firestore. Thin React UI. The architecture diagram mirrors the folder structure.
- **Data (5):** Firestore transactions for the critical operations (submit with reference number and duplicate check, assign, complete), append-only history, and Security Rules that match the data dictionary.
- **Security (5):** custom-claims RBAC enforced in rules *and* functions, zod validation server-side, Storage rules for photo uploads, no secrets in the repo.
- **Testing (7):** unit, rules, function-integration and Playwright E2E, run in CI against the emulators. Test IDs match the report.
- **Repo (5):** tagged `v1.0.0`, README, `.env.example`, seed script, CHANGELOG, tests present.

### Deliverable 3: Presentation (10)

4 of the 10 marks are for **lecturer-selected functionality including validation, access-control, boundary and failure conditions**. Every included FR and BR needs a 30-second demo path. The demo script in the plan covers this.

## 3. Cross-phase inconsistencies (each resolved by a change request)

| # | Inconsistency | Where | Resolution (CR in `baseline/change-log.md`) |
|---|---|---|---|
| 1 | Phase 1 says "four primary actors" then lists three. The Phase 2 use case has no Admin. Phase 3 has Admin screens. | P1 §2.5, P2 §2.3, P3 §3.17 | CR-01: four actors (Resident, Official, Field Worker, Administrator) everywhere |
| 2 | Report statuses: P1 has 3, P2 has 6, P3 enum has 6. Reopen goes back to SUBMITTED (P2) or creates a *new linked report* (P3). | P1 §2.4, P2 §2.5, P3 §3.6 | CR-02: one state machine with 8 states incl. DUPLICATE and REJECTED. Reopen goes RESOLVED→UNDER_REVIEW and keeps the same reference |
| 3 | Duplicates: P2 activity says the flow *terminates*. P3 stores `isDuplicate` and `parentReportId`. | P2 §2.4, P3 §4.2 | CR-03: duplicate is stored with status DUPLICATE, linked to the parent. Parent `affectedCount++`. Resident follows the parent |
| 4 | Task: "1 Report generates 1 Task" (composition) vs "one task per assignment event, REASSIGNED" and 1:0..1 | P2 §2.6, P3 §4.4, P3 §5 | CR-04: Report 1 : 0..* Task, at most one *active* (BR-06) |
| 5 | Task statuses: Accepted→In Progress→Completed vs ASSIGNED/ACCEPTED/IN_PROGRESS/COMPLETED/REASSIGNED | P2 §1.2, P3 §4.4 | CR-04: use the P3 set |
| 6 | Collections: "Assignments" (P2) vs "Tasks" (P3) | P2 §2.2 | CR-05: `tasks` |
| 7 | Categories: 5 groups (P1) vs 8 categories (P3). Severity only appears in P3. | P1 §2.4, P3 §3.3 | CR-06: the 8 P3 categories, configurable, each mapped to a department. Severity kept |
| 8 | Map: Google Maps + Geocoding (P1–P3) | — | CR-07 / ADR-0004: Leaflet + OpenStreetMap, resident picks a pin and a suburb. No billing key needed |
| 9 | Push: FCM + Twilio SMS described as delivered | P2, P3 §3.12 | CR-08: in-app real-time notifications are Included. FCM push is Could. SMS is Deferred |
| 10 | NFRs: 99.5% uptime, 10k concurrent, TLS 1.3 | P1, P2 §1.1 | CR-09: rewritten as verifiable NFRs for the demo environment. The originals are listed as excluded production targets |
| 11 | Frontend: "React/Next.js" (P1, P2) but P3 routes use React Router (`/:id`) | P3 §2 | CR-10 / ADR-0002: React + Vite + React Router SPA |
| 12 | P3 UI features with no requirement: bulk assign, CSV export, scheduled alerts, estimated reach, system health telemetry | P3 §3.9, 3.12, 3.19 | CR-11: each one given an FR with MoSCoW. Non-MVP items are Deferred |
| 13 | New entities with no design trail: StatusHistory, SystemLogs (P3 only). Notifications not modelled anywhere. | P3 §4.9–4.10 | CR-12: added to the class diagram and ERD, with Notifications as a subcollection |
| 14 | Address "derived via Google Geocoding API" | P3 §4.2 | CR-07: `suburb` (required, from a list) and `landmark` (optional free text) |
| 15 | Supervisor named Dr Tite Tuyikeze; final template names Dr Silas Verkijika | All covers | Use the template cover exactly |

## 4. Lecturer self-evaluation matrix (as at today, and after the baseline)

| Diagnostic question | Phases 1–3 | After baseline |
|---|---|---|
| Is my MVP realistic and supported by evidence? | Partially (scope too large) | Yes: Must set = core lifecycle + alerts + RBAC |
| Does every requirement have a permanent ID and testable outcome? | No | Yes: FR/NFR/BR IDs and AC |
| Do diagrams use consistent names and map to architecture? | Partially | Will do: generated from PlantUML sources next to the code |
| Do state diagrams model actual entity lifecycles? | Yes (Report) | Yes: Report and Task |
| Do tables match the domain model? | Partially | Yes: one schema in `packages/shared` used by both functions and rules tests |
| Correct cardinalities and constraints defined? | Partially | Yes: ERD + rules + transactions |
| Empty, error and permission-denied states designed? | No | Planned per screen (screen inventory in the traceability matrix) |
| Does every screen support an approved requirement? | Partially | Yes: screen → FR column in the matrix |
| Two critical transactions with integrity rules? | No | Yes: TX-1 submit, TX-2 assign, TX-3 complete (`srs.md` §6) |
| AI feature justified? | n/a | No AI is claimed. "Community intelligence" = analytics and duplicate detection. Template §6.4 is marked *Not applicable* |

## 5. What to keep from the phases

- The local narrative (31 March 2026 strike, burst pipes, verbal dispatch) goes into Executive Summary and §2.
- The Phase 1 interview questionnaire becomes evidence in the Problem Statement, cited as a stakeholder consultation (labelled as simulated).
- The Phase 3 data dictionary is the base for §5.6, updated per the CRs.
- Phase 3 screen designs are the UI target. The real screenshots replace them in §5.5.
- The Phase 2 state diagram is the base for the Report lifecycle (extended).
