import { ResolutionPolicy, SlaPolicy, type DepartmentDoc, type ReportDoc } from '@civiclink/shared';
import { col, db, ts } from '../lib/firebase';
import { NotificationService } from './notificationService';
import { applyTransition, getReport, SYSTEM_ACTOR } from './reportLifecycle';
import { writeLog } from './logService';

/**
 * Scheduled rules: SLA escalation (FR-13, BR-10) and auto-close (FR-14, BR-11).
 * Each report is re-checked inside its own transaction so a concurrent change wins safely and reruns are idempotent.
 */
export class MaintenanceService {
  constructor(private readonly clock: () => number = Date.now) {}

  async escalateOverdue(): Promise<number> {
    const now = this.clock();
    const depts = new Map(
      (await col.departments().get()).docs.map((d) => [d.id, (d.data() as DepartmentDoc).slaHours]),
    );
    const open = await col.reports().where('status', 'in', ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS']).get();
    let escalated = 0;
    for (const doc of open.docs) {
      const r = doc.data() as ReportDoc;
      const sla = depts.get(r.departmentId);
      if (!sla || !SlaPolicy.isBreached({ status: r.status, createdAt: r.createdAt.toMillis(), escalatedAt: r.escalatedAt?.toMillis() }, sla, now)) continue;
      const done = await db.runTransaction(async (tx) => {
        const { ref, report } = await getReport(tx, doc.id);
        if (!SlaPolicy.isBreached({ status: report.status, createdAt: report.createdAt.toMillis(), escalatedAt: report.escalatedAt?.toMillis() }, sla, now)) return false;
        const officials = await NotificationService.departmentOfficials(tx, report.departmentId);
        applyTransition(tx, {
          ref, report, event: 'escalate', actor: SYSTEM_ACTOR, as: 'SYSTEM', now,
          note: `Automatically escalated: not resolved within the ${sla}-hour SLA`,
          patch: { escalatedAt: ts(now) },
        });
        NotificationService.add(tx, officials, { type: 'NEW_REPORT', title: `${report.ref} escalated`, body: `SLA of ${sla} h exceeded`, link: `/official/reports/${report.id}` }, now);
        return true;
      });
      if (done) escalated++;
    }
    if (escalated) await writeLog('WARNING', 'schedule.escalateOverdue', `${escalated} report(s) escalated for SLA breach`);
    return escalated;
  }

  async autoCloseResolved(): Promise<number> {
    const now = this.clock();
    const resolved = await col.reports().where('status', '==', 'RESOLVED').get();
    let closed = 0;
    for (const doc of resolved.docs) {
      const r = doc.data() as ReportDoc;
      if (!ResolutionPolicy.shouldAutoClose({ status: r.status, resolvedAt: r.resolvedAt?.toMillis() }, now)) continue;
      const done = await db.runTransaction(async (tx) => {
        const { ref, report } = await getReport(tx, doc.id);
        if (!ResolutionPolicy.shouldAutoClose({ status: report.status, resolvedAt: report.resolvedAt?.toMillis() }, now)) return false;
        applyTransition(tx, {
          ref, report, event: 'autoClose', actor: SYSTEM_ACTOR, as: 'SYSTEM', now,
          note: 'Closed automatically after 7 days without a response', patch: { closedAt: ts(now) },
        });
        return true;
      });
      if (done) closed++;
    }
    if (closed) await writeLog('INFO', 'schedule.autoCloseResolved', `${closed} resolved report(s) closed`);
    return closed;
  }
}
