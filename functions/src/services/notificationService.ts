import type { NotificationDoc, NotificationType } from '@civiclink/shared';
import type { Transaction } from 'firebase-admin/firestore';
import { col, ts } from '../lib/firebase';
import { recordPush } from './pushService';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  link: string;
}

/** FR-15: in-app notifications, written inside the caller's transaction so they commit with the change. */
export const NotificationService = {
  add(tx: Transaction, recipients: Iterable<string>, n: NotificationInput, now: number) {
    for (const uid of new Set(recipients)) {
      if (uid === 'deleted-user') continue; // reporter deleted their account (BR-22)
      const doc: NotificationDoc = { ...n, readAt: null, createdAt: ts(now) };
      tx.set(col.notifications(uid).doc(), doc);
      recordPush({ uid, title: n.title, body: n.body, link: n.link }); // FR-24, sent after commit
    }
  },

  /** Active officials of a department, read outside a transaction (no locks). */
  async departmentOfficialsNow(departmentId: string): Promise<string[]> {
    const snap = await col.users().where('role', '==', 'OFFICIAL').where('departmentId', '==', departmentId).where('isActive', '==', true).get();
    return snap.docs.map((d) => d.id);
  },

  /** Active officials of a department, read before any transaction writes. */
  async departmentOfficials(tx: Transaction, departmentId: string): Promise<string[]> {
    const snap = await tx.get(
      col.users().where('role', '==', 'OFFICIAL').where('departmentId', '==', departmentId).where('isActive', '==', true),
    );
    return snap.docs.map((d) => d.id);
  },
};

export const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  IN_PROGRESS: 'In progress',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  DUPLICATE: 'Duplicate',
};
