# Baseline Change Log

This log records every deliberate change from the Phase 1–3 documents to the Stage 4 baseline, and any later change during implementation. New changes are appended with the next CR number. A requirement, rule or diagram is never changed silently.

| CR | Date | Change | Reason | Affects |
|---|---|---|---|---|
| CR-01 | 2026-10-19 | Four actors everywhere (Resident, Official, Field Worker, Administrator) | Phase 1 and Phase 2 use case diagrams omitted the Administrator, but Phase 3 has admin screens | Use case diagram, FR-20/21, role matrix |
| CR-02 | 2026-10-19 | Report state machine fixed at 8 states (added REJECTED and DUPLICATE). Reopen goes RESOLVED→UNDER_REVIEW with the same reference | P1/P2/P3 used 3 and 6 states. P2 reopen went to SUBMITTED while P3 reopen created a new report. Keeping the reference preserves resident trust and history | srs §7, state diagram, BR-05, BR-11 |
| CR-03 | 2026-10-19 | Duplicates are stored (status DUPLICATE, `parentReportId`) and the parent gets `affectedCount` | P2 activity diagram ended the flow, losing evidence of how many people were affected | FR-05, BR-03, activity diagram |
| CR-04 | 2026-10-19 | Report 1 : 0..* Task with at most one active task. Task statuses ASSIGNED, ACCEPTED, IN_PROGRESS, COMPLETED, REASSIGNED, CANCELLED | P2 class diagram said 1:1 composition, P3 said 1:0..1 but described multiple tasks on reassignment | Class diagram, ERD, BR-06 |
| CR-05 | 2026-10-19 | Collection name `tasks` (not `Assignments`) | P2 and P3 disagreed | Architecture, ERD |
| CR-06 | 2026-10-19 | 8 configurable categories mapped to 5 departments. Severity retained | P1 had 5 groups, P3 had 8 categories | FR-03, FR-21 |
| CR-07 | 2026-10-19 | Map uses Leaflet + OpenStreetMap. Address = `suburb` (required list) + `landmark` (optional). No geocoding | Google Maps needs a billed API key and would be unavailable offline in the demo. Suburb is also the alert-targeting key | ADR-0004, data dictionary |
| CR-08 | 2026-10-19 | In-app real-time notifications (Firestore listeners) are Must. FCM web push is Could. Twilio SMS is Deferred | FCM and Twilio cannot be verified in the emulator. In-app notifications fully close the feedback loop | FR-15, FR-24, FR-25 |
| CR-09 | 2026-10-19 | NFRs rewritten to be verifiable (NFR-01–NFR-12). 99.5% uptime, 10k concurrent users and TLS 1.3 moved to excluded production targets | The originals cannot be tested in the assessment environment | srs §5, §3.3 |
| CR-10 | 2026-10-19 | Frontend is React + Vite + React Router SPA (not Next.js) | No server rendering needed. Static hosting fits Firebase. P3 routes were already React Router style | ADR-0002 |
| CR-11 | 2026-10-19 | P3 UI features given IDs and priorities: CSV export FR-26 (Could), scheduled alerts FR-28 (Deferred), bulk assign (Deferred), estimated reach (folded into FR-16 as recipient count), system health telemetry replaced by event log FR-23 (Could) | Every UI element must trace to a requirement | srs §4 |
| CR-12 | 2026-10-19 | Data model: StatusHistory → `reports/{id}/history`. Comments → `reports/{id}/comments`. AlertRecipients → `alerts/{id}/recipients/{uid}`. New `users/{uid}/notifications` and `counters`. SystemLogs → `systemLogs` | Subcollections keep ownership clear for Security Rules. Notifications were never modelled | ERD, data dictionary |
| CR-13 | 2026-10-19 | Officials are scoped to their own department (BR-20) | Not specified before. Needed for least privilege | Role matrix, rules |
