import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Cloud Functions and the emulator provide credentials automatically. The Node API on Vercel
 * (ADR-0006) reads a service-account key from FIREBASE_SERVICE_ACCOUNT (JSON or base64 JSON).
 */
function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return undefined;
  const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return cert(JSON.parse(json));
}

if (getApps().length === 0) {
  const credential = serviceAccount();
  initializeApp(credential ? { credential } : undefined);
}

export const db = getFirestore();
export const auth = getAuth();
export const ts = (ms: number) => Timestamp.fromMillis(ms);
export const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

export const col = {
  users: () => db.collection('users'),
  notifications: (uid: string) => db.collection('users').doc(uid).collection('notifications'),
  reports: () => db.collection('reports'),
  history: (reportId: string) => db.collection('reports').doc(reportId).collection('history'),
  comments: (reportId: string) => db.collection('reports').doc(reportId).collection('comments'),
  publicReports: () => db.collection('publicReports'),
  tasks: () => db.collection('tasks'),
  alerts: () => db.collection('alerts'),
  scheduledAlerts: () => db.collection('scheduledAlerts'),
  recipients: (alertId: string) => db.collection('alerts').doc(alertId).collection('recipients'),
  departments: () => db.collection('departments'),
  categories: () => db.collection('categories'),
  counters: () => db.collection('counters'),
  systemLogs: () => db.collection('systemLogs'),
  settings: () => db.collection('settings').doc('app'),
  photos: () => db.collection('photos'),
  smsOutbox: () => db.collection('smsOutbox'),
};
