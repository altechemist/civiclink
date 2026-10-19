import { AlertTriangle, Construction, Droplets, Info, Megaphone, Zap, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSession } from '../../auth/AuthProvider';
import { cx, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { call } from '../../lib/api';
import { formatDateTime, timeAgo } from '../../lib/format';
import { useResidentAlerts, type FeedAlert } from './useResidentAlerts';

const TYPE: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  EMERGENCY: { icon: AlertTriangle, tone: 'bg-red-600', label: 'Emergency' },
  ELECTRICITY: { icon: Zap, tone: 'bg-violet-600', label: 'Electricity' },
  WATER: { icon: Droplets, tone: 'bg-sky-600', label: 'Water' },
  ROADS: { icon: Construction, tone: 'bg-orange-600', label: 'Roads' },
  GENERAL: { icon: Info, tone: 'bg-slate-600', label: 'General' },
};

export function AlertCard({ alert: a, compact }: { alert: FeedAlert; compact?: boolean }) {
  const t = TYPE[a.type] ?? TYPE.GENERAL!;
  return (
    <article
      data-testid="alert-card"
      className={cx(
        'overflow-hidden rounded-xl bg-white shadow-sm ring-1',
        a.type === 'EMERGENCY' ? 'ring-red-300' : 'ring-slate-200',
        !a.read && 'border-l-4 border-l-brand-600',
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-lg text-white', t.tone)}>
          <t.icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t.label}</span>
            {!a.read && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold uppercase text-white">New</span>}
            <span className="text-xs text-slate-500">{timeAgo(a.createdAt)}</span>
          </div>
          <h3 className="font-semibold text-slate-900">{a.title}</h3>
          <p className={cx('text-sm text-slate-700', compact && 'line-clamp-2')}>{a.message}</p>
          {!compact && (
            <p className="mt-2 text-xs text-slate-500">
              Areas: {a.targetSuburbs.join(', ')} · Until {formatDateTime(a.expiresAt)}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/** FR-17: suburb alerts. Opening the feed records read receipts for unread alerts. */
export function AlertsFeedPage() {
  const { claims } = useSession();
  const { feed, loading, error } = useResidentAlerts();
  const marked = useRef(new Set<string>());

  useEffect(() => {
    for (const a of feed) {
      if (a.read || marked.current.has(a.id)) continue;
      marked.current.add(a.id);
      void call('markAlertRead', { alertId: a.id }).catch(() => marked.current.delete(a.id));
    }
  }, [feed]);

  return (
    <div>
      <PageHeader title="Alerts" subtitle={`Municipal notices for ${claims.suburb} and the whole municipality.`} />
      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {!loading && !error && feed.length === 0 && (
        <EmptyState icon={Megaphone} title="No active alerts" body="When the municipality announces outages, closures or emergencies for your area, they appear here." />
      )}
      <div className="space-y-3">
        {feed.map((a) => (
          <AlertCard key={a.id} alert={a} />
        ))}
      </div>
    </div>
  );
}
