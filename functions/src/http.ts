/**
 * Plain Node HTTP adapter for the command API (ADR-0006), used on Vercel so the system runs on
 * Firebase's free Spark plan (no Cloud Functions). It speaks the Firebase callable protocol, so the
 * web client calls it with `httpsCallableFromURL` and errors arrive exactly as from Cloud Functions.
 *
 *   POST /api/<command>          body {"data": …}, header Authorization: Bearer <Firebase ID token>
 *   GET  /api/cron/maintenance   header Authorization: Bearer <CRON_SECRET>   (SLA escalation, auto-close, scheduled alerts)
 *   GET  /api/public/stats       no sign-in; anonymous figures, cacheable by the CDN (FR-36, NFR-13)
 *   GET  /api/public/feed        no sign-in; open issues (≈100 m) and active alerts for the home page (FR-38)
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { HttpsError } from 'firebase-functions/v2/https';
import { COMMANDS, type CommandName } from './commands';
import { execute, type Caller } from './lib/command';
import { auth } from './lib/firebase';
import { AlertService } from './services/alertService';
import { MaintenanceService } from './services/maintenanceService';
import { PublicFeedService, PublicStatsService } from './services/publicStatsService';
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
    // Vercel sets x-forwarded-for; the first address is the client's.
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]!.trim();
    return { uid: token.uid, name: token.name as string | undefined, ip: forwarded || req.socket.remoteAddress };
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
  const { result, intents } = await withPushScope(() => m.runAll());
  await deliverPushes(intents);
  await writeLog('INFO', 'cron.maintenance', `Scheduled run: ${result.escalated} escalated, ${result.closed} closed, ${result.published} alert(s) published`).catch(() => {});
  send(res, 200, result);
}

/**
 * NFR-13: the CDN serves this response for 5 minutes and keeps serving the last copy for up to 10 more
 * while it refreshes, so a spike of public visitors costs at most one Firestore read set per 5 minutes.
 */
export const PUBLIC_STATS_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const publicStats = new PublicStatsService();
/** FR-38: alerts must be fresh, so the public feed is cached for one minute only. */
export const PUBLIC_FEED_CACHE = 'public, max-age=30, s-maxage=60, stale-while-revalidate=60';
const publicFeed = new PublicFeedService();

async function publicJson(req: IncomingMessage, res: ServerResponse, load: () => Promise<unknown>, cache: string) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Use GET' });
  const body = await load();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
}

/**
 * FR-28: while the site is in use, due scheduled alerts are published within about a minute, in the
 * background after the response (Vercel waitUntil). The hourly cron is the fallback when nobody is online.
 */
const ALERT_CHECK_MS = 60_000;
let lastAlertCheck = 0;
function publishDueAlertsInBackground() {
  if (Date.now() - lastAlertCheck < ALERT_CHECK_MS) return;
  lastAlertCheck = Date.now();
  waitUntil(
    withPushScope(() => new AlertService().publishDue())
      .then(({ intents }) => deliverPushes(intents))
      .catch((err: unknown) => writeLog('ERROR', 'alert.publishDue', String(err)).catch(() => {})),
  );
}

/** Request handler compatible with Node `http.createServer` and Vercel serverless functions. */
export async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const path = (req.url ?? '').split('?')[0]!.replace(/\/+$/, '');
  cors(req, res);
  if (req.method === 'OPTIONS') return send(res, 204, null);
  try {
    if (path.endsWith('/cron/maintenance')) return await maintenance(req, res);
    if (path.endsWith('/public/stats')) return await publicJson(req, res, () => publicStats.get(), PUBLIC_STATS_CACHE);
    if (path.endsWith('/public/feed')) return await publicJson(req, res, () => publicFeed.get(), PUBLIC_FEED_CACHE);
    const name = path.split('/').pop() as CommandName;
    const def = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : undefined;
    if (!def) return sendError(res, new HttpsError('not-found', 'Unknown command'));
    if (req.method !== 'POST') return sendError(res, new HttpsError('invalid-argument', 'Use POST'));
    const caller = await verifyCaller(req);
    const body = await readJson(req);
    const result = await execute(def as never, caller, body.data ?? {});
    send(res, 200, { result: result ?? null });
    publishDueAlertsInBackground();
  } catch (err) {
    sendError(res, err instanceof HttpsError ? err : new HttpsError('internal', 'Something went wrong. Please try again.'));
  }
}

export default handleHttp;
