import { OPEN_REPORT_STATUSES, SlaPolicy } from '@civiclink/shared';
import { Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSession } from '../../auth/AuthProvider';
import { Card, ErrorState, LoadingState, PageHeader, Stat } from '../../components/ui';
import { hours } from '../../lib/format';
import { useNow } from '../../lib/hooks';
import { ReportTable } from './ReportQueuePage';
import { useDepartments, useStaffReports } from './useStaffReports';

const DAY = 24 * 3600_000;

/** Operational overview for the official's department (FR-08 entry point, FR-19 headline figures). */
export function OfficialDashboard() {
  const { claims, profile } = useSession();
  const reports = useStaffReports();
  const departments = useDepartments();
  const now = useNow();
  const deptName = departments.data.find((d) => d.id === claims.dept)?.name ?? 'All departments';
  const sla = new Map(departments.data.map((d) => [d.id, d.slaHours]));

  const work = reports.data.filter((r) => r.status !== 'DUPLICATE');
  const open = work.filter((r) => OPEN_REPORT_STATUSES.includes(r.status));
  const today = work.filter((r) => now - r.createdAt.toMillis() < DAY).length;
  const resolved7 = work.filter((r) => r.resolvedAt && now - r.resolvedAt.toMillis() < 7 * DAY);
  const avg = resolved7.length
    ? Math.round((resolved7.reduce((s, r) => s + (r.resolvedAt!.toMillis() - r.createdAt.toMillis()), 0) / resolved7.length / 3600_000) * 10) / 10
    : null;
  const needsAction = open
    .filter((r) => r.status === 'SUBMITTED' || r.status === 'ESCALATED' || (r.status === 'UNDER_REVIEW' && !r.activeTaskId))
    .sort((a, b) => Number(b.status === 'ESCALATED') - Number(a.status === 'ESCALATED') || a.createdAt.toMillis() - b.createdAt.toMillis());
  const atRisk = open.filter((r) => {
    const h = sla.get(r.departmentId);
    return h && r.status !== 'ESCALATED' && SlaPolicy.dueAt(r.createdAt.toMillis(), h) - now < 6 * 3600_000;
  }).length;

  return (
    <div>
      <PageHeader
        title={`Good day, ${profile?.name?.split(' ')[0] ?? ''}`}
        subtitle={deptName}
        actions={
          <Link to="/official/alerts/new" className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
            <Megaphone className="size-4" aria-hidden /> Broadcast alert
          </Link>
        }
      />
      {reports.loading && <LoadingState />}
      {reports.error && <ErrorState error={reports.error} />}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="New today" value={today} />
        <Stat label="Open" value={open.length} tone="blue" hint={`${open.filter((r) => r.status === 'ESCALATED').length} escalated`} />
        <Stat label="Resolved (7 days)" value={resolved7.length} tone="green" />
        <Stat label="Avg resolution (7 days)" value={hours(avg)} tone={atRisk ? 'amber' : 'slate'} hint={atRisk ? `${atRisk} near SLA breach` : 'No SLA risks'} />
      </div>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Needs action ({needsAction.length})</h2>
          <Link to="/official/reports" className="text-sm font-medium text-brand-700">
            Full queue
          </Link>
        </div>
        <ReportTable reports={needsAction.slice(0, 10)} emptyText="Nothing waiting. Every report is triaged and assigned." />
      </Card>
    </div>
  );
}
