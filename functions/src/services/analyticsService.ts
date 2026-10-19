import { computeAnalytics, type DepartmentDoc, type ReportDoc } from '@civiclink/shared';
import { col } from '../lib/firebase';

/** FR-19: computed from live data on demand with the tested pure function in the shared package. */
export class AnalyticsService {
  constructor(private readonly clock: () => number = Date.now) {}

  async summary(days: number) {
    const [reports, departments] = await Promise.all([
      col.reports().select('status', 'categoryId', 'departmentId', 'createdAt', 'resolvedAt').get(),
      col.departments().get(),
    ]);
    return computeAnalytics(
      reports.docs.map((d) => {
        const r = d.data() as Pick<ReportDoc, 'status' | 'categoryId' | 'departmentId' | 'createdAt' | 'resolvedAt'>;
        return { status: r.status, categoryId: r.categoryId, departmentId: r.departmentId, createdAt: r.createdAt.toMillis(), resolvedAt: r.resolvedAt?.toMillis() ?? null };
      }),
      departments.docs.map((d) => ({ id: d.id, name: (d.data() as DepartmentDoc).name, slaHours: (d.data() as DepartmentDoc).slaHours })),
      this.clock(),
      days,
    );
  }
}
