import {
  ALL_SUBURBS,
  validateAlertExpiry,
  validateAlertSchedule,
  type AlertDoc,
  type AlertRecipientDoc,
  type AlertType,
  type ScheduledAlertDoc,
} from '@civiclink/shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { z } from 'zod';
import type { broadcastAlertSchema } from '@civiclink/shared';
import type { Actor } from '../lib/command';
import { invalid, notFound, precondition } from '../lib/errors';
import { col, db, ts } from '../lib/firebase';
import { writeLog } from './logService';
import { recordPush } from './pushService';
import { sendAlertSms } from './smsService';

const BATCH_LIMIT = 450;

interface AlertContent {
  type: AlertType;
  title: string;
  message: string;
  targetSuburbs: string[];
  expiresAt: number;
  createdBy: string;
  createdByName: string;
}

export class AlertService {
  constructor(private readonly clock: () => number = Date.now) {}

  /**
   * FR-16 / BR-13: store the alert and one delivery record per targeted active resident.
   * FR-28: with a future publishAt the alert is kept in scheduledAlerts until the maintenance run publishes it.
   */
  async broadcast(input: z.infer<typeof broadcastAlertSchema>, actor: Actor) {
    const now = this.clock();
    const expiryError = validateAlertExpiry(input.expiresAt, now);
    if (expiryError) throw invalid('expiresAt', expiryError);
    const content: AlertContent = {
      type: input.type, title: input.title, message: input.message, targetSuburbs: input.targetSuburbs,
      expiresAt: input.expiresAt, createdBy: actor.uid, createdByName: actor.name,
    };

    if (input.publishAt !== undefined) {
      const scheduleError = validateAlertSchedule(input.publishAt, input.expiresAt, now);
      if (scheduleError) throw invalid('publishAt', scheduleError);
      const ref = col.scheduledAlerts().doc();
      const scheduled: ScheduledAlertDoc = {
        ...content, expiresAt: ts(input.expiresAt), publishAt: ts(input.publishAt), status: 'SCHEDULED', createdAt: ts(now), publishedAt: null,
      };
      await ref.set(scheduled);
      return { alertId: ref.id, recipientCount: 0, scheduled: true };
    }

    const alertId = col.alerts().doc().id;
    const { recipientCount } = await this.publish(alertId, content, now);
    return { alertId, recipientCount, scheduled: false };
  }

  /** Creates the alert with the given id plus delivery records and push messages. `create` makes a rerun a no-op. */
  private async publish(alertId: string, content: AlertContent, now: number) {
    let residents = col.users().where('role', '==', 'RESIDENT').where('isActive', '==', true);
    if (!content.targetSuburbs.includes(ALL_SUBURBS)) residents = residents.where('suburb', 'in', content.targetSuburbs);
    const residentDocs = (await residents.select('phone', 'smsAlerts').get()).docs;
    const recipients = residentDocs.map((d) => d.id);
    // FR-25 / BR-25: emergency alerts also go by SMS to residents who opted in and gave a number.
    const smsRecipients =
      content.type === 'EMERGENCY'
        ? residentDocs.filter((d) => d.get('smsAlerts') === true && d.get('phone')).map((d) => ({ uid: d.id, phone: d.get('phone') as string }))
        : [];

    const alertRef = col.alerts().doc(alertId);
    const alert: AlertDoc = {
      type: content.type,
      title: content.title,
      message: content.message,
      targetSuburbs: content.targetSuburbs,
      createdBy: content.createdBy,
      createdByName: content.createdByName,
      isActive: true,
      recipientCount: recipients.length,
      readCount: 0,
      createdAt: ts(now),
      expiresAt: ts(content.expiresAt),
    };
    await alertRef.create(alert);

    for (let i = 0; i < recipients.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const uid of recipients.slice(i, i + BATCH_LIMIT)) {
        const r: AlertRecipientDoc = { uid, alertId, channel: 'IN_APP', deliveredAt: ts(now), readAt: null };
        batch.set(col.recipients(alertId).doc(uid), r);
      }
      await batch.commit();
    }
    for (const uid of recipients) {
      recordPush({ uid, title: `${content.type === 'EMERGENCY' ? 'Emergency: ' : ''}${content.title}`, body: content.message, link: '/resident/alerts' });
    }
    const smsCount = await sendAlertSms(alertId, content, smsRecipients, now);
    if (smsCount) await alertRef.update({ smsCount });
    return { recipientCount: recipients.length, smsCount };
  }

  /**
   * FR-28: publishes scheduled alerts whose time has come (run by the maintenance schedule).
   * Each is claimed in a transaction (SCHEDULED → PUBLISHED) so overlapping runs publish it once;
   * the alert keeps the scheduled id. Alerts that expired while waiting are cancelled instead.
   */
  async publishDue(): Promise<number> {
    const now = this.clock();
    const due = await col.scheduledAlerts().where('status', '==', 'SCHEDULED').where('publishAt', '<=', ts(now)).get();
    let published = 0;
    for (const doc of due.docs) {
      const claimed = await db.runTransaction(async (tx) => {
        const s = (await tx.get(doc.ref)).data() as ScheduledAlertDoc | undefined;
        if (!s || s.status !== 'SCHEDULED') return null;
        const expired = s.expiresAt.toMillis() <= now;
        tx.update(doc.ref, { status: expired ? 'CANCELLED' : 'PUBLISHED', publishedAt: expired ? null : ts(now) });
        return expired ? null : s;
      });
      if (!claimed) continue;
      const { recipientCount } = await this.publish(doc.id, {
        type: claimed.type, title: claimed.title, message: claimed.message, targetSuburbs: claimed.targetSuburbs,
        expiresAt: claimed.expiresAt.toMillis(), createdBy: claimed.createdBy, createdByName: claimed.createdByName,
      }, now);
      await doc.ref.update({ recipientCount });
      published++;
    }
    if (published) await writeLog('INFO', 'schedule.publishAlerts', `${published} scheduled alert(s) published`);
    return published;
  }

  /** FR-28: an official cancels a scheduled alert before it is published. */
  async cancelScheduled(scheduledId: string, actor: Actor) {
    await db.runTransaction(async (tx) => {
      const ref = col.scheduledAlerts().doc(scheduledId);
      const s = (await tx.get(ref)).data() as ScheduledAlertDoc | undefined;
      if (!s) throw notFound('Scheduled alert');
      if (s.status !== 'SCHEDULED') throw precondition('This alert has already been published or cancelled');
      tx.update(ref, { status: 'CANCELLED' });
    });
    await writeLog('INFO', 'alert.cancelScheduled', `${actor.name} cancelled a scheduled alert`, actor.uid);
    return { ok: true as const };
  }

  /** FR-18: hide an alert from residents immediately. */
  async deactivate(alertId: string) {
    const ref = col.alerts().doc(alertId);
    if (!(await ref.get()).exists) throw notFound('Alert');
    await ref.update({ isActive: false });
    return { ok: true as const };
  }

  /** FR-17: read receipt, counted once per resident. Residents who joined after the broadcast get a record on first read. */
  async markRead(alertId: string, actor: Actor) {
    return db.runTransaction(async (tx) => {
      const now = this.clock();
      const alertRef = col.alerts().doc(alertId);
      const alert = (await tx.get(alertRef)).data() as AlertDoc | undefined;
      if (!alert) throw notFound('Alert');
      const recRef = col.recipients(alertId).doc(actor.uid);
      const rec = (await tx.get(recRef)).data() as AlertRecipientDoc | undefined;
      if (rec?.readAt) return { ok: true as const };
      tx.set(recRef, { uid: actor.uid, alertId, channel: 'IN_APP', deliveredAt: rec?.deliveredAt ?? ts(now), readAt: ts(now) });
      tx.update(alertRef, { readCount: FieldValue.increment(1) });
      return { ok: true as const };
    });
  }
}
