import type { PublicReportDoc } from '@civiclink/shared';
import { collection, query, where } from 'firebase/firestore';
import { useState } from 'react';
import { categoryColour, useCategories } from '../../components/domain';
import { IncidentMap } from '../../components/maps';
import { cx, ErrorState, LoadingState, PageHeader, StatusBadge } from '../../components/ui';
import { db } from '../../lib/firebase';
import { timeAgo } from '../../lib/format';
import { useLiveQuery } from '../../lib/hooks';

/**
 * FR-07: open incidents from the privacy-safe `publicReports` projection (BR-17): category, status,
 * approximate location and age only. No reporter, description or photos.
 */
export default function CommunityMapPage() {
  const categories = useCategories();
  const [filter, setFilter] = useState<string | null>(null);
  const { data, loading, error } = useLiveQuery<PublicReportDoc>(query(collection(db, 'publicReports'), where('isOpen', '==', true)), 'public-open');
  const shown = data.filter((r) => !filter || r.categoryId === filter);
  const counts = new Map<string, number>();
  for (const r of data) counts.set(r.categoryId, (counts.get(r.categoryId) ?? 0) + 1);

  return (
    <div>
      <PageHeader title="Community map" subtitle={`${shown.length} open issue${shown.length === 1 ? '' : 's'} across Sol Plaatje`} />
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
        <button onClick={() => setFilter(null)} className={cx('whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ring-1', !filter ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-300')}>
          All ({data.length})
        </button>
        {categories.data
          .filter((c) => counts.has(c.id))
          .map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              aria-pressed={filter === c.id}
              className={cx('flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ring-1', filter === c.id ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-300')}
            >
              <span className="size-2.5 rounded-full" style={{ background: categoryColour(c.id) }} />
              {c.name} ({counts.get(c.id)})
            </button>
          ))}
      </div>
      {loading && <LoadingState label="Loading incidents" />}
      {error && <ErrorState error={error} />}
      {!error && (
        <IncidentMap
          height="h-[60vh]"
          points={shown.map((r) => ({
            id: r.id,
            location: r.location,
            colour: categoryColour(r.categoryId),
            popup: (
              <div className="space-y-1">
                <p className="font-semibold">{r.categoryName}</p>
                <StatusBadge status={r.status} />
                <p className="text-xs">
                  {r.suburb} · {timeAgo(r.createdAt)}
                  {r.affectedCount > 1 ? ` · ${r.affectedCount} reports` : ''}
                </p>
              </div>
            ),
          }))}
        />
      )}
      <p className="mt-2 text-xs text-slate-500">Locations are approximate (about 100 m) to protect residents' privacy.</p>
    </div>
  );
}
