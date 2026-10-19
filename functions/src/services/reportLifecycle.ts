import {
  OPEN_REPORT_STATUSES,
  ReportStateMachine,
  type Actor as MachineActor,
  type HistoryDoc,
  type ReportDoc,
  type ReportEvent,
  type ReportStatus,
} from '@civiclink/shared';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import type { Actor } from '../lib/command';
import { denied, notFound } from '../lib/errors';
import { col, ts } from '../lib/firebase';
import { NotificationService, STATUS_LABEL } from './notificationService';

export type ReportWithId = ReportDoc & { id: string };
export const SYSTEM_ACTOR: Actor = { uid: 'system', role: 'ADMIN', name: 'CivicLink system', departmentId: null, suburb: null };

export async function getReport(tx: Transaction, reportId: string): Promise<{ ref: DocumentReference; report: ReportWithId }> {
  const ref = col.reports().doc(reportId);
  const snap = await tx.get(ref);
  if (!snap.exists) throw notFound('Report');
  return { ref, report: { id: snap.id, ...(snap.data() as ReportDoc) } };
}

/** BR-20: officials act only on their own department's reports; admins on any. */
export function assertDepartmentAccess(actor: Actor, departmentId: string) {
  if (actor.role === 'ADMIN') return;
  if (actor.role === 'OFFICIAL' && actor.departmentId === departmentId) return;
  throw denied('This report belongs to another department');
}

interface TransitionArgs {
  ref: DocumentReference;
  report: ReportWithId;
  event: ReportEvent;
  actor: Actor;
  /** 'SYSTEM' for scheduled transitions. */
  as?: MachineActor;
  note: string;
  now: number;
  patch?: Partial<Record<keyof ReportDoc, unknown>>;
  notifyReporter?: boolean;
}

/**
 * The single path for report status changes (BR-05): validates the transition against the state
 * machine, updates the report, appends an immutable history entry, refreshes the public projection
 * and notifies the reporter and followers. Must be called after all transaction reads.
 */
export function applyTransition(tx: Transaction, a: TransitionArgs): ReportStatus {
  const machineActor = a.as ?? a.actor.role;
  const to = ReportStateMachine.next(a.report.status, a.event, machineActor);
  tx.update(a.ref, { ...a.patch, status: to, updatedAt: ts(a.now) });

  const history: HistoryDoc = {
    from: a.report.status,
    to,
    event: a.event,
    actorId: a.actor.uid,
    actorRole: machineActor,
    actorName: a.actor.name,
    note: a.note,
    at: ts(a.now),
  };
  tx.set(col.history(a.report.id).doc(), history);
  tx.set(
    col.publicReports().doc(a.report.id),
    { status: to, isOpen: OPEN_REPORT_STATUSES.includes(to) },
    { merge: true },
  );

  if (a.notifyReporter !== false) {
    NotificationService.add(
      tx,
      [a.report.reporterId, ...(a.report.followerIds ?? [])],
      {
        type: 'REPORT_STATUS',
        title: `${a.report.ref} is ${STATUS_LABEL[to]?.toLowerCase()}`,
        body: a.note,
        link: `/resident/reports/${a.report.id}`,
      },
      a.now,
    );
  }
  return to;
}
