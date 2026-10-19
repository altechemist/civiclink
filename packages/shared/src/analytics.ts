import { OPEN_REPORT_STATUSES, REPORT_STATUSES, type ReportStatus } from './constants';

export interface AnalyticsReport {
  status: ReportStatus;
  categoryId: string;
  departmentId: string;
  createdAt: number;
  resolvedAt?: number | null;
}

export interface DepartmentInfo {
  id: string;
  name: string;
  slaHours: number;
}

export interface DepartmentMetrics {
  departmentId: string;
  name: string;
  open: number;
  resolved: number;
  avgResolutionHours: number | null;
  slaCompliancePct: number | null;
}

export interface AnalyticsSummary {
  total: number;
  open: number;
  resolvedInPeriod: number;
  avgResolutionHours: number | null;
  slaCompliancePct: number | null;
  byStatus: Record<ReportStatus, number>;
  byCategory: Record<string, number>;
  departments: DepartmentMetrics[];
  trend: { date: string; submitted: number; resolved: number }[];
}

const HOUR = 3600_000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * FR-19: metrics over all reports (duplicates excluded from workload figures).
 * Resolution time and SLA compliance use reports resolved within the period.
 * Empty sets yield null rather than NaN (UT-ANL-01).
 */
export function computeAnalytics(
  reports: AnalyticsReport[],
  departments: DepartmentInfo[],
  now: number,
  days = 30,
): AnalyticsSummary {
  const since = now - days * 24 * HOUR;
  const work = reports.filter((r) => r.status !== 'DUPLICATE');
  const byStatus = Object.fromEntries(REPORT_STATUSES.map((s) => [s, 0])) as Record<ReportStatus, number>;
  const byCategory: Record<string, number> = {};
  for (const r of reports) byStatus[r.status]++;
  for (const r of work) byCategory[r.categoryId] = (byCategory[r.categoryId] ?? 0) + 1;

  const slaOf = new Map(departments.map((d) => [d.id, d.slaHours]));
  const resolvedInPeriod = work.filter((r) => r.resolvedAt && r.resolvedAt >= since);

  const stats = (set: AnalyticsReport[]) => {
    if (set.length === 0) return { avg: null, sla: null };
    const hours = set.map((r) => (r.resolvedAt! - r.createdAt) / HOUR);
    const withinSla = set.filter((r, i) => hours[i]! <= (slaOf.get(r.departmentId) ?? Infinity)).length;
    return {
      avg: round1(hours.reduce((a, b) => a + b, 0) / set.length),
      sla: round1((withinSla / set.length) * 100),
    };
  };
  const overall = stats(resolvedInPeriod);

  const departmentsOut = departments.map((d) => {
    const s = stats(resolvedInPeriod.filter((r) => r.departmentId === d.id));
    return {
      departmentId: d.id,
      name: d.name,
      open: work.filter((r) => r.departmentId === d.id && OPEN_REPORT_STATUSES.includes(r.status)).length,
      resolved: resolvedInPeriod.filter((r) => r.departmentId === d.id).length,
      avgResolutionHours: s.avg,
      slaCompliancePct: s.sla,
    };
  });

  const trend: AnalyticsSummary['trend'] = [];
  const index = new Map<string, (typeof trend)[number]>();
  for (let i = days - 1; i >= 0; i--) {
    const entry = { date: dayKey(now - i * 24 * HOUR), submitted: 0, resolved: 0 };
    trend.push(entry);
    index.set(entry.date, entry);
  }
  for (const r of work) {
    const s = index.get(dayKey(r.createdAt));
    if (s) s.submitted++;
    if (r.resolvedAt) {
      const e = index.get(dayKey(r.resolvedAt));
      if (e) e.resolved++;
    }
  }

  return {
    total: work.length,
    open: work.filter((r) => OPEN_REPORT_STATUSES.includes(r.status)).length,
    resolvedInPeriod: resolvedInPeriod.length,
    avgResolutionHours: overall.avg,
    slaCompliancePct: overall.sla,
    byStatus,
    byCategory,
    departments: departmentsOut,
    trend,
  };
}

/** FR-26: CSV export with RFC 4180 quoting. */
export function toCsv(rows: Record<string, string | number | null | undefined>[], columns: string[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\r\n');
}
