import { computeAnalytics, openBySuburb, summariseRatings, type AlertDoc, type CategoryDoc, type DepartmentDoc, type PublicFeed, type PublicReportDoc, type PublicStats, type ReportDoc } from '@civiclink/shared';
import { ts } from '../lib/firebase';
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

const FEED_TTL_MS = 30_000;
const FEED_MAX_ISSUES = 500;

/**
 * FR-38: open issues and active alerts for the public home page. Issues come from the privacy-safe
 * `publicReports` projection (BR-17); alerts are public service announcements. Fresher than the
 * figures (30 s here, 1 min at the CDN) because emergency alerts must reach people quickly.
 */
export class PublicFeedService {
  private cached: PublicFeed | null = null;

  constructor(private readonly clock: () => number = Date.now) {}

  async get(): Promise<PublicFeed> {
    const now = this.clock();
    if (this.cached && now - this.cached.generatedAt < FEED_TTL_MS) return this.cached;
    const [issues, alerts] = await Promise.all([
      col.publicReports().where('isOpen', '==', true).limit(FEED_MAX_ISSUES).get(),
      col.alerts().where('isActive', '==', true).where('expiresAt', '>', ts(now)).get(),
    ]);
    this.cached = {
      generatedAt: now,
      openIssues: issues.docs.map((d) => {
        const r = d.data() as PublicReportDoc;
        return { id: d.id, ref: r.ref, categoryId: r.categoryId, categoryName: r.categoryName, status: r.status, location: r.location, suburb: r.suburb, affectedCount: r.affectedCount, createdAt: r.createdAt.toMillis() };
      }),
      alerts: alerts.docs
        .map((d) => {
          const a = d.data() as AlertDoc;
          return { id: d.id, type: a.type, title: a.title, message: a.message, targetSuburbs: a.targetSuburbs, createdAt: a.createdAt.toMillis(), expiresAt: a.expiresAt.toMillis() };
        })
        .sort((a, b) => Number(b.type === 'EMERGENCY') - Number(a.type === 'EMERGENCY') || b.createdAt - a.createdAt),
    };
    return this.cached;
  }
}
