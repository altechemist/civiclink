import {
  approximateLocation,
  DuplicatePolicy,
  formatReference,
  LIMITS,
  ResolutionPolicy,
  type CategoryDoc,
  type DepartmentDoc,
  type DuplicateCandidate,
  type HistoryDoc,
  type PublicReportDoc,
  type ReportDoc,
  type TaskDoc,
  type UserDoc,
} from '@civiclink/shared';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { geohashForLocation, geohashQueryBounds } from 'geofire-common';
import type { z } from 'zod';
import type {
  assignReportSchema,
  escalateReportSchema,
  rejectReportSchema,
  reopenReportSchema,
  submitReportSchema,
  triageReportSchema,
} from '@civiclink/shared';
import type { Actor } from '../lib/command';
import { DomainError, denied, invalid, notFound, precondition } from '../lib/errors';
import { col, ts } from '../lib/firebase';
import { decodePhotos, writePhotos } from './photoService';
import { NotificationService } from './notificationService';
import { applyTransition, assertDepartmentAccess, getReport, type ReportWithId } from './reportLifecycle';

type SubmitInput = z.infer<typeof submitReportSchema>;

export class ReportService {
  constructor(private readonly clock: () => number = Date.now) {}

  /**
   * TX-1 (FR-03, FR-04, FR-05): validates category, allocates the reference, detects duplicates,
   * and writes report + history + public projection + notifications atomically.
   */
  async submit(input: SubmitInput, actor: Actor) {
    const photos = decodePhotos(input.photos, 'photos');
    const { lat, lng } = input.location;
    const geohash = geohashForLocation([lat, lng]);
    const bounds = geohashQueryBounds([lat, lng], LIMITS.duplicateRadiusM);

    // Reads that need no transactional isolation happen first, keeping TX-1's lock set small so
    // concurrent submissions only contend on the reference counter (NFR-10).
    const [reporterSnap, settingsSnap, categorySnapPre] = await Promise.all([
      col.users().doc(actor.uid).get(),
      col.settings().get(),
      col.categories().doc(input.categoryId).get(),
    ]);
    const reporter = reporterSnap.data() as UserDoc;
    // BR-21: abuse prevention, at most N reports per resident per rolling hour (admin-configurable).
    const perHour = (settingsSnap.data()?.reportsPerHour as number | undefined) ?? LIMITS.reportsPerHour;
    const recent = await col.reports().where('reporterId', '==', actor.uid).where('createdAt', '>=', ts(this.clock() - 3600_000)).count().get();
    if (recent.data().count >= perHour) {
      throw new DomainError('resource-exhausted', `You have submitted ${perHour} reports in the last hour. Please wait before reporting again.`);
    }
    const preDepartment = (categorySnapPre.data() as CategoryDoc | undefined)?.departmentId;
    const officialsOfDept = preDepartment ? await NotificationService.departmentOfficialsNow(preDepartment) : [];

    return col.reports().firestore.runTransaction(async (tx) => {
      const now = this.clock();
      // ---- reads ----
      const categorySnap = await tx.get(col.categories().doc(input.categoryId));
      const category = categorySnap.data() as CategoryDoc | undefined;
      if (!category || !category.isActive) throw invalid('categoryId', 'Choose an available category'); // BR-19
      const dept = (await tx.get(col.departments().doc(category.departmentId))).data() as DepartmentDoc | undefined;
      if (!dept) throw precondition('Category is not linked to a department');

      const candidateSnaps = await Promise.all(
        bounds.map(([start, end]) => tx.get(col.reports().orderBy('geohash').startAt(start).endAt(end))),
      );
      const candidates: (DuplicateCandidate & { doc: ReportDoc })[] = candidateSnaps
        .flatMap((s) => s.docs)
        .map((d) => {
          const doc = d.data() as ReportDoc;
          return { id: d.id, categoryId: doc.categoryId, status: doc.status, location: doc.location, createdAt: doc.createdAt.toMillis(), doc };
        });
      const parent = DuplicatePolicy.findParent({ categoryId: input.categoryId, location: input.location }, candidates, now);

      const year = new Date(now).getUTCFullYear();
      const counterRef = col.counters().doc(`reports-${year}`);
      const sequence = (((await tx.get(counterRef)).data()?.next as number | undefined) ?? 0) + 1;
      const officials = parent ? [] : officialsOfDept;

      // ---- writes ----
      const ref = formatReference(year, sequence);
      tx.set(counterRef, { next: sequence }, { merge: true });
      const reportRef = col.reports().doc();
      const report: ReportDoc = {
        ref,
        reporterId: actor.uid,
        reporterName: reporter.name,
        categoryId: input.categoryId,
        categoryName: category.name,
        departmentId: category.departmentId,
        description: input.description,
        location: input.location,
        geohash,
        suburb: input.suburb,
        landmark: input.landmark || null,
        severity: input.severity,
        photoIds: [],
        status: parent ? 'DUPLICATE' : 'SUBMITTED',
        assignedWorkerId: null,
        assignedWorkerName: null,
        activeTaskId: null,
        parentReportId: parent?.id ?? null,
        parentRef: parent?.doc.ref ?? null,
        affectedCount: 1,
        followerIds: [],
        createdAt: ts(now),
        updatedAt: ts(now),
        resolvedAt: null,
        escalatedAt: null,
        closedAt: null,
      };
      report.photoIds = writePhotos(tx, photos, { reportId: reportRef.id, ownerId: actor.uid, kind: 'EVIDENCE' }, now);
      tx.set(reportRef, report);

      const history: HistoryDoc = {
        from: null,
        to: report.status,
        event: parent ? 'markDuplicate' : 'submit',
        actorId: parent ? 'system' : actor.uid,
        actorRole: parent ? 'SYSTEM' : 'RESIDENT',
        actorName: parent ? 'CivicLink system' : reporter.name,
        note: parent ? `Already reported as ${parent.doc.ref}` : 'Report submitted',
        at: ts(now),
      };
      tx.set(col.history(reportRef.id).doc(), history);

      if (parent) {
        // BR-03: link to the parent and follow its progress.
        tx.update(col.reports().doc(parent.id), {
          affectedCount: FieldValue.increment(1),
          followerIds: FieldValue.arrayUnion(actor.uid),
          updatedAt: ts(now),
        });
        tx.set(col.publicReports().doc(parent.id), { affectedCount: FieldValue.increment(1) }, { merge: true });
      } else {
        const pub: PublicReportDoc = {
          ref,
          categoryId: report.categoryId,
          categoryName: report.categoryName,
          status: 'SUBMITTED',
          location: approximateLocation(report.location),
          suburb: report.suburb,
          affectedCount: 1,
          isOpen: true,
          createdAt: ts(now),
        };
        tx.set(col.publicReports().doc(reportRef.id), pub);
        NotificationService.add(
          tx,
          officials,
          {
            type: 'NEW_REPORT',
            title: `New ${category.name} report ${ref}`,
            body: `${input.severity} severity in ${input.suburb}`,
            link: `/official/reports/${reportRef.id}`,
          },
          now,
        );
      }
      return {
        reportId: reportRef.id,
        ref,
        duplicateOf: parent ? { reportId: parent.id, ref: parent.doc.ref } : null,
      };
    });
  }

  /** FR-09: SUBMITTED → UNDER_REVIEW, optionally rerouting to another active department. */
  async triage(input: z.infer<typeof triageReportSchema>, actor: Actor) {
    return col.reports().firestore.runTransaction(async (tx) => {
      const now = this.clock();
      const { ref, report } = await getReport(tx, input.reportId);
      assertDepartmentAccess(actor, report.departmentId);
      let departmentId = report.departmentId;
      if (input.departmentId && input.departmentId !== report.departmentId) {
        const dept = (await tx.get(col.departments().doc(input.departmentId))).data() as DepartmentDoc | undefined;
        if (!dept || !dept.isActive) throw invalid('departmentId', 'Choose an active department'); // BR-19
        departmentId = input.departmentId;
      }
      const note = departmentId === report.departmentId ? 'Report reviewed' : 'Report reviewed and rerouted';
      const status = applyTransition(tx, { ref, report, event: 'triage', actor, note, now, patch: { departmentId } });
      return { status };
    });
  }

  /** FR-09 / BR-12: reject with a reason. */
  async reject(input: z.infer<typeof rejectReportSchema>, actor: Actor) {
    return col.reports().firestore.runTransaction(async (tx) => {
      const now = this.clock();
      const { ref, report } = await getReport(tx, input.reportId);
      assertDepartmentAccess(actor, report.departmentId);
      const status = applyTransition(tx, {
        ref, report, event: 'reject', actor, now, note: `Rejected: ${input.reason}`, patch: { closedAt: ts(now) },
      });
      return { status };
    });
  }

  /** FR-13: manual escalation with a reason. */
  async escalate(input: z.infer<typeof escalateReportSchema>, actor: Actor) {
    return col.reports().firestore.runTransaction(async (tx) => {
      const now = this.clock();
      const { ref, report } = await getReport(tx, input.reportId);
      assertDepartmentAccess(actor, report.departmentId);
      const status = applyTransition(tx, {
        ref, report, event: 'escalate', actor, now, note: `Escalated: ${input.reason}`, patch: { escalatedAt: ts(now) },
      });
      return { status };
    });
  }

  /** Reads and checks a field worker for assignment (BR-07). */
  private async eligibleWorker(tx: Transaction, workerId: string, report: ReportWithId) {
    const worker = (await tx.get(col.users().doc(workerId))).data() as UserDoc | undefined;
    if (!worker || worker.role !== 'FIELD_WORKER') throw invalid('workerId', 'Choose a field worker');
    if (!worker.isActive) throw invalid('workerId', 'This field worker is deactivated');
    if (worker.departmentId !== report.departmentId) throw invalid('workerId', "Worker is not in the report's department");
    return worker;
  }

  private newTask(report: ReportWithId, workerId: string, worker: UserDoc, actor: Actor, notes: string | undefined, now: number): TaskDoc {
    return {
      reportId: report.id,
      reportRef: report.ref,
      workerId,
      workerName: worker.name,
      assignedBy: actor.uid,
      departmentId: report.departmentId,
      categoryName: report.categoryName,
      priority: report.severity,
      status: 'ASSIGNED',
      location: report.location,
      suburb: report.suburb,
      notes: notes || null,
      completionNotes: null,
      proofIds: [],
      assignedAt: ts(now),
      acceptedAt: null,
      startedAt: null,
      completedAt: null,
      endedAt: null,
    };
  }

  /** TX-2 (FR-10): create the task and move the report to IN_PROGRESS; BR-06 re-checked inside the transaction. */
  async assign(input: z.infer<typeof assignReportSchema>, actor: Actor) {
    return col.reports().firestore.runTransaction(async (tx) => {
      const now = this.clock();
      const { ref, report } = await getReport(tx, input.reportId);
      assertDepartmentAccess(actor, report.departmentId);
      if (report.activeTaskId) throw precondition('This report already has an active task; reassign it instead'); // BR-06
      const worker = await this.eligibleWorker(tx, input.workerId, report);

      const taskRef = col.tasks().doc();
      tx.set(taskRef, this.newTask(report, input.workerId, worker, actor, input.notes, now));
      applyTransition(tx, {
        ref, report, event: 'assign', actor, now,
        note: `Assigned to ${worker.name}`,
        patch: { assignedWorkerId: input.workerId, assignedWorkerName: worker.name, activeTaskId: taskRef.id },
      });
      NotificationService.add(
        tx,
        [input.workerId],
        { type: 'TASK_ASSIGNED', title: `New task ${report.ref}`, body: `${report.categoryName} in ${report.suburb}`, link: `/worker/tasks/${taskRef.id}` },
        now,
      );
      return { taskId: taskRef.id };
    });
  }

  /** FR-12: end the active task as REASSIGNED and create a new one for another eligible worker. */
  async reassign(input: z.infer<typeof assignReportSchema>, actor: Actor) {
    return col.reports().firestore.runTransaction(async (tx) => {
      const now = this.clock();
      const { ref, report } = await getReport(tx, input.reportId);
      assertDepartmentAccess(actor, report.departmentId);
      if (!report.activeTaskId) throw precondition('This report has no active task to reassign');
      if (report.assignedWorkerId === input.workerId) throw invalid('workerId', 'Choose a different worker');
      const oldTaskRef = col.tasks().doc(report.activeTaskId);
      const oldTask = (await tx.get(oldTaskRef)).data() as TaskDoc | undefined;
      if (!oldTask) throw notFound('Active task');
      const worker = await this.eligibleWorker(tx, input.workerId, report);

      tx.update(oldTaskRef, { status: 'REASSIGNED', endedAt: ts(now) });
      const taskRef = col.tasks().doc();
      tx.set(taskRef, this.newTask(report, input.workerId, worker, actor, input.notes, now));
      applyTransition(tx, {
        ref, report, event: 'reassign', actor, now,
        note: `Reassigned from ${oldTask.workerName} to ${worker.name}`,
        patch: { assignedWorkerId: input.workerId, assignedWorkerName: worker.name, activeTaskId: taskRef.id },
        notifyReporter: false,
      });
      NotificationService.add(tx, [input.workerId], { type: 'TASK_ASSIGNED', title: `New task ${report.ref}`, body: `${report.categoryName} in ${report.suburb}`, link: `/worker/tasks/${taskRef.id}` }, now);
      NotificationService.add(tx, [oldTask.workerId], { type: 'TASK_UPDATE', title: `${report.ref} reassigned`, body: 'This task was moved to another worker', link: '/worker' }, now);
      return { taskId: taskRef.id };
    });
  }

  private async residentResolution(reportId: string, actor: Actor, tx: Transaction, now: number) {
    const { ref, report } = await getReport(tx, reportId);
    if (report.reporterId !== actor.uid) throw denied('Only the resident who reported this can do that'); // BR-11
    if (report.status !== 'RESOLVED' || !report.resolvedAt) throw precondition('Only resolved reports can be confirmed or reopened');
    if (!ResolutionPolicy.withinWindow(report.resolvedAt.toMillis(), now)) {
      throw precondition(`The ${LIMITS.reopenWindowDays}-day window to respond has passed`);
    }
    return { ref, report };
  }

  /** FR-14: resident confirms the fix (RESOLVED → CLOSED). */
  async confirm(reportId: string, actor: Actor) {
    return col.reports().firestore.runTransaction(async (tx) => {
      const now = this.clock();
      const { ref, report } = await this.residentResolution(reportId, actor, tx, now);
      const status = applyTransition(tx, { ref, report, event: 'confirm', actor, now, note: 'Resident confirmed the fix', patch: { closedAt: ts(now) }, notifyReporter: false });
      return { status };
    });
  }

  /** FR-14: resident reopens (RESOLVED → UNDER_REVIEW) with a reason; officials are notified. */
  async reopen(input: z.infer<typeof reopenReportSchema>, actor: Actor) {
    return col.reports().firestore.runTransaction(async (tx) => {
      const now = this.clock();
      const { ref, report } = await this.residentResolution(input.reportId, actor, tx, now);
      const officials = await NotificationService.departmentOfficials(tx, report.departmentId);
      const status = applyTransition(tx, {
        ref, report, event: 'reopen', actor, now, note: `Reopened: ${input.reason}`,
        patch: { resolvedAt: null, assignedWorkerId: null, assignedWorkerName: null, activeTaskId: null },
        notifyReporter: false,
      });
      NotificationService.add(tx, officials, { type: 'NEW_REPORT', title: `${report.ref} reopened`, body: input.reason, link: `/official/reports/${report.id}` }, now);
      return { status };
    });
  }
}
