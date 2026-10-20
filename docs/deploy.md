# Deploying CivicLink on free tiers (Vercel + Firebase Spark)

Architecture: ADR-0006. The static web app and the Node command API run on Vercel. Auth and Firestore run on Firebase's free Spark plan (project `civiclink-2ae84`, alias `prod` in `.firebaserc`). No payment card is needed.

## Status (20 Oct 2026): live at https://civiclink-five.vercel.app

| Step | State |
|---|---|
| Firebase project `civiclink-2ae84` (Spark) | Ready |
| Firestore `(default)` | **africa-south1**, free tier; rules and indexes deployed (`npm run deploy:rules`) |
| Web app "CivicLink Web" | Registered; config in `apps/web/.env.production.local` (git-ignored) and in Vercel |
| Authentication | Email/Password and Google enabled; `civiclink-five.vercel.app` authorised |
| Vercel project `karadevs-projects/civiclink` | Production alias `civiclink-five.vercel.app`; API in `cpt1`; env vars set (secrets marked sensitive) |
| GitHub schedule | `CRON_SECRET` secret and `APP_URL` variable set; manual run succeeded |
| Demo data | Seeded (150 reports, 15 accounts). The demo password is private: give it to the lecturer separately |
| Production verification | E2E-01, E2E-02, E2E-04, E2E-06, E2E-07, NFT-06 (page loads), NFT-08 pass against the live URL |

**Notes from the first deployment:**
- `firebase-admin` 14 depends on `jwks-rsa` 4, whose `jose` 6 is ESM-only. Vercel's Node loader cannot `require()` it, so `package.json` overrides `jwks-rsa` to 3.2.2 (same API, CommonJS `jose` 4).
- The Firestore **emulator does not enforce composite indexes**. A missing index (reports by `reporterId` + `createdAt` ascending) only showed up in production. After changing any query, deploy the indexes and run the E2E suite against the live URL:
  `E2E_BASE_URL=https://civiclink-five.vercel.app E2E_PASSWORD=<demo password> npx playwright test -g "E2E-01|E2E-02|E2E-07" --project chromium`
- A rules deploy on a project without a database creates one in **nam5**. Always create the database explicitly first: `npx firebase firestore:databases:create "(default)" --location africa-south1 --project prod`.

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
| `VITE_FIREBASE_VAPID_KEY` | Web Push public key (Firebase console → Project settings → Cloud Messaging → Web Push certificates); not secret |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | optional, sensitive: real SMS for emergency alerts (FR-25). Without them SMS are recorded as SIMULATED |

3. Deploy. The API region is Cape Town (`cpt1`, in `vercel.json`).

## 4. Hourly schedule (GitHub)

Repository → Settings → Secrets and variables → Actions:
- Secret `CRON_SECRET`: the same value as in Vercel.
- Variable `APP_URL`: `https://<your-app>.vercel.app`.

The workflow `.github/workflows/cron.yml` then calls `/api/cron/maintenance` every hour. You can also run it manually with *Run workflow*.

## 4a. SMS with Twilio (optional, FR-25)

1. Create a Twilio account (a free trial works). From the Console home copy the **Account SID** and **Auth Token**.
2. Get a sender: buy/claim a Twilio phone number (trial accounts get one free) and use it in E.164 form, e.g. `+15005550006`.
3. Trial accounts can only send to **verified** numbers: Console → Phone Numbers → Verified Caller IDs → add your phone. Trial messages start with "Sent from your Twilio trial account".
4. Check that SMS to South Africa (+27) is enabled: Console → Messaging → Settings → Geo permissions.
5. Add the three variables to Vercel as sensitive values and redeploy:
   ```bash
   printf '%s' 'ACxxxxxxxx' | npx vercel@62.4.0 env add TWILIO_ACCOUNT_SID production --sensitive --yes --force
   printf '%s' '<auth token>' | npx vercel@62.4.0 env add TWILIO_AUTH_TOKEN production --sensitive --yes --force
   printf '%s' '+1xxxxxxxxxx' | npx vercel@62.4.0 env add TWILIO_FROM production --sensitive --yes --force
   npm run deploy:web
   ```
   Trial accounts may only send Twilio's predefined templates, not custom text. Also set `TWILIO_TRIAL_TEMPLATE=sms_event_notifications` (not secret). CivicLink then sends that template, and the real alert text stays in the SMS outbox. Remove the variable after upgrading the account to send the real text.
6. Verify: sign in as the administrator → System log → SMS outbox → **Send test SMS** to your verified number. The row shows SENT (Twilio) and the phone receives it; FAILED shows Twilio's reason.

## 5. Demo data

```bash
SEED_PASSWORD='<a private demo password>' FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" npm run seed:prod
```

The seed refuses to run if the project already has users. Give the lecturer the demo password privately; the published README password is for the local emulator only.

## 6. Smoke test

Sign in as each role, submit a report with a photo, assign it, complete it with proof, and broadcast an alert. Then check the Vercel function logs and the Admin → System log.
