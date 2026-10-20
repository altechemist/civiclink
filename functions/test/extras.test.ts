import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { httpsCallableFromURL } from 'firebase/functions';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AlertDoc, PublicStats, ReportDoc, ScheduledAlertDoc, SmsDoc } from '@civiclink/shared';
import { adminDb, CBD, expectCode, northOf, PHOTO, type Session } from '../../tests/support/emulator';
import { assignedReport, setupWorld, teardown, validReport, type World } from './fixtures';
import { handleHttp } from '../src/http';
import { setSmsGateway } from '../src/services/smsService';

/**
 * Release 1.1 features: offline submission (FR-27), scheduled alerts (FR-28), bulk assignment (FR-35),
 * public transparency figures (FR-36), service ratings (FR-37) and SMS alerts (FR-25).
 */
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
  setSmsGateway(null);
  await teardown(w);
  await new Promise((r) => server.close(r));
});

const http = async (s: Session, name: string, data: unknown) => (await httpsCallableFromURL(s.functions, `${base}/${name}`)(data)).data as Record<string, unknown>;
const inHours = (h: number) => Date.now() + h * 3600_000;
const alertInput = (over: Record<string, unknown> = {}) => ({
  type: 'WATER',
  title: 'Planned water maintenance',
  message: 'Water will be off from 09:00 to 13:00 for valve replacement.',
  targetSuburbs: ['Galeshewe'],
  expiresAt: inHours(24),
  ...over,
});

describe('offline submission (FR-27)', () => {
  it('IT-OFF-01 a report re-sent with the same clientId is stored once and returns the same reference', async () => {
    const report = validReport({ location: northOf(CBD, 3000), clientId: 'device-0001-abcd' });
    const first = await w.resident.call('submitReport', report);
    const again = await w.resident.call('submitReport', report);
    expect(again).toMatchObject({ reportId: first.reportId, ref: first.ref, replayed: true });
    const mine = await adminDb.collection('reports').where('reporterId', '==', w.resident.uid).where('ref', '==', first.ref).get();
    expect(mine.size).toBe(1);
  });
  it('IT-OFF-02 another resident cannot reuse a clientId to read someone else’s report; malformed ids are refused', async () => {
    const report = validReport({ location: northOf(CBD, 3000), clientId: 'device-0001-abcd' });
    const other = await w.resident2.call('submitReport', report);
    expect(other.replayed).toBeUndefined(); // ids are per account, so this is a new report
    await expectCode(w.resident.call('submitReport', validReport({ clientId: 'bad id!' })), 'invalid-argument');
  });
});

describe('scheduled alerts (FR-28, BR-24)', () => {
  it('IT-SCH-01 a scheduled alert is invisible until due, then published once with the same id', async () => {
    const publishAt = inHours(2);
    const res = await w.officialWater.call('broadcastAlert', alertInput({ publishAt }));
    expect(res).toMatchObject({ scheduled: true, recipientCount: 0 });
    expect((await adminDb.collection('alerts').doc(res.alertId).get()).exists).toBe(false);

    const early = await w.admin.call('runMaintenance', { now: publishAt - 60_000 });
    expect(early.published).toBe(0);
    const due = await w.admin.call('runMaintenance', { now: publishAt + 60_000 });
    expect(due.published).toBe(1);
    const alert = (await adminDb.collection('alerts').doc(res.alertId).get()).data() as AlertDoc;
    expect(alert).toMatchObject({ title: 'Planned water maintenance', recipientCount: 1, isActive: true });
    const scheduled = (await adminDb.collection('scheduledAlerts').doc(res.alertId).get()).data() as ScheduledAlertDoc;
    expect(scheduled).toMatchObject({ status: 'PUBLISHED', recipientCount: 1 });

    const rerun = await w.admin.call('runMaintenance', { now: publishAt + 120_000 });
    expect(rerun.published).toBe(0);
  });
  it('IT-SCH-02 invalid times are refused; a cancelled alert is never published', async () => {
    await expectCode(w.officialWater.call('broadcastAlert', alertInput({ publishAt: Date.now() + 60_000 })), 'invalid-argument');
    await expectCode(w.officialWater.call('broadcastAlert', alertInput({ publishAt: inHours(30), expiresAt: inHours(20) })), 'invalid-argument');
    const { alertId } = await w.officialWater.call('broadcastAlert', alertInput({ publishAt: inHours(3) }));
    await w.officialWater.call('cancelScheduledAlert', { scheduledId: alertId });
    await expectCode(w.officialWater.call('cancelScheduledAlert', { scheduledId: alertId }), 'failed-precondition');
    await w.admin.call('runMaintenance', { now: inHours(4) });
    expect((await adminDb.collection('alerts').doc(alertId).get()).exists).toBe(false);
    await expectCode(w.resident.call('cancelScheduledAlert', { scheduledId: alertId }), 'permission-denied');
  });
});

describe('bulk assignment (FR-35)', () => {
  it('IT-BLK-01 assigns every eligible report and reports the rest without blocking them', async () => {
    const ids: string[] = [];
    for (const m of [5000, 5400]) {
      const { reportId } = await w.resident2.call('submitReport', validReport({ location: northOf(CBD, m) }));
      await w.officialWater.call('triageReport', { reportId });
      ids.push(reportId);
    }
    const busy = await assignedReport(w, northOf(CBD, 5800));
    const res = await w.officialWater.call('assignReports', { reportIds: [...ids, busy.reportId], workerId: w.worker2.uid });
    expect(res.assigned.map((a) => a.reportId).sort()).toEqual([...ids].sort());
    expect(res.failed).toEqual([{ reportId: busy.reportId, message: expect.stringMatching(/already has an active task/) }]);
    for (const id of ids) {
      const r = (await adminDb.collection('reports').doc(id).get()).data() as ReportDoc;
      expect(r).toMatchObject({ status: 'IN_PROGRESS', assignedWorkerId: w.worker2.uid });
    }
  });
  it('IT-BLK-02 other departments, residents and oversized batches are refused', async () => {
    const { reportId } = await w.resident2.call('submitReport', validReport({ location: northOf(CBD, 6500) }));
    await w.officialWater.call('triageReport', { reportId });
    const res = await w.officialRoads.call('assignReports', { reportIds: [reportId], workerId: w.workerRoads.uid });
    expect(res.assigned).toHaveLength(0);
    expect(res.failed).toHaveLength(1);
    await expectCode(w.resident.call('assignReports', { reportIds: [reportId], workerId: w.worker.uid }), 'permission-denied');
    await expectCode(w.officialWater.call('assignReports', { reportIds: Array.from({ length: 21 }, (_, i) => `r${i}`), workerId: w.worker.uid }), 'invalid-argument');
  });
});

describe('service rating (FR-37)', () => {
  it('IT-RAT-01 the reporter rates the fix when confirming; out-of-range ratings are refused', async () => {
    const { reportId, taskId } = await assignedReport(w, northOf(CBD, 7000));
    await w.worker.call('updateTask', { taskId, action: 'accept' });
    await w.worker.call('updateTask', { taskId, action: 'start' });
    await w.worker.call('completeTask', { taskId, notes: 'Replaced the coupling and tested the pressure.', proofs: [PHOTO] });
    await expectCode(w.resident.call('confirmResolution', { reportId, rating: 6 }), 'invalid-argument');
    await w.resident.call('confirmResolution', { reportId, rating: 4, feedback: 'Quick and tidy work' });
    const r = (await adminDb.collection('reports').doc(reportId).get()).data() as ReportDoc;
    expect(r).toMatchObject({ status: 'CLOSED', rating: 4, feedback: 'Quick and tidy work' });
  });
});

describe('public transparency figures (FR-36, NFR-11, NFR-13)', () => {
  it('IT-PUB-01 anyone can GET anonymous figures, with CDN cache headers', async () => {
    const res = await fetch(`${base}/public/stats`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=300/);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const body = (await res.json()) as PublicStats;
    expect(body.summary.open).toBeGreaterThan(0);
    expect(body.satisfaction).toEqual({ average: 4, ratings: 1 });
    expect(body.categories['burst-pipe']).toBeTruthy();
    // No personal or free-text data leaves the server.
    const text = JSON.stringify(body);
    for (const leak of ['Thandi', 'Pieter', 'reporter', 'description', 'Quick and tidy', '-28.7', 'thandi@']) expect(text).not.toContain(leak);
  });
  it('IT-PUB-02 the figures are only readable, not writable', async () => {
    expect((await fetch(`${base}/public/stats`, { method: 'POST' })).status).toBe(405);
  });
});

describe('SMS alerts (FR-25, BR-25)', () => {
  it('IT-SMS-01 emergency alerts are queued by SMS for opted-in residents only; other types are not', async () => {
    await expectCode(w.resident.call('updateProfile', { name: 'Thandi Resident', suburb: 'Galeshewe', smsAlerts: true }), 'invalid-argument'); // needs a number
    await w.resident.call('updateProfile', { name: 'Thandi Resident', suburb: 'Galeshewe', phone: '0821234567', smsAlerts: true });
    const water = await w.officialWater.call('broadcastAlert', alertInput());
    expect((await adminDb.collection('smsOutbox').where('alertId', '==', water.alertId).get()).size).toBe(0);

    const emergency = await w.officialWater.call('broadcastAlert', alertInput({ type: 'EMERGENCY', title: 'Gas leak near Galeshewe Stadium' }));
    const sms = (await adminDb.collection('smsOutbox').where('alertId', '==', emergency.alertId).get()).docs.map((d) => d.data() as SmsDoc);
    expect(sms).toHaveLength(1);
    expect(sms[0]).toMatchObject({ uid: w.resident.uid, to: '+27821234567', status: 'SIMULATED', gateway: 'simulated' });
    expect(sms[0]!.body).toMatch(/^CivicLink EMERGENCY: Gas leak near Galeshewe Stadium\./);
    expect(sms[0]!.body.length).toBeLessThanOrEqual(160);
    expect(((await adminDb.collection('alerts').doc(emergency.alertId).get()).data() as AlertDoc).smsCount).toBe(1);
  });
  it('IT-SMS-02 a gateway failure is recorded per message and logged, and does not fail the alert', async () => {
    setSmsGateway({ name: 'fake', send: async () => Promise.reject(new Error('Gateway down')) });
    const res = await http(w.officialWater, 'broadcastAlert', alertInput({ type: 'EMERGENCY', title: 'Burst main: Galeshewe' }));
    expect(res.recipientCount).toBe(1);
    const sms = (await adminDb.collection('smsOutbox').where('alertId', '==', res.alertId).get()).docs.map((d) => d.data() as SmsDoc);
    expect(sms).toEqual([expect.objectContaining({ status: 'FAILED', error: 'Gateway down' })]);
    setSmsGateway(null);
  });
  it('IT-SMS-03 removing the number ends the opt-in; deleting the account deletes the SMS records', async () => {
    await w.resident.call('updateProfile', { name: 'Thandi Resident', suburb: 'Galeshewe', phone: '' });
    expect((await adminDb.collection('users').doc(w.resident.uid).get()).get('smsAlerts')).toBe(false);
    await w.resident.call('deleteMyAccount', { confirm: 'DELETE' });
    expect((await adminDb.collection('smsOutbox').where('uid', '==', w.resident.uid).get()).size).toBe(0);
  });
});

describe('SMS gateway (FR-25, Twilio)', () => {
  it('IT-SMS-04 an administrator can send a test SMS (simulated without credentials); others cannot', async () => {
    const res = await w.admin.call('sendTestSms', { to: '0831112222' });
    expect(res).toMatchObject({ status: 'SIMULATED', gateway: 'simulated' });
    await expectCode(w.officialWater.call('sendTestSms', { to: '0831112222' }), 'permission-denied');
    await expectCode(w.admin.call('sendTestSms', { to: '12345' }), 'invalid-argument');
  });
  it('IT-SMS-05 with Twilio credentials, messages go to Twilio’s REST API in the documented form (trial: a predefined template); errors are recorded', async () => {
    const env = { ...process.env };
    const realFetch = globalThis.fetch;
    const calls: { url: string; auth: string; body: URLSearchParams }[] = [];
    let fail = false;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (!String(url).startsWith('https://api.twilio.com/')) return realFetch(url, init);
      calls.push({ url: String(url), auth: (init?.headers as Record<string, string>).Authorization ?? '', body: init?.body as URLSearchParams });
      return fail
        ? new Response(JSON.stringify({ message: 'The To number is not verified' }), { status: 400 })
        : new Response(JSON.stringify({ sid: 'SM0123456789' }), { status: 201 });
    }) as typeof fetch;
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'secret-token', TWILIO_FROM: '+15005550006' });
    setSmsGateway(null);
    try {
      const ok = await http(w.admin, 'sendTestSms', { to: '0831112222' });
      expect(ok).toMatchObject({ status: 'SENT', gateway: 'twilio' });
      expect(calls[0]!.url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json');
      expect(calls[0]!.auth).toBe(`Basic ${Buffer.from('ACtest:secret-token').toString('base64')}`);
      expect(Object.fromEntries(calls[0]!.body)).toEqual({ To: '+27831112222', From: '+15005550006', Body: 'CivicLink test: SMS alerts are working.' });
      // Trial accounts: the predefined template name is sent instead of the text (the text stays in smsOutbox).
      process.env.TWILIO_TRIAL_TEMPLATE = 'sms_event_notifications';
      setSmsGateway(null);
      const trial = await http(w.admin, 'sendTestSms', { to: '0831112222' });
      expect(trial).toMatchObject({ status: 'SENT', gateway: 'twilio-trial' });
      expect(calls[1]!.body.get('Body')).toBe('sms_event_notifications');
      fail = true;
      const bad = await http(w.admin, 'sendTestSms', { to: '0831112222' });
      expect(bad).toMatchObject({ status: 'FAILED', error: 'The To number is not verified' });
    } finally {
      globalThis.fetch = realFetch;
      process.env = env;
      setSmsGateway(null);
    }
  });
});
