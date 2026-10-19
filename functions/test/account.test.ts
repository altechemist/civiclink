import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReportDoc } from '@civiclink/shared';
import { adminAuth, adminDb, CBD, createUser, DEFAULT_PASSWORD, expectCode, northOf, PHOTO, session } from '../../tests/support/emulator';
import { setupWorld, teardown, validReport, type World } from './fixtures';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
});
afterAll(() => teardown(w));

/** An Auth account without a CivicLink profile, as after a first Google sign-in. */
async function oauthOnlyUser(email: string) {
  const { uid } = await adminAuth.createUser({ email, password: DEFAULT_PASSWORD, displayName: 'Google User' });
  return { uid, s: await session(email) };
}

describe('first sign-in with Google (FR-29, BR-16)', () => {
  it('IT-AUTH-04 completeProfile creates a RESIDENT profile and claims once', async () => {
    const { uid, s } = await oauthOnlyUser('google.user@test.local');
    await s.call('completeProfile', { name: 'Google User', suburb: 'Homestead', role: 'ADMIN' });
    expect((await adminAuth.getUser(uid)).customClaims).toMatchObject({ role: 'RESIDENT', suburb: 'Homestead', active: true });
    expect((await adminDb.collection('users').doc(uid).get()).get('email')).toBe('google.user@test.local');
    await expectCode(s.call('completeProfile', { name: 'Again', suburb: 'Homestead' }), 'already-exists');
    await s.close();
  });
  it('IT-AUTH-05 existing accounts and anonymous callers cannot use completeProfile', async () => {
    await expectCode(w.officialWater.call('completeProfile', { name: 'Naledi', suburb: 'Galeshewe' }), 'already-exists');
    await expectCode(w.anon.call('completeProfile', { name: 'Nobody', suburb: 'Galeshewe' }), 'unauthenticated');
  });
});

describe('profile (FR-31)', () => {
  it('IT-PRF-01 residents change suburb and phone; claims follow; invalid phone refused', async () => {
    await w.resident2.call('updateProfile', { name: 'Pieter van Wyk', suburb: 'Ritchie', phone: '0831234567' });
    expect((await adminAuth.getUser(w.resident2.uid)).customClaims).toMatchObject({ suburb: 'Ritchie' });
    await expectCode(w.resident2.call('updateProfile', { name: 'Pieter', phone: '123' }), 'invalid-argument');
    await w.resident2.call('updateProfile', { name: 'Pieter van Wyk', suburb: 'Roodepan' });
  });
  it('IT-PRF-02 staff may change name and phone but have no home suburb', async () => {
    await w.worker.call('updateProfile', { name: 'Sipho Worker', phone: '0841234567' });
    await expectCode(w.worker.call('updateProfile', { name: 'Sipho Worker', suburb: 'Galeshewe' }), 'permission-denied');
  });
});

describe('POPIA account deletion (FR-32, BR-22)', () => {
  it('IT-DEL-01 deletion anonymises reports and removes photos, profile, receipts and the Auth account', async () => {
    const email = 'leaving@test.local';
    const uid = await createUser({ email, name: 'Leaving Resident', role: 'RESIDENT', suburb: 'Galeshewe' });
    const s = await session(email);
    const { reportId } = await s.call('submitReport', validReport({ location: northOf(CBD, 5000), photos: [PHOTO] }));
    const photoId = ((await adminDb.collection('reports').doc(reportId).get()).data() as ReportDoc).photoIds[0]!;
    // Also follow someone else's report through a duplicate.
    const parent = await w.resident.call('submitReport', validReport({ categoryId: 'water-leak', location: northOf(CBD, 6000) }));
    await s.call('submitReport', validReport({ categoryId: 'water-leak', location: northOf(CBD, 6020) }));

    await expectCode(s.call('deleteMyAccount', { confirm: 'delete me' }), 'invalid-argument');
    const res = await s.call('deleteMyAccount', { confirm: 'DELETE' });
    expect(res.anonymisedReports).toBe(2);

    const r = (await adminDb.collection('reports').doc(reportId).get()).data() as ReportDoc;
    expect(r).toMatchObject({ reporterId: 'deleted-user', reporterName: 'Former resident', photoIds: [] });
    expect(((await adminDb.collection('reports').doc(parent.reportId).get()).data() as ReportDoc).followerIds).not.toContain(uid);
    expect((await adminDb.collection('users').doc(uid).get()).exists).toBe(false);
    expect((await adminDb.collection('photos').doc(photoId).get()).exists).toBe(false);
    await expect(adminAuth.getUser(uid)).rejects.toThrow();
    await s.close();
  });
  it('IT-DEL-02 staff cannot self-delete; anonymised reports still progress without notifying anyone', async () => {
    await expectCode(w.officialWater.call('deleteMyAccount', { confirm: 'DELETE' }), 'permission-denied');
    const orphan = await adminDb.collection('reports').where('reporterId', '==', 'deleted-user').where('status', '==', 'SUBMITTED').limit(1).get();
    await w.officialWater.call('triageReport', { reportId: orphan.docs[0]!.id });
    expect((await adminDb.collection('users').doc('deleted-user').collection('notifications').get()).size).toBe(0);
  });
});

describe('rate limiting and settings (BR-21, FR-21)', () => {
  it('IT-RPT-11 submissions beyond the hourly limit are refused', async () => {
    await w.admin.call('updateSettings', { reportsPerHour: 2 });
    const email = 'busy@test.local';
    await createUser({ email, name: 'Busy Resident', role: 'RESIDENT', suburb: 'Galeshewe' });
    const s = await session(email);
    await s.call('submitReport', validReport({ location: northOf(CBD, 7000) }));
    await s.call('submitReport', validReport({ location: northOf(CBD, 7500) }));
    const err = await expectCode(s.call('submitReport', validReport({ location: northOf(CBD, 8000) })), 'resource-exhausted');
    expect(err.message).toMatch(/2 reports in the last hour/);
    await adminDb.collection('settings').doc('app').set({ reportsPerHour: 1000 }); // restore the fixture value
    await s.close();
  });
  it('IT-CFG-05 settings are admin-only and bounded', async () => {
    await expectCode(w.officialWater.call('updateSettings', { reportsPerHour: 5 }), 'permission-denied');
    await expectCode(w.admin.call('updateSettings', { reportsPerHour: 0 }), 'invalid-argument');
    await expectCode(w.admin.call('updateSettings', { reportsPerHour: 101 }), 'invalid-argument');
  });
});
