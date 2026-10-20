import { LIMITS, REPORT_STATUSES, SEVERITIES, toCsv, type ReportDoc, type UserDoc } from '@civiclink/shared';
import { collection, query, where } from 'firebase/firestore';
import { Download, Search, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/AuthProvider';
import { useCategories } from '../../components/domain';
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, Notice, PageHeader, Pill, Select, SeverityBadge, StatusBadge } from '../../components/ui';
import { call } from '../../lib/api';
import { db } from '../../lib/firebase';
import { formatDateTime, STATUS_LABEL, timeAgo } from '../../lib/format';
import { useLiveQuery, type WithId } from '../../lib/hooks';
import { useDepartments, useStaffReports } from './useStaffReports';

/** FR-35: a report can join a bulk assignment when it is triaged (or escalated) and has no active task. */
export const canAssign = (r: ReportDoc) => (r.status === 'UNDER_REVIEW' || r.status === 'ESCALATED') && !r.activeTaskId;

interface Selection {
  selected: Set<string>;
  toggle: (id: string) => void;
}

export function ReportTable({ reports, emptyText, selection }: { reports: WithId<ReportDoc>[]; emptyText: string; selection?: Selection }) {
  const navigate = useNavigate();
  if (reports.length === 0) return <EmptyState title={emptyText} />;
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {selection && <th className="w-8 px-3 py-2"><span className="sr-only">Select</span></th>}
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
              {selection && (
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  {canAssign(r) && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.ref}`}
                      checked={selection.selected.has(r.id)}
                      onChange={() => selection.toggle(r.id)}
                      className="size-4 rounded border-slate-300"
                    />
                  )}
                </td>
              )}
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

/** FR-35: assign the selected reports (one department) to one field worker in a single step. */
function BulkAssignBar({ reports, onDone }: { reports: WithId<ReportDoc>[]; onDone: (message: string, failed: boolean) => void }) {
  const departmentIds = [...new Set(reports.map((r) => r.departmentId))];
  const departmentId = departmentIds.length === 1 ? departmentIds[0]! : null;
  const workers = useLiveQuery<UserDoc>(
    departmentId ? query(collection(db, 'users'), where('role', '==', 'FIELD_WORKER'), where('departmentId', '==', departmentId), where('isActive', '==', true)) : null,
    `bulk-workers-${departmentId}`,
  );
  const [workerId, setWorkerId] = useState('');
  const [busy, setBusy] = useState(false);
  const tooMany = reports.length > LIMITS.bulkAssignMax;

  const assign = async () => {
    setBusy(true);
    try {
      const res = await call('assignReports', { reportIds: reports.map((r) => r.id), workerId });
      const refOf = (id: string) => reports.find((r) => r.id === id)?.ref ?? id;
      const worker = workers.data.find((w) => w.id === workerId)?.name ?? 'the worker';
      const failed = res.failed.map((f) => `${refOf(f.reportId)}: ${f.message}`).join('; ');
      onDone(`Assigned ${res.assigned.length} report${res.assigned.length === 1 ? '' : 's'} to ${worker}.${failed ? ` Not assigned: ${failed}` : ''}`, res.failed.length > 0);
    } catch (err) {
      onDone((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200" data-testid="bulk-assign">
      <p className="text-sm font-semibold text-brand-900">{reports.length} selected</p>
      {!departmentId ? (
        <p className="text-sm text-slate-700">Select reports from one department to assign them together.</p>
      ) : tooMany ? (
        <p className="text-sm text-slate-700">Select at most {LIMITS.bulkAssignMax} reports at a time.</p>
      ) : (
        <>
          <Select aria-label="Assign selected to" value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="w-auto">
            <option value="">Choose a field worker…</option>
            {workers.data.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
          <Button icon={UserCheck} busy={busy} disabled={!workerId} onClick={assign}>
            Assign selected
          </Button>
        </>
      )}
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkResult, setBulkResult] = useState<{ message: string; failed: boolean } | null>(null);
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  // Only reports still visible and still assignable count, so a live update cannot assign a stale selection.
  const chosen = filtered.filter((r) => selected.has(r.id) && canAssign(r));

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
      {bulkResult && (
        <div className="mb-4" data-testid="bulk-result">
          <Notice tone={bulkResult.failed ? 'warning' : 'success'}>{bulkResult.message}</Notice>
        </div>
      )}
      {chosen.length > 0 && (
        <BulkAssignBar
          reports={chosen}
          onDone={(message, failed) => {
            setBulkResult({ message, failed });
            setSelected(new Set());
          }}
        />
      )}
      <Card>
        {reports.loading && <LoadingState />}
        {reports.error && <ErrorState error={reports.error} />}
        {!reports.loading && <ReportTable reports={filtered} emptyText="No reports match these filters." selection={{ selected, toggle }} />}
      </Card>
    </div>
  );
}
