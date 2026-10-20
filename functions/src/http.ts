/**
 * Plain Node HTTP adapter for the command API (ADR-0006), used on Vercel so the system runs on
 * Firebase's free Spark plan (no Cloud Functions). It speaks the Firebase callable protocol, so the
 * web client calls it with `httpsCallableFromURL` and errors arrive exactly as from Cloud Functions.
 *
 *   POST /api/<command>          body {"data": …}, header Authorization: Bearer <Firebase ID token>
 *   GET  /api/cron/maintenance   header Authorization: Bearer <CRON_SECRET>   (SLA escalation, auto-close)
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { COMMANDS, type CommandName } from './commands';
import { execute, type Caller } from './lib/command';
import { auth } from './lib/firebase';
import { MaintenanceService } from './services/maintenanceService';
import { writeLog } from './services/logService';
import { deliverPushes, withPushScope } from './services/pushService';

const MAX_BODY = 4 * 1024 * 1024; // 3 compressed photos (≤ 700 KB each) as base64 fit comfortably

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, err: HttpsError) {
  send(res, err.httpErrorCode.status, { error: err.toJSON() });
}

function cors(req: IncomingMessage, res: ServerResponse) {
  const allowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Firebase-Instance-ID-Token, X-Firebase-AppCheck');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
}

async function readJson(req: IncomingMessage & { body?: unknown }): Promise<{ data?: unknown }> {
  if (req.body !== undefined) return (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { data?: unknown }; // pre-parsed by the host
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpsError('invalid-argument', 'Request is too large');
    chunks.push(chunk as Buffer);
  }
  return chunks.length ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as { data?: unknown }) : {};
}

/** Verifies the Firebase ID token; revoked sessions (deactivated users, role changes) are refused. */
async function verifyCaller(req: IncomingMessage): Promise<Caller | null> {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const token = await auth.verifyIdToken(header.slice(7), true);
    return { uid: token.uid, name: token.name as string | undefined };
  } catch {
    throw new HttpsError('unauthenticated', 'Your session has expired. Please sign in again.');
  }
}

function secretMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function maintenance(req: IncomingMessage, res: ServerResponse) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secretMatches(req.headers.authorization ?? '', `Bearer ${secret}`)) return send(res, 401, { error: 'unauthorised' });
  const m = new MaintenanceService();
  const { result, intents } = await withPushScope(async () => ({ escalated: await m.escalateOverdue(), closed: await m.autoCloseResolved() }));
  await deliverPushes(intents);
  await writeLog('INFO', 'cron.maintenance', `Scheduled run: ${result.escalated} escalated, ${result.closed} closed`).catch(() => {});
  send(res, 200, result);
}

/** Request handler compatible with Node `http.createServer` and Vercel serverless functions. */
export async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const path = (req.url ?? '').split('?')[0]!.replace(/\/+$/, '');
  cors(req, res);
  if (req.method === 'OPTIONS') return send(res, 204, null);
  try {
    if (path.endsWith('/cron/maintenance')) return await maintenance(req, res);
    const name = path.split('/').pop() as CommandName;
    const def = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : undefined;
    if (!def) return sendError(res, new HttpsError('not-found', 'Unknown command'));
    if (req.method !== 'POST') return sendError(res, new HttpsError('invalid-argument', 'Use POST'));
    const caller = await verifyCaller(req);
    const body = await readJson(req);
    const result = await execute(def as never, caller, body.data ?? {});
    send(res, 200, { result: result ?? null });
  } catch (err) {
    sendError(res, err instanceof HttpsError ? err : new HttpsError('internal', 'Something went wrong. Please try again.'));
  }
}

export default handleHttp;
