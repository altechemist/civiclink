import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { httpsCallableFromURL } from 'firebase/functions';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminDb, CBD, expectCode, northOf, type Session } from '../../tests/support/emulator';
import { setupWorld, teardown, validReport, type World } from './fixtures';
import { handleHttp } from '../src/http';
import { setPushSender, tokenId, type PushSender } from '../src/services/pushService';

/** FR-24 web push, exercised in-process through the Node adapter with a fake FCM sender. */
let w: World;
let server: Server;
let base = '';
let sent: { tokens: string[]; data: Record<string, string> }[] = [];
let dead = new Set<string>();
const fake: PushSender = {
  async sendEachForMulticast(m) {
    sent.push({ tokens: m.tokens, data: m.data });
    return { responses: m.tokens.map((t) => (dead.has(t) ? { success: false, error: { code: 'messaging/registration-token-not-registered' } } : { success: true })) };
  },
};
beforeAll(async () => {
  w = await setupWorld();
  setPushSender(fake);
  server = createServer((req, res) => void handleHttp(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(async () => {
  setPushSender(null);
  await teardown(w);
  await new Promise((r) => server.close(r));
});
beforeEach(() => {
  sent = [];
  dead = new Set();
});

const http = async (s: Session, name: string, data: unknown) => (await httpsCallableFromURL(s.functions, `${base}/${name}`)(data)).data as Record<string, unknown>;
const TOKEN = (n: string) => `fake-fcm-token-${n}-${'x'.repeat(30)}`;

describe('web push (FR-24)', () => {
  it('IT-PSH-01 devices register and unregister; tokens are stored server-side only; anonymous refused', async () => {
    await http(w.resident, 'registerPushToken', { token: TOKEN('resident') });
    const doc = await adminDb.collection('users').doc(w.resident.uid).collection('pushTokens').doc(tokenId(TOKEN('resident'))).get();
    expect(doc.get('uid')).toBe(w.resident.uid);
    await http(w.resident2, 'registerPushToken', { token: TOKEN('r2') });
    await http(w.resident2, 'unregisterPushToken', { token: TOKEN('r2') });
    expect((await adminDb.collection('users').doc(w.resident2.uid).collection('pushTokens').get()).size).toBe(0);
    await expectCode(httpsCallableFromURL(w.anon.functions, `${base}/registerPushToken`)({ token: TOKEN('anon') }), 'unauthenticated');
  });

  it('IT-PSH-02 a committed status change pushes once to the reporter; a refused command pushes nothing', async () => {
    const { reportId } = await http(w.resident, 'submitReport', validReport({ location: northOf(CBD, 9500) }));
    sent = [];
    await http(w.officialWater, 'triageReport', { reportId });
    const toResident = sent.filter((m) => m.tokens.includes(TOKEN('resident')));
    expect(toResident).toHaveLength(1);
    expect(toResident[0]!.data).toMatchObject({ link: `/resident/reports/${reportId}` });
    expect(toResident[0]!.data.title).toMatch(/under review/);
    sent = [];
    await expectCode(httpsCallableFromURL(w.officialWater.functions, `${base}/triageReport`)({ reportId }), 'failed-precondition');
    expect(sent).toHaveLength(0);
  });

  it('IT-PSH-03 suburb alerts are pushed to targeted residents and dead tokens are pruned', async () => {
    await http(w.resident, 'registerPushToken', { token: TOKEN('stale') });
    dead.add(TOKEN('stale'));
    await http(w.officialWater, 'broadcastAlert', {
      type: 'WATER', title: 'Push test outage', message: 'Water off until 18:00 in Galeshewe.', targetSuburbs: ['Galeshewe'], expiresAt: Date.now() + 3600_000,
    });
    const alertPush = sent.find((m) => m.data.title === 'Push test outage');
    expect(alertPush?.tokens).toEqual(expect.arrayContaining([TOKEN('resident'), TOKEN('stale')]));
    expect((await adminDb.collection('users').doc(w.resident.uid).collection('pushTokens').doc(tokenId(TOKEN('stale'))).get()).exists).toBe(false);
    expect((await adminDb.collection('users').doc(w.resident.uid).collection('pushTokens').doc(tokenId(TOKEN('resident'))).get()).exists).toBe(true);
  });
});
