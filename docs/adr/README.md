# Architecture Decision Records

Report §5.3 uses ADR-0001 to ADR-0004 (the template asks for 2–4 decisions). ADR-0005 is supporting.

---

## ADR-0001: Firebase (Firestore + Cloud Functions) as the backend, with commands going through callable functions

- **Context:** The system needs real-time updates across four roles, authentication with roles, file storage, and multi-document integrity (TX-1 to TX-3). Phases 1–3 committed to Firebase.
- **Options:** (a) Firebase with direct client writes guarded only by Security Rules. (b) Firebase with all state-changing commands in callable Cloud Functions, and rules that only allow reads plus a few owner writes. (c) Node/Express + PostgreSQL + WebSockets.
- **Decision:** (b).
- **Rationale:** Rules alone cannot express transactional, multi-document business rules such as the reference counter, the duplicate radius query and one active task per report. Functions give one server-side place for validation and transactions, while Firestore listeners give real-time reads at no extra cost. (c) would mean rebuilding auth, realtime and storage, and departs from three phases of design.
- **Consequences:** Clear command/query separation. Domain logic is testable in isolation. Firestore NoSQL means no foreign-key constraints, so integrity is enforced in transactions and rules (documented in §5.6). Deploying functions to the cloud needs the Blaze plan (see ADR-0003).

## ADR-0002: React + Vite + React Router SPA in TypeScript

- **Context:** Four role-specific UIs, mobile-first for residents and workers, desktop for officials.
- **Options:** Next.js (App Router), React + Vite SPA, Flutter.
- **Decision:** React 18 + Vite + React Router + Tailwind CSS.
- **Rationale:** All data access is client-side through the Firebase SDK, so SSR adds complexity for no benefit. A static SPA deploys straight to Firebase Hosting. The Phase 3 routes already use React Router conventions.
- **Consequences:** A single codebase with role-guarded route trees. SEO is irrelevant (it's an authenticated app).

## ADR-0003: The assessed runtime is the Firebase Emulator Suite, with cloud deployment optional

- **Context:** Cloud Functions and new Storage buckets need the Blaze (billing) plan. The demo must be reliable and reproducible by the lecturer.
- **Options:** Live Firebase project only, emulator only, or emulator as the primary runtime with an optional live deployment.
- **Decision:** The emulator is primary (`npm run dev` starts emulators, seeds data and starts the web app). Optionally, deploy to a Blaze project with a budget alert if time allows.
- **Rationale:** Zero cost and no network dependency during the demo. Identical behaviour for tests in CI. Fully reproducible from the README.
- **Consequences:** Report §8 documents both paths. FCM push cannot be shown in the emulator (FR-24 stays Could).

## ADR-0004: Leaflet + OpenStreetMap instead of Google Maps

- **Context:** Residents pick an incident location, and officials and workers view it.
- **Options:** Google Maps JS API + Geocoding, Mapbox, or Leaflet + OSM tiles.
- **Decision:** Leaflet (react-leaflet) with OSM tiles. Location comes from browser geolocation and is adjustable by dragging the pin. Suburb is chosen from a list.
- **Rationale:** No API key or billing. Open data. Suburb is needed for alert targeting anyway.
- **Consequences:** No reverse geocoding (addresses are suburb + landmark). Must follow the OSM tile usage policy (attribution, low volume), which suits a demo. Field workers get an "open in maps" link.

## ADR-0005: Shared domain package used by both client and functions

- **Context:** Validation and the state machine are needed client-side for UX and server-side for enforcement.
- **Decision:** `packages/shared` holds the zod schemas, enums, `ReportStateMachine`, `TaskStateMachine`, `DuplicatePolicy` and `SlaPolicy`. Functions are bundled with esbuild so the shared code is inlined for deployment.
- **Consequences:** One source of truth that is unit tested once (NFR-12). The client and server can't drift.
