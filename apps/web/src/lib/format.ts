import type { ReportStatus, Severity, TaskStatus, TimestampLike } from '@civiclink/shared';

export const STATUS_LABEL: Record<ReportStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  IN_PROGRESS: 'In progress',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  DUPLICATE: 'Duplicate',
};

export const STATUS_TONE: Record<ReportStatus, string> = {
  SUBMITTED: 'bg-sky-100 text-sky-800 ring-sky-200',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800 ring-amber-200',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  ESCALATED: 'bg-red-100 text-red-800 ring-red-200',
  RESOLVED: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  CLOSED: 'bg-slate-200 text-slate-700 ring-slate-300',
  REJECTED: 'bg-slate-100 text-slate-600 ring-slate-200',
  DUPLICATE: 'bg-violet-100 text-violet-800 ring-violet-200',
};

export const TASK_LABEL: Record<TaskStatus, string> = {
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  REASSIGNED: 'Reassigned',
  CANCELLED: 'Cancelled',
};

export const SEVERITY_TONE: Record<Severity, string> = {
  HIGH: 'bg-red-50 text-red-700 ring-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-200',
  LOW: 'bg-slate-50 text-slate-600 ring-slate-200',
};

/** Resident-facing lifecycle steps for the progress bar. */
export const LIFECYCLE: ReportStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED'];

export const ms = (t: TimestampLike | null | undefined) => (t ? t.toMillis() : 0);

const dateFmt = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const formatDateTime = (t: TimestampLike | number | null | undefined) =>
  t ? dateFmt.format(typeof t === 'number' ? t : t.toMillis()) : '—';

export function timeAgo(t: TimestampLike | number | null | undefined, now = Date.now()) {
  if (!t) return '—';
  const diff = Math.max(0, now - (typeof t === 'number' ? t : t.toMillis()));
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export const hours = (n: number | null | undefined) => (n == null ? '—' : n < 48 ? `${n} h` : `${Math.round((n / 24) * 10) / 10} days`);
