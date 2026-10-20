import { smsAlertText, toE164ZA, type AlertType, type SmsDoc } from '@civiclink/shared';
import { col, db, ts } from '../lib/firebase';
import { writeLog } from './logService';

/**
 * FR-25: SMS for emergency alerts, for residents who opted in (BR-25). The gateway is chosen by
 * configuration: Twilio when its credentials are set, otherwise a simulated gateway that records
 * the message without sending it (local, CI and the free deployment). Every message is kept in
 * `smsOutbox` with its status, so delivery can be audited either way.
 */
export interface SmsGateway {
  readonly name: string;
  send(to: string, body: string): Promise<{ id: string; simulated?: boolean }>;
}

class SimulatedGateway implements SmsGateway {
  readonly name = 'simulated';
  async send() {
    return { id: `sim-${Math.random().toString(36).slice(2, 10)}`, simulated: true };
  }
}

class TwilioGateway implements SmsGateway {
  readonly name = 'twilio';
  constructor(
    private readonly sid: string,
    private readonly token: string,
    private readonly from: string,
  ) {}

  async send(to: string, body: string) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: this.from, Body: body }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok || !json.sid) throw new Error(json.message ?? `Gateway responded ${res.status}`);
    return { id: json.sid };
  }
}

function gatewayFromEnv(): SmsGateway {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
  return sid && token && from ? new TwilioGateway(sid, token, from) : new SimulatedGateway();
}

let gateway: SmsGateway | null = null;
/** Tests replace the gateway with a fake. */
export function setSmsGateway(g: SmsGateway | null) {
  gateway = g;
}

/** Name of the gateway in use ("twilio" or "simulated"), for the admin screen. */
export function smsGatewayName() {
  return (gateway ??= gatewayFromEnv()).name;
}

/** FR-25: an administrator checks the gateway by sending one SMS; recorded in smsOutbox like any other. */
export async function sendTestSms(to: string, actor: { uid: string; name: string }, now: number) {
  const g = (gateway ??= gatewayFromEnv());
  const body = 'CivicLink test: SMS alerts are working.';
  const ref = col.smsOutbox().doc();
  const sms: SmsDoc = { uid: actor.uid, to: toE164ZA(to), body, alertId: 'test', status: 'QUEUED', gateway: g.name, createdAt: ts(now), sentAt: null };
  await ref.set(sms);
  try {
    const res = await g.send(sms.to, body);
    const status = res.simulated ? 'SIMULATED' : 'SENT';
    await ref.update({ status, providerId: res.id, sentAt: ts(Date.now()) });
    return { status, gateway: g.name } as const;
  } catch (err) {
    const error = (err as Error).message.slice(0, 200);
    await ref.update({ status: 'FAILED', error });
    await writeLog('WARNING', 'sms.test', `Test SMS by ${actor.name} failed: ${error}`, actor.uid);
    return { status: 'FAILED' as const, gateway: g.name, error };
  }
}

const CONCURRENCY = 5;

export interface SmsRecipient {
  uid: string;
  phone: string;
}

/** Queues one SMS per recipient, then sends them; returns how many were queued. */
export async function sendAlertSms(alertId: string, alert: { type: AlertType; title: string; message: string }, recipients: SmsRecipient[], now: number) {
  if (recipients.length === 0) return 0;
  const g = (gateway ??= gatewayFromEnv());
  const body = smsAlertText(alert.type, alert.title, alert.message);
  const docs = recipients.map((r) => ({ ref: col.smsOutbox().doc(), r }));
  for (let i = 0; i < docs.length; i += 450) {
    const batch = db.batch();
    for (const { ref, r } of docs.slice(i, i + 450)) {
      const sms: SmsDoc = { uid: r.uid, to: toE164ZA(r.phone), body, alertId, status: 'QUEUED', gateway: g.name, createdAt: ts(now), sentAt: null };
      batch.set(ref, sms);
    }
    await batch.commit();
  }
  let failed = 0;
  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    await Promise.all(
      docs.slice(i, i + CONCURRENCY).map(async ({ ref, r }) => {
        try {
          const res = await g.send(toE164ZA(r.phone), body);
          await ref.update({ status: res.simulated ? 'SIMULATED' : 'SENT', providerId: res.id, sentAt: ts(Date.now()) });
        } catch (err) {
          failed++;
          await ref.update({ status: 'FAILED', error: (err as Error).message.slice(0, 200) });
        }
      }),
    );
  }
  if (failed) await writeLog('WARNING', 'sms.send', `${failed} of ${docs.length} SMS for alert ${alertId} failed`);
  return docs.length;
}
