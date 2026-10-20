import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { httpsCallableFromURL } from 'firebase/functions';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CBD, northOf, type Session } from '../../tests/support/emulator';
import { setupWorld, teardown, validReport, type World } from './fixtures';
import { handleHttp } from '../src/http';

/** The Node HTTP adapter used on Vercel (ADR-0006), exercised through the real Firebase client SDK. */
let w: World;
let server: Server;
let base = '';
beforeAll(async () => {
  w = await setupWorld();
  process.env.CRON_SECRET = 'test-cron-secret';
  server = createServer((req, res) => void handleHttp(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(async () => {
  await teardown(w);
  await new Promise((r) => server.close(r));
});

const callHttp = async (s: Session, name: string, data: unknown) => (await httpsCallableFromURL(s.functions, `${base}/${name}`)(data)).data as Record<string, unknown>;
const codeOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code: string }) => e.code);

describe('Node HTTP adapter (ADR-0006)', () => {
  it('IT-HTTP-01 a resident submits a report through the HTTP API', async () => {
    const res = await callHttp(w.resident, 'submitReport', validReport({ location: northOf(CBD, 9000) }));
    expect(res.ref).toMatch(/^CL-\d{4}-\d{4}$/);
  });
  it('IT-HTTP-02 authentication, roles and validation behave exactly as with Cloud Functions', async () => {
    expect(await codeOf(callHttp(w.anon, 'submitReport', validReport()))).toBe('functions/unauthenticated');
    expect(await codeOf(callHttp(w.resident, 'assignReport', { reportId: 'x', workerId: 'y' }))).toBe('functions/permission-denied');
    const err = await callHttp(w.resident, 'submitReport', validReport({ description: 'short' })).catch((e) => e);
    expect(err.code).toBe('functions/invalid-argument');
    expect(err.details.fields).toHaveProperty('description');
  });
  it('IT-HTTP-03 unknown commands and wrong methods are refused', async () => {
    expect(await codeOf(callHttp(w.resident, 'dropDatabase', {}))).toBe('functions/not-found');
    const get = await fetch(`${base}/submitReport`);
    expect(get.status).toBe(400);
  });
  it('IT-HTTP-04 the cron endpoint requires the secret', async () => {
    expect((await fetch(`${base}/cron/maintenance`)).status).toBe(401);
    expect((await fetch(`${base}/cron/maintenance`, { headers: { Authorization: 'Bearer wrong-secret-value' } })).status).toBe(401);
    const ok = await fetch(`${base}/cron/maintenance`, { headers: { Authorization: 'Bearer test-cron-secret' } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ escalated: expect.any(Number), closed: expect.any(Number), published: expect.any(Number) });
  });
});
