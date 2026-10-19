import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AlertDoc, UserDoc } from '@civiclink/shared';
import { adminAuth, adminDb, CBD, createUser, expectCode, session } from '../../tests/support/emulator';
import { setupWorld, teardown, validReport, type World } from './fixtures';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
});
afterAll(() => teardown(w));

const inHours = (h: number) => Date.now() + h * 3600_000;
const alertInput = (over: Record<string, unknown> = {}) => ({
  type: 'EMERGENCY',
  title: 'Strike: CBD road closures',
  message: 'Municipal workers strike. Avoid the CBD; use the R31 Belgrave Road.',
  targetSuburbs: ['Galeshewe'],
  expiresAt: inHours(12),
  ...over,
});

describe('registration (FR-01, BR-16)', () => {
  it('IT-AUTH-01 self-registration creates a RESIDENT with claims and a profile', async () => {
    const { uid } = await w.anon.call('registerResident', {
      name: 'Lindiwe Dube', email: 'lindiwe@test.local', password: 'GoodPass123', suburb: 'Homestead', phone: '0821234567', role: 'ADMIN',
    });
    const user = await adminAuth.getUser(uid);
    expect(user.customClaims).toMatchObject({ role: 'RESIDENT', suburb: 'Homestead', active: true });
    expect(((await adminDb.collection('users').doc(uid).get()).data() as UserDoc).role).toBe('RESIDENT');
  });
  it('IT-AUTH-02 duplicate email and weak password are refused', async () => {
    const err = await expectCode(
      w.anon.call('registerResident', { name: 'Again', email: 'lindiwe@test.local', password: 'GoodPass123', suburb: 'Homestead' }),
      'already-exists',
    );
    expect(err.message).toMatch(/already registered/);
    await expectCode(w.anon.call('registerResident', { name: 'Weak', email: 'weak@test.local', password: 'short', suburb: 'Homestead' }), 'invalid-argument');
  });
  it('IT-AUTH-03 a deactivated account is refused by every command', async () => {
    const email = 'soon.gone@test.local';
    const uid = await createUser({ email, name: 'Soon Gone', role: 'RESIDENT', suburb: 'Galeshewe' });
    const s = await session(email);
    await w.admin.call('setUserActive', { uid, active: false });
    await expectCode(s.call('submitReport', validReport()), 'permission-denied');
    await expect(session(email)).rejects.toThrow(/user-disabled/);
    await s.close();
  });
});

describe('alerts (FR-16, FR-17, FR-18, BR-13, BR-14)', () => {
  let alertId = '';
  it('IT-ALR-01 broadcast creates one recipient per active resident in the target suburbs', async () => {
    const res = await w.officialWater.call('broadcastAlert', alertInput());
    alertId = res.alertId;
    // Galeshewe: Thandi (fixture). The deactivated resident from IT-AUTH-03 is excluded.
    expect(res.recipientCount).toBe(1);
    const recipients = await adminDb.collection('alerts').doc(alertId).collection('recipients').get();
    expect(recipients.docs.map((d) => d.id)).toEqual([w.resident.uid]);
  });
  it('IT-ALR-02 ALL targets every active resident', async () => {
    const res = await w.admin.call('broadcastAlert', alertInput({ targetSuburbs: ['ALL'], type: 'WATER' }));
    expect(res.recipientCount).toBe(3); // Thandi, Pieter, Lindiwe
  });
  it('IT-ALR-03 validation: long title, empty targets, past or far expiry', async () => {
    await expectCode(w.officialWater.call('broadcastAlert', alertInput({ title: 'x'.repeat(101) })), 'invalid-argument');
    await expectCode(w.officialWater.call('broadcastAlert', alertInput({ targetSuburbs: [] })), 'invalid-argument');
    await expectCode(w.officialWater.call('broadcastAlert', alertInput({ expiresAt: Date.now() - 1000 })), 'invalid-argument');
    await expectCode(w.officialWater.call('broadcastAlert', alertInput({ expiresAt: inHours(24 * 31) })), 'invalid-argument');
  });
  it('IT-ALR-04 residents and field workers cannot broadcast', async () => {
    await expectCode(w.resident.call('broadcastAlert', alertInput()), 'permission-denied');
    await expectCode(w.worker.call('broadcastAlert', alertInput()), 'permission-denied');
  });
  it('IT-ALR-05 mark-as-read counts once per resident', async () => {
    await w.resident.call('markAlertRead', { alertId });
    await w.resident.call('markAlertRead', { alertId });
    // A resident outside the target who opens it anyway is recorded on first read.
    await w.resident2.call('markAlertRead', { alertId });
    const alert = (await adminDb.collection('alerts').doc(alertId).get()).data() as AlertDoc;
    expect(alert.readCount).toBe(2);
  });
  it('IT-ALR-06 deactivation hides the alert', async () => {
    await w.officialWater.call('deactivateAlert', { alertId });
    expect(((await adminDb.collection('alerts').doc(alertId).get()).data() as AlertDoc).isActive).toBe(false);
  });
});

describe('user administration (FR-20, BR-15, BR-16)', () => {
  it('IT-ADM-01 admin creates a staff account with claims', async () => {
    const { uid } = await w.admin.call('createStaffUser', {
      name: 'Mpho Official', email: 'mpho@test.local', password: 'GoodPass123', role: 'OFFICIAL', departmentId: 'electricity',
    });
    expect((await adminAuth.getUser(uid)).customClaims).toMatchObject({ role: 'OFFICIAL', dept: 'electricity', active: true });
  });
  it('IT-ADM-02 staff accounts need an active department', async () => {
    await expectCode(
      w.admin.call('createStaffUser', { name: 'No Dept', email: 'nodept@test.local', password: 'GoodPass123', role: 'FIELD_WORKER' }),
      'invalid-argument',
    );
    await expectCode(
      w.admin.call('createStaffUser', { name: 'Bad Dept', email: 'baddept@test.local', password: 'GoodPass123', role: 'FIELD_WORKER', departmentId: 'nope' }),
      'invalid-argument',
    );
  });
  it('IT-ADM-03 role change updates the profile and claims', async () => {
    await w.admin.call('setUserRole', { uid: w.worker2.uid, role: 'OFFICIAL', departmentId: 'water' });
    expect((await adminAuth.getUser(w.worker2.uid)).customClaims).toMatchObject({ role: 'OFFICIAL', dept: 'water' });
  });
  it('IT-ADM-04 an admin cannot demote or deactivate themselves (BR-15)', async () => {
    await expectCode(w.admin.call('setUserRole', { uid: w.admin.uid, role: 'RESIDENT' }), 'permission-denied');
    await expectCode(w.admin.call('setUserActive', { uid: w.admin.uid, active: false }), 'permission-denied');
  });
  it('IT-ADM-05 non-admins cannot manage users', async () => {
    await expectCode(w.officialWater.call('setUserActive', { uid: w.resident.uid, active: false }), 'permission-denied');
    await expectCode(w.resident.call('createStaffUser', { name: 'X Y', email: 'x@test.local', password: 'GoodPass123', role: 'ADMIN' }), 'permission-denied');
  });
  it('IT-ADM-06 reactivation restores access', async () => {
    const email = 'back@test.local';
    const uid = await createUser({ email, name: 'Back Again', role: 'RESIDENT', suburb: 'Roodepan' });
    await w.admin.call('setUserActive', { uid, active: false });
    await w.admin.call('setUserActive', { uid, active: true });
    const s = await session(email);
    expect(s.uid).toBe(uid);
    await s.close();
  });
  it('IT-ADM-07 admin actions are written to the system log (FR-23)', async () => {
    const logs = await adminDb.collection('systemLogs').where('source', '==', 'admin.setUserActive').get();
    expect(logs.size).toBeGreaterThan(0);
  });
});

describe('configuration (FR-21, BR-19)', () => {
  it('IT-CFG-01 SLA hours must be 1–720', async () => {
    await expectCode(w.admin.call('upsertDepartment', { name: 'Parks', slaHours: 0, isActive: true }), 'invalid-argument');
    await expectCode(w.admin.call('upsertDepartment', { name: 'Parks', slaHours: 721, isActive: true }), 'invalid-argument');
    expect((await w.admin.call('upsertDepartment', { name: 'Parks & Recreation', slaHours: 96, isActive: true })).id).toBe('parks-and-recreation');
  });
  it('IT-CFG-02 names are unique (case-insensitive)', async () => {
    await expectCode(w.admin.call('upsertDepartment', { name: 'electricity', slaHours: 10, isActive: true }), 'invalid-argument');
    await expectCode(w.admin.call('upsertCategory', { name: 'burst pipe', icon: 'x', departmentId: 'water', isActive: true }), 'invalid-argument');
  });
  it('IT-CFG-03 categories link to an existing department and can be deactivated', async () => {
    const { id } = await w.admin.call('upsertCategory', { name: 'Streetlight Out', icon: 'lamp', departmentId: 'electricity', isActive: true });
    await w.admin.call('upsertCategory', { id, name: 'Streetlight Out', icon: 'lamp', departmentId: 'electricity', isActive: false });
    await expectCode(w.resident.call('submitReport', validReport({ categoryId: id, location: CBD })), 'invalid-argument');
    await expectCode(w.admin.call('upsertCategory', { name: 'Orphan', icon: 'x', departmentId: 'missing', isActive: true }), 'invalid-argument');
  });
  it('IT-CFG-04 non-admins cannot change configuration', async () => {
    await expectCode(w.officialWater.call('upsertDepartment', { name: 'Hack', slaHours: 5, isActive: true }), 'permission-denied');
  });
});

describe('analytics (FR-19, SC-05)', () => {
  it('IT-ANL-01 metrics reflect live data and are restricted to officials and admins', async () => {
    const before = await w.officialWater.call('getAnalytics', { days: 30 });
    await w.resident.call('submitReport', validReport({ categoryId: 'illegal-dumping', location: CBD }));
    const after = await w.admin.call('getAnalytics', { days: 30 });
    expect(after.total).toBe(before.total + 1);
    expect(after.byCategory['illegal-dumping']).toBe((before.byCategory['illegal-dumping'] ?? 0) + 1);
    expect(after.departments.map((d) => d.departmentId)).toContain('waste');
    await expectCode(w.resident.call('getAnalytics', { days: 30 }), 'permission-denied');
  });
});
