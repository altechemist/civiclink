import { ALL_SUBURBS, validateAlertExpiry, type AlertDoc, type AlertRecipientDoc } from '@civiclink/shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { z } from 'zod';
import type { broadcastAlertSchema } from '@civiclink/shared';
import type { Actor } from '../lib/command';
import { invalid, notFound } from '../lib/errors';
import { col, db, ts } from '../lib/firebase';

const BATCH_LIMIT = 450;

export class AlertService {
  constructor(private readonly clock: () => number = Date.now) {}

  /**
   * FR-16 / BR-13: store the alert and one delivery record per targeted active resident.
   * Recipients are written in batches after the alert; recipientCount reflects the delivered set.
   */
  async broadcast(input: z.infer<typeof broadcastAlertSchema>, actor: Actor) {
    const now = this.clock();
    const expiryError = validateAlertExpiry(input.expiresAt, now);
    if (expiryError) throw invalid('expiresAt', expiryError);

    let residents = col.users().where('role', '==', 'RESIDENT').where('isActive', '==', true);
    if (!input.targetSuburbs.includes(ALL_SUBURBS)) residents = residents.where('suburb', 'in', input.targetSuburbs);
    const recipients = (await residents.select().get()).docs.map((d) => d.id);

    const alertRef = col.alerts().doc();
    const alert: AlertDoc = {
      type: input.type,
      title: input.title,
      message: input.message,
      targetSuburbs: input.targetSuburbs,
      createdBy: actor.uid,
      createdByName: actor.name,
      isActive: true,
      recipientCount: recipients.length,
      readCount: 0,
      createdAt: ts(now),
      expiresAt: ts(input.expiresAt),
    };
    await alertRef.set(alert);

    for (let i = 0; i < recipients.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const uid of recipients.slice(i, i + BATCH_LIMIT)) {
        const r: AlertRecipientDoc = { uid, alertId: alertRef.id, channel: 'IN_APP', deliveredAt: ts(now), readAt: null };
        batch.set(col.recipients(alertRef.id).doc(uid), r);
      }
      await batch.commit();
    }
    return { alertId: alertRef.id, recipientCount: recipients.length };
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
