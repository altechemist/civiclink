# Deploying CivicLink on free tiers (Vercel + Firebase Spark)

Architecture: ADR-0006. The static web app and the Node command API run on Vercel. Auth and Firestore run on Firebase's free Spark plan (project `civiclink-2ae84`, alias `prod` in `.firebaserc`). No payment card is needed.

## Status (20 Oct 2026)

| Step | State |
|---|---|
| Firebase project `civiclink-2ae84` | Created; CLI logged in |
| Web app "CivicLink Web" | Registered (`1:946087552522:web:3112c2fe40cc7b8388a1f3`); config in `apps/web/.env.production.local` (git-ignored) |
| Firestore | Database `(default)` exists, **location nam5 (US)**. It was created automatically by the first rules deploy, not in africa-south1; see the note below |
| Security Rules + indexes | Deployed (`npm run deploy:rules`) |
| Google sign-in | Enabled |
| Email/Password sign-in | Confirm it is enabled (console → Authentication → Sign-in method) |
| Service-account key | To generate (step 1.4) |
| Vercel | To log in, then run `scripts/vercel-setup.sh <key.json>` |

> **Firestore location.** The design specifies africa-south1 (latency to the Cape Town API region, and POPIA data residency). The current database is empty. To move it: console → Firestore → Databases → delete `(default)`, recreate it in **africa-south1**, then run `npm run deploy:rules`. Keeping nam5 works, but each command makes several US round trips (about 1–2 s slower).

## 1. Firebase console (once)

1. **Firestore:** Build → Firestore Database → *Create database* → production mode → location **africa-south1 (Johannesburg)**. The location cannot be changed later.
2. **Authentication:** Build → Authentication → *Get started* → Sign-in method → enable **Email/Password** and **Google** (choose a support email).
3. **Web app config:** Project settings → General → *Your apps* → add a **Web** app (no Hosting). Copy `apiKey`, `authDomain`, `projectId` and `appId`.
4. **Service-account key:** Project settings → Service accounts → *Generate new private key*. Treat the downloaded JSON as a password. Never commit it.
5. After the first Vercel deploy: Authentication → Settings → **Authorized domains** → add `<your-app>.vercel.app`, so Google sign-in works there.

## 2. Rules and indexes

```bash
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project prod
```

## 3. Vercel

**Scripted (recommended):** `npx vercel@62.4.0 login`, then `scripts/vercel-setup.sh path/to/key.json`. This links the project, sets every environment variable (the web config from `apps/web/.env.production.local`, a base64 service-account key and a generated `CRON_SECRET`), deploys, and sets the GitHub `CRON_SECRET` secret and `APP_URL` variable. Redeploy later with `npm run deploy:web`.

**Manual:**
1. Sign in at vercel.com with GitHub → *Add New Project* → import `altechemist/civiclink`. Framework preset: *Other*. Keep the root directory at the repository root, because `vercel.json` supplies the install, build and output settings.
2. Environment variables (Production):

| Name | Value |
|---|---|
| `VITE_USE_EMULATORS` | `false` |
| `VITE_API_BASE` | `/api` |
| `VITE_FIREBASE_PROJECT_ID` | `civiclink-2ae84` |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID` | from step 1.3 |
| `FIREBASE_SERVICE_ACCOUNT` | contents of the key JSON (or `base64 -w0 key.json`) |
| `CRON_SECRET` | a long random string (`openssl rand -hex 32`) |

3. Deploy. The API region is Cape Town (`cpt1`, in `vercel.json`).

## 4. Hourly schedule (GitHub)

Repository → Settings → Secrets and variables → Actions:
- Secret `CRON_SECRET`: the same value as in Vercel.
- Variable `APP_URL`: `https://<your-app>.vercel.app`.

The workflow `.github/workflows/cron.yml` then calls `/api/cron/maintenance` every hour. You can also run it manually with *Run workflow*.

## 5. Demo data

```bash
SEED_PASSWORD='<a private demo password>' FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" npm run seed:prod
```

The seed refuses to run if the project already has users. Give the lecturer the demo password privately; the published README password is for the local emulator only.

## 6. Smoke test

Sign in as each role, submit a report with a photo, assign it, complete it with proof, and broadcast an alert. Then check the Vercel function logs and the Admin → System log.
