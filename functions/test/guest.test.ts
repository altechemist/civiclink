import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { EmailAuthProvider, linkWithCredential, signInAnonymously } from 'firebase/auth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PublicFeed, ReportDoc, UserDoc } from '@civiclink/shared';
import { adminAuth, adminDb, CBD, expectCode, guestSession, northOf, session } from '../../tests/support/emulator';
import { setupWorld, teardown, validReport, type World } from './fixtures';
import { handleHttp } from '../src/http';

/** FR-38 public home feed and FR-39 guest reporting with optional account (BR-26). */
let w: World;
let server: Server;
let base = '';
beforeAll(async () => {
  w = await setupWorld();
  server = createServer((req, res) => void handleHttp(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(async () => {
  await teardown(w);
  await new Promise((r) => server.close(r));
});

const profile = async (uid: string) => (await adminDb.collection('users').doc(uid).get()).data() as UserDoc | undefined;

describe('guest reporting (FR-39, BR-26)', () => {
  it('IT-GST-01 an anonymous session becomes a guest Resident; starting again changes nothing', async () => {
    const g = await guestSession();
    expect(await profile(g.uid)).toMatchObject({ role: 'RESIDENT', isGuest: true, name: 'Guest resident', suburb: null, isActive: true });
    expect((await adminAuth.getUser(g.uid)).customClaims).toMatchObject({ role: 'RESIDENT', guest: true, active: true });
    expect(await g.call('startGuestSession', {})).toEqual({ ok: true, created: false });
    await expectCode(w.anon.call('startGuestSession', {}), 'unauthenticated');
    await g.close();
  });

  it('IT-GST-02 a guest can report and follow it, within a lower hourly limit; account-only actions are refused', async () => {
    const g = await guestSession();
    const first = await g.call('submitReport', validReport({ location: northOf(CBD, 11000) }));
    const r = (await adminDb.collection('reports').doc(first.reportId).get()).data() as ReportDoc;
    expect(r).toMatchObject({ reporterId: g.uid, reporterName: 'Guest resident', status: 'SUBMITTED' });
    await g.call('submitReport', validReport({ location: northOf(CBD, 11500) }));
    await g.call('submitReport', validReport({ location: northOf(CBD, 12000) }));
    const err = await expectCode(g.call('submitReport', validReport({ location: northOf(CBD, 12500) })), 'resource-exhausted');
    expect(err.message).toMatch(/3 reports.*create an account/);
    await expectCode(g.call('updateProfile', { name: 'Someone', suburb: 'Galeshewe', phone: '0821234567', smsAlerts: true }), 'permission-denied');
    await g.close();
  });

  it('IT-GST-03 a guest creates an account in the same session and keeps their reports', async () => {
    const g = await guestSession();
    const { reportId } = await g.call('submitReport', validReport({ location: northOf(CBD, 13000) }));
    await expectCode(g.call('upgradeGuest', { name: 'Lerato Mokoena', suburb: 'Homestead' }), 'invalid-argument'); // nothing linked yet
    await linkWithCredential(g.auth.currentUser!, EmailAuthProvider.credential('lerato@test.local', 'GoodPass123'));
    await g.call('upgradeGuest', { name: 'Lerato Mokoena', suburb: 'Homestead', phone: '0821234567' });
    expect(await profile(g.uid)).toMatchObject({ name: 'Lerato Mokoena', email: 'lerato@test.local', suburb: 'Homestead', isGuest: false });
    const claims = (await adminAuth.getUser(g.uid)).customClaims;
    expect(claims).toMatchObject({ role: 'RESIDENT', suburb: 'Homestead' });
    expect(claims?.guest).toBeUndefined();
    expect(((await adminDb.collection('reports').doc(reportId).get()).data() as ReportDoc).reporterName).toBe('Lerato Mokoena');
    await expectCode(g.call('upgradeGuest', { name: 'Again', suburb: 'Homestead' }), 'failed-precondition');
    await g.close();
  });

  it('IT-GST-04 a guest moves their reports into an existing account with a one-time code', async () => {
    const g = await guestSession();
    const { reportId } = await g.call('submitReport', validReport({ location: northOf(CBD, 14000) }));
    const { code } = await g.call('startGuestTransfer', {});
    await expectCode(g.call('claimGuestReports', { code }), 'failed-precondition'); // must sign in first
    const res = await w.resident2.call('claimGuestReports', { code });
    expect(res).toEqual({ moved: 1 });
    expect(((await adminDb.collection('reports').doc(reportId).get()).data() as ReportDoc)).toMatchObject({ reporterId: w.resident2.uid, reporterName: 'Pieter Resident' });
    expect(await profile(g.uid)).toBeUndefined();
    await expect(adminAuth.getUser(g.uid)).rejects.toThrow(/no user record/i);
    await expectCode(w.resident2.call('claimGuestReports', { code }), 'failed-precondition'); // single use
    await expectCode(w.resident.call('claimGuestReports', { code: 'x'.repeat(43) }), 'not-found');
    await expectCode(w.resident.call('startGuestTransfer', {}), 'failed-precondition'); // not a guest
  });

  it('IT-GST-05 guest sessions are limited per network address', async () => {
    const start = async (ip: string) => {
      const s = await session();
      const { user } = await signInAnonymously(s.auth);
      const res = await fetch(`${base}/startGuestSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}`, 'X-Forwarded-For': ip },
        body: JSON.stringify({ data: {} }),
      });
      await s.close();
      return res.status;
    };
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push(await start('198.51.100.7'));
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(await start('198.51.100.8')).toBe(200); // another address is unaffected
  });
});

describe('public home feed (FR-38, NFR-11, NFR-13)', () => {
  it('IT-PUB-03 anyone can GET open issues (approximate) and active alerts, cached for a minute', async () => {
    await w.officialWater.call('broadcastAlert', {
      type: 'WATER', title: 'Water off in Galeshewe', message: 'Repairs until 16:00 today.', targetSuburbs: ['Galeshewe'], expiresAt: Date.now() + 3600_000,
    });
    const res = await fetch(`${base}/public/feed`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=60/);
    const feed = (await res.json()) as PublicFeed;
    expect(feed.alerts.map((a) => a.title)).toContain('Water off in Galeshewe');
    expect(feed.openIssues.length).toBeGreaterThan(0);
    const text = JSON.stringify(feed);
    for (const leak of ['reporter', 'description', 'Guest resident', 'Lerato', 'Pieter', 'Burst pipe flooding']) expect(text).not.toContain(leak);
    // Locations are the rounded public projection, never the exact report location.
    const exact = (await adminDb.collection('reports').where('status', '==', 'SUBMITTED').limit(1).get()).docs[0]!.data() as ReportDoc;
    const pub = feed.openIssues.find((i) => i.ref === exact.ref);
    if (pub) expect(pub.location).not.toEqual(exact.location);
  });
});
