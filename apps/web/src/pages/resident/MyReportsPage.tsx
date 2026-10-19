import { OPEN_REPORT_STATUSES, type ReportDoc } from '@civiclink/shared';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { ClipboardList, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../auth/AuthProvider';
import { CategoryIcon, LifecycleProgress, ReportLink, useCategories } from '../../components/domain';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, Tabs } from '../../components/ui';
import { db } from '../../lib/firebase';
import { timeAgo } from '../../lib/format';
import { useLiveQuery, type WithId } from '../../lib/hooks';

export function ReportCard({ report: r }: { report: WithId<ReportDoc> }) {
  const categories = useCategories();
  const icon = categories.data.find((c) => c.id === r.categoryId)?.icon;
  return (
    <ReportLink to={`/resident/reports/${r.id}`}>
      <div className="flex items-start gap-3" data-testid="report-card">
        <CategoryIcon icon={icon} categoryId={r.categoryId} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-900">{r.categoryName}</p>
            <StatusBadge status={r.status} />
          </div>
          <p className="flex items-center gap-1 text-xs text-slate-600">
            <MapPin className="size-3" aria-hidden />
            {r.suburb} · {r.ref} · {timeAgo(r.createdAt)}
          </p>
          {r.status === 'DUPLICATE' ? (
            <p className="text-xs text-violet-700">Linked to {r.parentRef}</p>
          ) : (
            <LifecycleProgress status={r.status} />
          )}
        </div>
      </div>
    </ReportLink>
  );
}

type Tab = 'all' | 'active' | 'resolved';

/** FR-06: the resident's own reports with status tracking. */
export function MyReportsPage() {
  const { uid } = useSession();
  const [tab, setTab] = useState<Tab>('all');
  const { data, loading, error } = useLiveQuery<ReportDoc>(
    query(collection(db, 'reports'), where('reporterId', '==', uid), orderBy('createdAt', 'desc')),
    `my-reports-${uid}`,
  );
  const isActive = (r: ReportDoc) => OPEN_REPORT_STATUSES.includes(r.status);
  const isDone = (r: ReportDoc) => r.status === 'RESOLVED' || r.status === 'CLOSED';
  const shown = data.filter((r) => (tab === 'active' ? isActive(r) : tab === 'resolved' ? isDone(r) : true));

  return (
    <div>
      <PageHeader title="My reports" subtitle="Follow every report from submission to resolution." />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'All', count: data.length },
          { value: 'active', label: 'Active', count: data.filter(isActive).length },
          { value: 'resolved', label: 'Resolved', count: data.filter(isDone).length },
        ]}
      />
      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {!loading && !error && shown.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title={tab === 'all' ? 'No reports yet' : `No ${tab} reports`}
          body="Reports you submit appear here with their live status."
          action={
            <Link to="/resident/report/new" className="font-semibold text-brand-700 hover:underline">
              Report an issue
            </Link>
          }
        />
      )}
      <div className="space-y-3">
        {shown.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>
    </div>
  );
}
