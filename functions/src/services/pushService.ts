import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getMessaging } from 'firebase-admin/messaging';
import { FieldValue } from 'firebase-admin/firestore';
import { col, db } from '../lib/firebase';
import { writeLog } from './logService';

/**
 * FR-24: best-effort web push, delivered only AFTER a command has committed.
 * NotificationService records an intent per recipient inside the request scope; transaction retries
 * re-record the same intents, which are de-duplicated by recipient + link + title. execute() flushes
 * them once the handler has succeeded, so a rolled-back command never pushes anything.
 */
export interface PushIntent {
  uid: string;
  title: string;
  body: string;
  link: string;
}

/** Minimal sender interface (Firebase Admin Messaging in production; a fake in tests). */
export interface PushSender {
  sendEachForMulticast(message: {
    tokens: string[];
    data: Record<string, string>;
    webpush: { headers: Record<string, string> };
  }): Promise<{ responses: { success: boolean; error?: { code: string } }[] }>;
}

const scope = new AsyncLocalStorage<Map<string, PushIntent>>();
let sender: PushSender | null | undefined;

/** Tests inject a fake sender; `null` disables sending. Default: real FCM, except against emulators. */
export function setPushSender(s: PushSender | null) {
  sender = s;
}
function currentSender(): PushSender | null {
  if (sender !== undefined) return sender;
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR === 'true') return null;
  return getMessaging() as unknown as PushSender;
}

export function recordPush(intent: PushIntent) {
  scope.getStore()?.set(`${intent.uid}|${intent.link}|${intent.title}`, intent);
}

/** Runs `fn` with a push scope and returns its result together with the recorded intents. */
export async function withPushScope<T>(fn: () => Promise<T>): Promise<{ result: T; intents: PushIntent[] }> {
  const store = new Map<string, PushIntent>();
  const result = await scope.run(store, fn);
  return { result, intents: [...store.values()] };
}

export const tokenId = (token: string) => createHash('sha256').update(token).digest('hex').slice(0, 40);

async function tokensFor(uids: string[]): Promise<Map<string, { token: string; ref: FirebaseFirestore.DocumentReference }[]>> {
  const out = new Map<string, { token: string; ref: FirebaseFirestore.DocumentReference }[]>();
  for (let i = 0; i < uids.length; i += 30) {
    const snap = await db.collectionGroup('pushTokens').where('uid', 'in', uids.slice(i, i + 30)).get();
    for (const d of snap.docs) {
      const uid = d.get('uid') as string;
      out.set(uid, [...(out.get(uid) ?? []), { token: d.get('token') as string, ref: d.ref }]);
    }
  }
  return out;
}

const DEAD = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

/** Sends intents to every registered device of each recipient; prunes dead tokens. Never throws. */
export async function deliverPushes(intents: PushIntent[]): Promise<{ sent: number; pruned: number }> {
  const s = currentSender();
  if (!s || intents.length === 0) return { sent: 0, pruned: 0 };
  let sent = 0;
  let pruned = 0;
  try {
    const tokens = await tokensFor([...new Set(intents.map((i) => i.uid))]);
    for (const intent of intents) {
      const devices = tokens.get(intent.uid) ?? [];
      if (!devices.length) continue;
      const res = await s.sendEachForMulticast({
        tokens: devices.map((d) => d.token),
        data: { title: intent.title, body: intent.body.slice(0, 200), link: intent.link },
        webpush: { headers: { Urgency: 'high', TTL: '86400' } },
      });
      for (const [i, r] of res.responses.entries()) {
        if (r.success) sent++;
        else if (r.error && DEAD.has(r.error.code)) {
          await devices[i]!.ref.delete();
          pruned++;
        }
      }
    }
  } catch (err) {
    await writeLog('WARNING', 'push', `Push delivery failed: ${err instanceof Error ? err.message : String(err)}`).catch(() => {});
  }
  return { sent, pruned };
}

/** FR-24: device registration (users/{uid}/pushTokens, server-only). */
export const PushTokens = {
  async register(uid: string, token: string) {
    await col.users().doc(uid).collection('pushTokens').doc(tokenId(token)).set({ uid, token, createdAt: FieldValue.serverTimestamp() });
    return { ok: true as const };
  },
  async unregister(uid: string, token: string) {
    await col.users().doc(uid).collection('pushTokens').doc(tokenId(token)).delete();
    return { ok: true as const };
  },
};
