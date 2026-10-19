import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const env = import.meta.env;
/** Defaults target the local emulator, so a fresh clone runs without a .env file (ADR-0003). */
const projectId = env.VITE_FIREBASE_PROJECT_ID ?? 'demo-civiclink';
export const useEmulators = (env.VITE_USE_EMULATORS ?? 'true') === 'true';

export const app = initializeApp({
  projectId,
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
  appId: env.VITE_FIREBASE_APP_ID ?? 'demo-app-id',
});

export const auth = getAuth(app);
// Offline cache: screens already visited keep working (read-only) on a weak connection.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
export const functions = getFunctions(app, 'africa-south1');

if (useEmulators) {
  const host = window.location.hostname || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
}
