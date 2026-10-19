/**
 * Emulator test harness shared by the functions integration tests and the seed script.
 * Admin SDK for fixtures; one named client app per signed-in user so tests call the real
 * callable API through Auth and Security Rules exactly like the web app.
 */
import { deleteApp, initializeApp as initClient, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth as getClientAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore as getClientDb, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage as getClientStorage, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { CallableResults, Role } from '@civiclink/shared';

export const PROJECT_ID = 'demo-civiclink';
export const BUCKET = `${PROJECT_ID}.appspot.com`;
export const REGION = 'africa-south1';
const HOSTS = { auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080', functions: '127.0.0.1:5001', storage: '127.0.0.1:9199' };

process.env.FIRESTORE_EMULATOR_HOST ??= HOSTS.firestore;
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= HOSTS.auth;
process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= HOSTS.storage;
process.env.GCLOUD_PROJECT ??= PROJECT_ID;

export const adminApp: App = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export const adminBucket = () => getStorage(adminApp).bucket(BUCKET);
export { Timestamp };

export async function resetEmulators() {
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

export const DEFAULT_PASSWORD = 'CivicLink#2026';

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
  storage: FirebaseStorage;
  call<K extends keyof CallableResults>(name: K, data?: unknown): Promise<CallableResults[K]>;
  upload(path: string, bytes?: Uint8Array, contentType?: string): Promise<string>;
  close(): Promise<void>;
}

let appCounter = 0;
const clientConfig = { projectId: PROJECT_ID, apiKey: 'demo-api-key', storageBucket: BUCKET, authDomain: `${PROJECT_ID}.firebaseapp.com` };

/** A client session (optionally signed in) talking to the emulators. */
export async function session(email?: string, password = DEFAULT_PASSWORD): Promise<Session> {
  const app = initClient(clientConfig, `client-${++appCounter}`);
  const auth = getClientAuth(app);
  connectAuthEmulator(auth, `http://${HOSTS.auth}`, { disableWarnings: true });
  const db = getClientDb(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const functions = getFunctions(app, REGION);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const storage = getClientStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
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
    storage,
    async call(name, data) {
      return (await httpsCallable(functions, name)(data ?? {})).data as never;
    },
    async upload(path, bytes = TINY_PNG, contentType = 'image/png') {
      await uploadBytes(ref(storage, path), bytes, { contentType });
      return path;
    },
    close: () => deleteApp(app),
  };
}

/** 1×1 transparent PNG. */
export const TINY_PNG = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
);

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
