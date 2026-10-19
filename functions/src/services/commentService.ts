import type { CommentDoc, ReportDoc } from '@civiclink/shared';
import type { Actor } from '../lib/command';
import { denied, notFound } from '../lib/errors';
import { col, ts } from '../lib/firebase';

/** FR-22 / BR-18: internal staff comments, never visible to residents. */
export class CommentService {
  constructor(private readonly clock: () => number = Date.now) {}

  async add(reportId: string, text: string, actor: Actor) {
    const report = (await col.reports().doc(reportId).get()).data() as ReportDoc | undefined;
    if (!report) throw notFound('Report');
    const allowed =
      actor.role === 'ADMIN' ||
      (actor.role === 'OFFICIAL' && actor.departmentId === report.departmentId) ||
      (actor.role === 'FIELD_WORKER' && report.assignedWorkerId === actor.uid);
    if (!allowed) throw denied('You cannot comment on this report');
    const doc: CommentDoc = { authorId: actor.uid, authorName: actor.name, authorRole: actor.role, text, createdAt: ts(this.clock()) };
    const ref = await col.comments(reportId).add(doc);
    return { commentId: ref.id };
  }
}
