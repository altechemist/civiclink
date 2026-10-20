/**
 * Security Rules tests: every role/permission matrix cell has an allow and a deny case (NFR-01, NFR-11).
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Bytes, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const claims = {
  resident: { role: 'RESIDENT', suburb: 'Galeshewe', dept: null, active: true },
  resident2: { role: 'RESIDENT', suburb: 'Roodepan', dept: null, active: true },
  official: { role: 'OFFICIAL', dept: 'water', suburb: null, active: true },
  officialRoads: { role: 'OFFICIAL', dept: 'roads', suburb: null, active: true },
  worker: { role: 'FIELD_WORKER', dept: 'water', suburb: null, active: true },
  worker2: { role: 'FIELD_WORKER', dept: 'water', suburb: null, active: true },
  admin: { role: 'ADMIN', dept: null, suburb: null, active: true },
  inactive: { role: 'RESIDENT', suburb: 'Galeshewe', dept: null, active: false },
};
type Who = keyof typeof claims;
const as = (who: Who) => env.authenticatedContext(who, claims[who]);
const db = (who: Who) => as(who).firestore();
const anonDb = () => env.unauthenticatedContext().firestore();
const PNG = Bytes.fromUint8Array(new Uint8Array([137, 80, 78, 71]));

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-civiclink',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    const user = (role: string, extra: object = {}) => ({ name: role, email: `${role}@x`, role, isActive: true, ...extra });
    await setDoc(doc(f, 'users/resident'), user('RESIDENT', { suburb: 'Galeshewe' }));
    await setDoc(doc(f, 'users/resident2'), user('RESIDENT', { suburb: 'Roodepan' }));
    await setDoc(doc(f, 'users/official'), user('OFFICIAL', { departmentId: 'water' }));
    await setDoc(doc(f, 'users/worker'), user('FIELD_WORKER', { departmentId: 'water' }));
    await setDoc(doc(f, 'users/admin'), user('ADMIN'));
    await setDoc(doc(f, 'users/resident/notifications/n1'), { title: 't', readAt: null });
    const report = {
      reporterId: 'resident', departmentId: 'water', assignedWorkerId: 'worker', followerIds: ['resident2'],
      status: 'IN_PROGRESS', description: 'secret', photoIds: ['ph1'],
    };
    await setDoc(doc(f, 'reports/r1'), report);
    await setDoc(doc(f, 'reports/r2'), { ...report, reporterId: 'resident2', followerIds: [], assignedWorkerId: null });
    await setDoc(doc(f, 'reports/r1/history/h1'), { to: 'SUBMITTED' });
    await setDoc(doc(f, 'reports/r1/comments/c1'), { text: 'internal' });
    await setDoc(doc(f, 'publicReports/r1'), { status: 'IN_PROGRESS', isOpen: true });
    await setDoc(doc(f, 'tasks/t1'), { reportId: 'r1', workerId: 'worker', departmentId: 'water' });
    await setDoc(doc(f, 'alerts/a1'), { title: 'Strike', targetSuburbs: ['Galeshewe'], isActive: true });
    await setDoc(doc(f, 'alerts/a1/recipients/resident'), { uid: 'resident', readAt: null });
    await setDoc(doc(f, 'alerts/a1/recipients/resident2'), { uid: 'resident2', readAt: null });
    await setDoc(doc(f, 'departments/water'), { name: 'Water', slaHours: 48, isActive: true });
    await setDoc(doc(f, 'counters/reports-2026'), { next: 5 });
    await setDoc(doc(f, 'systemLogs/l1'), { message: 'x' });
    await setDoc(doc(f, 'photos/ph1'), { reportId: 'r1', ownerId: 'resident', kind: 'EVIDENCE', contentType: 'image/png', data: PNG });
    await setDoc(doc(f, 'photos/ph2'), { reportId: 'r1', ownerId: 'worker', kind: 'PROOF', contentType: 'image/png', data: PNG });
    await setDoc(doc(f, 'photos/ph3'), { reportId: 'r2', ownerId: 'resident2', kind: 'EVIDENCE', contentType: 'image/png', data: PNG });
  });
});
afterAll(() => env?.cleanup());

describe('users', () => {
  it('RT-USR-01 a user reads their own profile and may only stamp lastLoginAt', async () => {
    await assertSucceeds(getDoc(doc(db('resident'), 'users/resident')));
    await assertSucceeds(updateDoc(doc(db('resident'), 'users/resident'), { lastLoginAt: serverTimestamp() }));
  });
  it('RT-USR-02 users cannot change their own role, department or active flag (BR-16)', async () => {
    await assertFails(updateDoc(doc(db('resident'), 'users/resident'), { role: 'ADMIN' }));
    await assertFails(updateDoc(doc(db('official'), 'users/official'), { departmentId: 'roads' }));
    await assertFails(updateDoc(doc(db('inactive'), 'users/resident'), { isActive: true }));
    await assertFails(setDoc(doc(db('resident'), 'users/new'), { role: 'ADMIN' }));
  });
  it("RT-USR-03 residents cannot read other users; staff read the staff directory only", async () => {
    await assertFails(getDoc(doc(db('resident'), 'users/resident2')));
    await assertFails(getDoc(doc(db('resident'), 'users/official')));
    await assertSucceeds(getDocs(query(collection(db('official'), 'users'), where('role', '==', 'FIELD_WORKER'), where('departmentId', '==', 'water'))));
    await assertFails(getDoc(doc(db('official'), 'users/resident')));
    await assertSucceeds(getDoc(doc(db('admin'), 'users/resident')));
  });
  it('RT-USR-04 notifications are private; only readAt can be set', async () => {
    await assertSucceeds(updateDoc(doc(db('resident'), 'users/resident/notifications/n1'), { readAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('resident'), 'users/resident/notifications/n1'), { title: 'changed' }));
    await assertFails(getDoc(doc(db('resident2'), 'users/resident/notifications/n1')));
  });
  it('RT-USR-05 deactivated or anonymous users read nothing', async () => {
    await assertFails(getDoc(doc(db('inactive'), 'users/inactive')));
    await assertFails(getDoc(doc(anonDb(), 'departments/water')));
    await assertFails(getDoc(doc(db('inactive'), 'departments/water')));
  });
});

describe('reports', () => {
  it('RT-RPT-01 no client can create or modify reports or history (functions only)', async () => {
    await assertFails(setDoc(doc(db('resident'), 'reports/new'), { reporterId: 'resident', status: 'SUBMITTED' }));
    await assertFails(updateDoc(doc(db('admin'), 'reports/r1'), { status: 'CLOSED' }));
    await assertFails(setDoc(doc(db('official'), 'reports/r1/history/h2'), { to: 'CLOSED' }));
    await assertFails(updateDoc(doc(db('worker'), 'tasks/t1'), { status: 'COMPLETED' }));
  });
  it('RT-RPT-02 the reporter and duplicate followers read the report and its history', async () => {
    await assertSucceeds(getDoc(doc(db('resident'), 'reports/r1')));
    await assertSucceeds(getDoc(doc(db('resident'), 'reports/r1/history/h1')));
    await assertSucceeds(getDoc(doc(db('resident2'), 'reports/r1')));
    await assertSucceeds(getDocs(query(collection(db('resident'), 'reports'), where('reporterId', '==', 'resident'))));
  });
  it("RT-RPT-03 residents cannot read others' reports or list all reports (BR-17)", async () => {
    await assertFails(getDoc(doc(db('resident'), 'reports/r2')));
    await assertFails(getDocs(collection(db('resident'), 'reports')));
  });
  it('RT-RPT-04 officials read only their department (BR-20)', async () => {
    await assertSucceeds(getDocs(query(collection(db('official'), 'reports'), where('departmentId', '==', 'water'))));
    await assertFails(getDoc(doc(db('officialRoads'), 'reports/r1')));
    await assertFails(getDocs(collection(db('officialRoads'), 'reports')));
  });
  it('RT-RPT-05 workers read only reports assigned to them', async () => {
    await assertSucceeds(getDoc(doc(db('worker'), 'reports/r1')));
    await assertFails(getDoc(doc(db('worker'), 'reports/r2')));
    await assertFails(getDoc(doc(db('worker2'), 'reports/r1')));
  });
  it('RT-RPT-06 admins read every report', async () => {
    await assertSucceeds(getDocs(collection(db('admin'), 'reports')));
  });
  it('RT-CMT-01 internal comments are hidden from residents (BR-18)', async () => {
    await assertFails(getDoc(doc(db('resident'), 'reports/r1/comments/c1')));
    await assertSucceeds(getDoc(doc(db('official'), 'reports/r1/comments/c1')));
    await assertSucceeds(getDoc(doc(db('worker'), 'reports/r1/comments/c1')));
    await assertFails(getDoc(doc(db('officialRoads'), 'reports/r1/comments/c1')));
  });
  it('RT-PUB-01 the public projection is readable by residents, officials and admins only', async () => {
    await assertSucceeds(getDocs(collection(db('resident'), 'publicReports')));
    await assertSucceeds(getDoc(doc(db('official'), 'publicReports/r1')));
    await assertFails(getDoc(doc(db('worker'), 'publicReports/r1')));
    await assertFails(setDoc(doc(db('admin'), 'publicReports/x'), { status: 'SUBMITTED' }));
  });
});

describe('tasks, alerts, config', () => {
  it('RT-TSK-01 workers read own tasks; officials read their department; others denied', async () => {
    await assertSucceeds(getDocs(query(collection(db('worker'), 'tasks'), where('workerId', '==', 'worker'))));
    await assertFails(getDoc(doc(db('worker2'), 'tasks/t1')));
    await assertSucceeds(getDoc(doc(db('official'), 'tasks/t1')));
    await assertFails(getDoc(doc(db('officialRoads'), 'tasks/t1')));
    await assertFails(getDoc(doc(db('resident'), 'tasks/t1')));
  });
  it('RT-ALR-01 signed-in users read alerts; nobody writes them directly', async () => {
    await assertSucceeds(getDocs(query(collection(db('resident2'), 'alerts'), where('targetSuburbs', 'array-contains-any', ['Roodepan', 'ALL']))));
    await assertFails(setDoc(doc(db('official'), 'alerts/x'), { title: 'direct' }));
  });
  it('RT-ALR-02 residents read only their own delivery record; officials read all', async () => {
    await assertSucceeds(getDoc(doc(db('resident'), 'alerts/a1/recipients/resident')));
    await assertFails(getDoc(doc(db('resident'), 'alerts/a1/recipients/resident2')));
    await assertSucceeds(getDocs(collection(db('official'), 'alerts/a1/recipients')));
    await assertFails(updateDoc(doc(db('resident'), 'alerts/a1/recipients/resident'), { readAt: serverTimestamp() }));
  });
  it('RT-CFG-01 configuration is readable, never client-writable; counters and logs locked', async () => {
    await assertSucceeds(getDoc(doc(db('resident'), 'departments/water')));
    await assertFails(setDoc(doc(db('admin'), 'departments/water'), { name: 'x' }));
    await assertFails(getDoc(doc(db('admin'), 'counters/reports-2026')));
    await assertFails(getDoc(doc(db('official'), 'systemLogs/l1')));
    await assertSucceeds(getDoc(doc(db('admin'), 'systemLogs/l1')));
  });
  it('RT-ALS-01 scheduled alerts are visible to staff only until published; nobody writes them directly (FR-28)', async () => {
    await assertSucceeds(getDocs(query(collection(db('official'), 'scheduledAlerts'), where('status', '==', 'SCHEDULED'))));
    await assertSucceeds(getDoc(doc(db('admin'), 'scheduledAlerts/s1')));
    await assertFails(getDoc(doc(db('resident'), 'scheduledAlerts/s1')));
    await assertFails(getDoc(doc(db('worker'), 'scheduledAlerts/s1')));
    await assertFails(setDoc(doc(db('official'), 'scheduledAlerts/s2'), { title: 'direct' }));
  });
  it('RT-SMS-01 SMS records (phone numbers) are readable by administrators only (FR-25, NFR-11)', async () => {
    await assertSucceeds(getDoc(doc(db('admin'), 'smsOutbox/m1')));
    await assertFails(getDoc(doc(db('official'), 'smsOutbox/m1')));
    await assertFails(getDoc(doc(db('resident'), 'smsOutbox/m1')));
    await assertFails(setDoc(doc(db('admin'), 'smsOutbox/m2'), { to: '+27820000000' }));
  });
});

describe('photos (ADR-0006)', () => {
  it('RT-PHO-01 report photos and proof are visible to the reporter, followers and staff with access (BR-17)', async () => {
    await assertSucceeds(getDoc(doc(db('resident'), 'photos/ph1')));
    await assertSucceeds(getDoc(doc(db('resident'), 'photos/ph2')));
    await assertSucceeds(getDoc(doc(db('resident2'), 'photos/ph1'))); // follower of r1
    await assertSucceeds(getDoc(doc(db('worker'), 'photos/ph1')));
    await assertSucceeds(getDoc(doc(db('official'), 'photos/ph3')));
  });
  it('RT-PHO-02 other users cannot read photos, and nobody writes them directly', async () => {
    await assertFails(getDoc(doc(db('resident'), 'photos/ph3')));
    await assertFails(getDoc(doc(db('officialRoads'), 'photos/ph1')));
    await assertFails(getDoc(doc(db('worker2'), 'photos/ph1')));
    await assertFails(getDocs(collection(db('resident'), 'photos')));
    await assertFails(setDoc(doc(db('resident'), 'photos/new'), { reportId: 'r1', ownerId: 'resident', data: PNG }));
  });
});
