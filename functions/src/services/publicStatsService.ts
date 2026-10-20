import { computeAnalytics, openBySuburb, summariseRatings, type CategoryDoc, type DepartmentDoc, type PublicStats, type ReportDoc } from '@civiclink/shared';
import { col } from '../lib/firebase';

const DAYS = 30;
/** Per-instance cache in front of the CDN cache (NFR-13): a warm instance recomputes at most once a minute. */
const TTL_MS = 60_000;

/**
 * FR-36: anonymous figures for the public transparency page. Only counts, averages and category and
 * suburb names leave the server, never a report, a name or a location (NFR-11).
 */
export class PublicStatsService {
  private cached: PublicStats | null = null;

  constructor(private readonly clock: () => number = Date.now) {}

  async get(): Promise<PublicStats> {
    const now = this.clock();
    if (this.cached && now - this.cached.generatedAt < TTL_MS) return this.cached;
    const [reports, departments, categories] = await Promise.all([
      col.reports().select('status', 'categoryId', 'departmentId', 'createdAt', 'resolvedAt', 'suburb', 'rating').get(),
      col.departments().get(),
      col.categories().get(),
    ]);
    const rows = reports.docs.map((d) => d.data() as Pick<ReportDoc, 'status' | 'categoryId' | 'departmentId' | 'createdAt' | 'resolvedAt' | 'suburb' | 'rating'>);
    const summary = computeAnalytics(
      rows.map((r) => ({ status: r.status, categoryId: r.categoryId, departmentId: r.departmentId, createdAt: r.createdAt.toMillis(), resolvedAt: r.resolvedAt?.toMillis() ?? null })),
      departments.docs.map((d) => ({ id: d.id, name: (d.data() as DepartmentDoc).name, slaHours: (d.data() as DepartmentDoc).slaHours })),
      now,
      DAYS,
    );
    this.cached = {
      generatedAt: now,
      days: DAYS,
      summary,
      categories: Object.fromEntries(categories.docs.map((d) => [d.id, (d.data() as CategoryDoc).name])),
      openBySuburb: openBySuburb(rows),
      satisfaction: summariseRatings(rows.map((r) => r.rating)),
    };
    return this.cached;
  }
}
