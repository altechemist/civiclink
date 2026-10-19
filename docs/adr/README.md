# Architecture Decision Records

Report §5.3 uses ADR-0001, ADR-0002, ADR-0006 and ADR-0004 (the template asks for 2–4 decisions). ADR-0003 and ADR-0005 are supporting.

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

## ADR-0003: Firebase Emulator Suite for local development and tests (deployment superseded by ADR-0006)

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

## ADR-0006: Free-tier deployment: Firebase Spark + Node API on Vercel, photos stored in Firestore

- **Context:** A live deployment strengthens the demonstration, but Cloud Functions and Cloud Storage both require Firebase's Blaze (billing) plan, which needs a payment card. Supabase was considered but would mean rewriting the backend, Security Rules and about 90 tests close to the deadline.
- **Options:** (a) Blaze with a $1 budget alert; (b) port to Supabase (Postgres, RLS, Edge Functions); (c) stay on the free Spark plan (Auth, Firestore, Hosting), run the command API as a Node service on a free host, and store photos as binary Firestore documents.
- **Decision:** (c). The API runs as Vercel serverless functions (Hobby plan, region `cpt1` Cape Town) next to the static web app. Photos are compressed in the browser to ≤ 700 KB and stored in `photos/{id}` documents.
- **Rationale:** No cost and no card. The command logic was already transport-independent, so a second adapter (`functions/src/http.ts`) reuses `execute()` and every service unchanged. It speaks the Firebase callable protocol, so the client only switches from `httpsCallable` to `httpsCallableFromURL`. Vercel's free functions do not sleep, unlike Render's free tier, which matters for a live demo.
- **Consequences:**
  - Two adapters must stay equivalent. They share one command registry, and CI runs the whole E2E suite through both (`test:e2e` and `test:e2e:http`).
  - Photos are limited by Firestore's 1 MiB document size, so compression is mandatory and each photo view costs one document read. Real types are verified server-side from magic bytes.
  - Vercel's free cron runs daily, so the hourly SLA escalation is triggered by a GitHub Actions schedule calling a secret-protected endpoint.
  - A service-account key is stored as a Vercel secret (never committed).
  - Vercel Hobby is for non-commercial use, which fits an academic project. A municipal rollout would move to Blaze or a paid host with the same code.
