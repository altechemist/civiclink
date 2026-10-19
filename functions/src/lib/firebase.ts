import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

if (getApps().length === 0) initializeApp();

export const db = getFirestore();
export const auth = getAuth();
export const bucket = () => getStorage().bucket();
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
  recipients: (alertId: string) => db.collection('alerts').doc(alertId).collection('recipients'),
  departments: () => db.collection('departments'),
  categories: () => db.collection('categories'),
  counters: () => db.collection('counters'),
  systemLogs: () => db.collection('systemLogs'),
  settings: () => db.collection('settings').doc('app'),
};
