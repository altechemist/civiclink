import { TaskStateMachine, type ReportDoc, type TaskDoc } from '@civiclink/shared';
import type { Transaction } from 'firebase-admin/firestore';
import type { z } from 'zod';
import type { completeTaskSchema, updateTaskSchema } from '@civiclink/shared';
import type { Actor } from '../lib/command';
import { denied, notFound, precondition } from '../lib/errors';
import { col, ts } from '../lib/firebase';
import { NotificationService } from './notificationService';
import { applyTransition } from './reportLifecycle';
import { assertPhotosExist } from './reportService';

export class TaskService {
  constructor(private readonly clock: () => number = Date.now) {}

  private async ownTask(tx: Transaction, taskId: string, actor: Actor) {
    const ref = col.tasks().doc(taskId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound('Task');
    const task = snap.data() as TaskDoc;
    if (task.workerId !== actor.uid) throw denied('This task is assigned to someone else'); // BR-08
    return { ref, task };
  }

  /** FR-11: accept or start, strictly in order (BR-08). The assigning official is notified. */
  async update(input: z.infer<typeof updateTaskSchema>, actor: Actor) {
    return col.tasks().firestore.runTransaction(async (tx) => {
      const now = this.clock();
      const { ref, task } = await this.ownTask(tx, input.taskId, actor);
      const report = (await tx.get(col.reports().doc(task.reportId))).data() as ReportDoc | undefined;
      if (!report) throw notFound('Report');
      const status = TaskStateMachine.next(task.status, input.action);
      tx.update(ref, { status, ...(input.action === 'accept' ? { acceptedAt: ts(now) } : { startedAt: ts(now) }) });
      // Task progress appears on the report timeline without changing the report status.
      tx.set(col.history(task.reportId).doc(), {
        from: report.status, to: report.status, event: `task.${input.action}`,
        actorId: actor.uid, actorRole: actor.role, actorName: actor.name,
        note: input.action === 'accept' ? `${actor.name} accepted the task` : `${actor.name} started work on site`,
        at: ts(now),
      });
      NotificationService.add(
        tx,
        [task.assignedBy],
        { type: 'TASK_UPDATE', title: `${task.reportRef}: task ${status.toLowerCase().replace('_', ' ')}`, body: actor.name, link: `/official/reports/${task.reportId}` },
        now,
      );
      return { status };
    });
  }

  /**
   * TX-3 (FR-11, BR-09): task COMPLETED and report RESOLVED in one transaction, so they can never
   * disagree. Refused if the report is no longer waiting on this task.
   */
  async complete(input: z.infer<typeof completeTaskSchema>, actor: Actor) {
    // Read the task once outside the transaction only to build the expected proof path prefix.
    const pre = (await col.tasks().doc(input.taskId).get()).data() as TaskDoc | undefined;
    if (!pre) throw notFound('Task');
    await assertPhotosExist(input.proofPaths, `proofs/${pre.reportId}/${actor.uid}`, 'proofPaths');

    return col.tasks().firestore.runTransaction(async (tx) => {
      const now = this.clock();
      const { ref, task } = await this.ownTask(tx, input.taskId, actor);
      const reportRef = col.reports().doc(task.reportId);
      const report = (await tx.get(reportRef)).data() as ReportDoc | undefined;
      if (!report) throw notFound('Report');
      if (report.activeTaskId !== input.taskId) throw precondition('This task is no longer active for the report');
      const status = TaskStateMachine.next(task.status, 'complete');

      tx.update(ref, { status, completionNotes: input.notes, proofPaths: input.proofPaths, completedAt: ts(now), endedAt: ts(now) });
      applyTransition(tx, {
        ref: reportRef,
        report: { id: reportRef.id, ...report },
        event: 'completeTask',
        actor,
        now,
        note: `Resolved by ${actor.name}: ${input.notes}`,
        patch: { resolvedAt: ts(now), activeTaskId: null, resolutionNotes: input.notes },
      });
      NotificationService.add(tx, [task.assignedBy], { type: 'TASK_UPDATE', title: `${task.reportRef} resolved`, body: input.notes, link: `/official/reports/${task.reportId}` }, now);
      return { status };
    });
  }
}
