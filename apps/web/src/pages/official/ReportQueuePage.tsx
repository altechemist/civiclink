import { REPORT_STATUSES, SEVERITIES, toCsv, type ReportDoc } from '@civiclink/shared';
import { Download, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/AuthProvider';
import { useCategories } from '../../components/domain';
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Pill, Select, SeverityBadge, StatusBadge } from '../../components/ui';
import { formatDateTime, STATUS_LABEL, timeAgo } from '../../lib/format';
import type { WithId } from '../../lib/hooks';
import { useDepartments, useStaffReports } from './useStaffReports';

export function ReportTable({ reports, emptyText }: { reports: WithId<ReportDoc>[]; emptyText: string }) {
  const navigate = useNavigate();
  if (reports.length === 0) return <EmptyState title={emptyText} />;
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-semibold">Reference</th>
            <th className="px-3 py-2 font-semibold">Category</th>
            <th className="px-3 py-2 font-semibold">Location</th>
            <th className="px-3 py-2 font-semibold">Severity</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Assigned</th>
            <th className="px-3 py-2 font-semibold">Age</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {reports.map((r) => (
            <tr
              key={r.id}
              tabIndex={0}
              onClick={() => navigate(`/official/reports/${r.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/official/reports/${r.id}`)}
              className="cursor-pointer hover:bg-slate-50 focus:bg-brand-50 focus:outline-none"
              data-testid="queue-row"
            >
              <td className="px-3 py-2.5 font-mono text-xs font-semibold text-brand-800">{r.ref}</td>
              <td className="px-3 py-2.5">{r.categoryName}</td>
              <td className="px-3 py-2.5 text-slate-600">{r.suburb}</td>
              <td className="px-3 py-2.5"><SeverityBadge severity={r.severity} /></td>
              <td className="px-3 py-2.5">
                <StatusBadge status={r.status} />
                {r.affectedCount > 1 && <span className="ml-1 text-xs text-slate-500">×{r.affectedCount}</span>}
              </td>
              <td className="px-3 py-2.5">
                {r.assignedWorkerName ?? (r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW' || r.status === 'ESCALATED' ? <Pill tone="amber">Unassigned</Pill> : '—')}
              </td>
              <td className="px-3 py-2.5 text-slate-600">{timeAgo(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** FR-08: report queue with combined filters, reference search and CSV export (FR-26). */
export function ReportQueuePage() {
  const { claims } = useSession();
  const reports = useStaffReports();
  const categories = useCategories();
  const departments = useDepartments();
  const [status, setStatus] = useState('OPEN');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [department, setDepartment] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toUpperCase();
    return reports.data.filter(
      (r) =>
        (status === 'OPEN' ? ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'ESCALATED'].includes(r.status) : !status || r.status === status) &&
        (!category || r.categoryId === category) &&
        (!severity || r.severity === severity) &&
        (!department || r.departmentId === department) &&
        (!unassigned || !r.activeTaskId) &&
        (!term || r.ref.includes(term) || r.suburb.toUpperCase().includes(term) || r.description.toUpperCase().includes(term)),
    );
  }, [reports.data, status, category, severity, department, unassigned, search]);

  const exportCsv = () => {
    const csv = toCsv(
      filtered.map((r) => ({
        reference: r.ref,
        category: r.categoryName,
        department: r.departmentId,
        suburb: r.suburb,
        severity: r.severity,
        status: r.status,
        assigned_to: r.assignedWorkerName ?? '',
        affected: r.affectedCount,
        submitted: formatDateTime(r.createdAt),
        resolved: r.resolvedAt ? formatDateTime(r.resolvedAt) : '',
      })),
      ['reference', 'category', 'department', 'suburb', 'severity', 'status', 'assigned_to', 'affected', 'submitted', 'resolved'],
    );
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `civiclink-reports-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Report queue"
        subtitle={`${filtered.length} of ${reports.data.length} reports`}
        actions={
          <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!filtered.length}>
            Export CSV
          </Button>
        }
      />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" aria-hidden />
            <Input aria-label="Search by reference, suburb or text" placeholder="Search CL-2026-…, suburb, text" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="OPEN">All open</option>
            <option value="">All statuses</option>
            {REPORT_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </Select>
          <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.data.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </Select>
          {claims.role === 'ADMIN' ? (
            <Select aria-label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {departments.data.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          ) : (
            <span />
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} className="size-4 rounded border-slate-300" />
            Unassigned only
          </label>
        </div>
      </Card>
      <Card>
        {reports.loading && <LoadingState />}
        {reports.error && <ErrorState error={reports.error} />}
        {!reports.loading && <ReportTable reports={filtered} emptyText="No reports match these filters." />}
      </Card>
    </div>
  );
}
