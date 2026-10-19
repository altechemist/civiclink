/**
 * Emulator test harness shared by the functions integration tests and the seed script.
 * Admin SDK for fixtures; one named client app per signed-in user so tests call the real
 * callable API through Auth and Security Rules exactly like the web app.
 */
import { deleteApp, initializeApp as initClient, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth as getClientAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore as getClientDb, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { CallableResults, Role } from '@civiclink/shared';

/** SEED_TARGET=prod points the Admin SDK at the real project (seed only); everything else uses the emulator. */
export const PROD = process.env.SEED_TARGET === 'prod';
export const PROJECT_ID = PROD ? (process.env.FIREBASE_PROJECT_ID ?? 'civiclink-2ae84') : 'demo-civiclink';
export const REGION = 'africa-south1';
const HOSTS = { auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080', functions: '127.0.0.1:5001' };

if (!PROD) {
  process.env.FIRESTORE_EMULATOR_HOST ??= HOSTS.firestore;
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= HOSTS.auth;
}
process.env.GCLOUD_PROJECT ??= PROJECT_ID;

function prodCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('SEED_TARGET=prod needs FIREBASE_SERVICE_ACCOUNT (service-account JSON or base64)');
  return cert(JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')));
}

export const adminApp: App = getApps()[0] ?? initializeApp(PROD ? { projectId: PROJECT_ID, credential: prodCredential() } : { projectId: PROJECT_ID });
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export { Timestamp };

export async function resetEmulators() {
  if (PROD) throw new Error('Refusing to reset a real project');
  await fetch(`http://${HOSTS.firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${HOSTS.auth}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
}

export const DEPARTMENTS = [
  { id: 'water', name: 'Water & Sanitation', slaHours: 48 },
  { id: 'electricity', name: 'Electricity', slaHours: 24 },
  { id: 'roads', name: 'Roads & Infrastructure', slaHours: 120 },
  { id: 'waste', name: 'Waste Management', slaHours: 72 },
  { id: 'safety', name: 'Public Safety', slaHours: 12 },
];
export const CATEGORIES = [
  { id: 'burst-pipe', name: 'Burst Pipe', icon: 'droplets', departmentId: 'water' },
  { id: 'water-leak', name: 'Water Leak', icon: 'droplet', departmentId: 'water' },
  { id: 'electricity', name: 'Electricity Outage', icon: 'zap', departmentId: 'electricity' },
  { id: 'road-damage', name: 'Road Damage', icon: 'construction', departmentId: 'roads' },
  { id: 'illegal-dumping', name: 'Illegal Dumping', icon: 'trash', departmentId: 'waste' },
  { id: 'public-safety', name: 'Public Safety', icon: 'shield-alert', departmentId: 'safety' },
  { id: 'vandalism', name: 'Vandalism', icon: 'hammer', departmentId: 'safety' },
  { id: 'other', name: 'Other', icon: 'circle-help', departmentId: 'roads' },
];

export async function seedConfig() {
  const batch = adminDb.batch();
  for (const d of DEPARTMENTS) {
    batch.set(adminDb.collection('departments').doc(d.id), { name: d.name, nameLower: d.name.toLowerCase(), slaHours: d.slaHours, isActive: true });
  }
  for (const c of CATEGORIES) {
    batch.set(adminDb.collection('categories').doc(c.id), { name: c.name, nameLower: c.name.toLowerCase(), icon: c.icon, departmentId: c.departmentId, isActive: true });
  }
  batch.set(adminDb.collection('settings').doc('app'), { reportsPerHour: 1000 });
  await batch.commit();
}

export interface NewUser {
  email: string;
  name: string;
  role: Role;
  departmentId?: string | null;
  suburb?: string | null;
  password?: string;
  isActive?: boolean;
}

/** Demo password; set SEED_PASSWORD for a deployed instance so the public password differs from the README. */
export const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? 'CivicLink#2026';

/** Creates an Auth user + profile + claims exactly as the functions would. */
export async function createUser(u: NewUser): Promise<string> {
  const isActive = u.isActive ?? true;
  const { uid } = await adminAuth.createUser({ email: u.email, password: u.password ?? DEFAULT_PASSWORD, displayName: u.name, disabled: !isActive });
  await adminAuth.setCustomUserClaims(uid, { role: u.role, dept: u.departmentId ?? null, suburb: u.suburb ?? null, active: isActive });
  await adminDb.collection('users').doc(uid).set({
    name: u.name,
    email: u.email,
    phone: null,
    role: u.role,
    departmentId: u.departmentId ?? null,
    suburb: u.suburb ?? null,
    isActive,
    createdAt: Timestamp.now(),
    lastLoginAt: null,
  });
  return uid;
}

export interface Session {
  uid: string;
  app: FirebaseApp;
  db: Firestore;
  functions: Functions;
  call<K extends keyof CallableResults>(name: K, data?: unknown): Promise<CallableResults[K]>;
  close(): Promise<void>;
}

let appCounter = 0;
const clientConfig = { projectId: PROJECT_ID, apiKey: 'demo-api-key', authDomain: `${PROJECT_ID}.firebaseapp.com` };

/** A client session (optionally signed in) talking to the emulators. */
export async function session(email?: string, password = DEFAULT_PASSWORD): Promise<Session> {
  const app = initClient(clientConfig, `client-${++appCounter}`);
  const auth = getClientAuth(app);
  connectAuthEmulator(auth, `http://${HOSTS.auth}`, { disableWarnings: true });
  const db = getClientDb(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const functions = getFunctions(app, REGION);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  let uid = '';
  if (email) {
    uid = (await signInWithEmailAndPassword(auth, email, password)).user.uid;
    await auth.currentUser!.getIdToken(true);
  }
  return {
    uid,
    app,
    db,
    functions,
    async call(name, data) {
      return (await httpsCallable(functions, name)(data ?? {})).data as never;
    },
    close: () => deleteApp(app),
  };
}

/** 1×1 transparent PNG (base64), and as a photo input for commands. */
export const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
export const PHOTO = { contentType: 'image/png' as const, data: PNG_B64 };

/** Kimberley CBD reference point and a helper to offset by metres north. */
export const CBD = { lat: -28.7382, lng: 24.7638 };
export const northOf = (p: { lat: number; lng: number }, metres: number) => ({ lat: p.lat + metres / 111_195, lng: p.lng });

/** Expects a callable to fail with the given Functions error code (e.g. 'functions/permission-denied'). */
export async function expectCode(p: Promise<unknown>, code: string): Promise<{ message: string; details?: unknown }> {
  try {
    await p;
  } catch (err) {
    const e = err as { code?: string; message: string; details?: unknown };
    if (e.code !== `functions/${code}`) throw new Error(`Expected ${code} but got ${e.code}: ${e.message}`, { cause: err });
    return e;
  }
  throw new Error(`Expected ${code} but the call succeeded`);
}
