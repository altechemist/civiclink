import { ALL_SUBURBS, SUBURBS, type PublicFeed, type PublicStats } from '@civiclink/shared';
import { BarChart3, LogIn, MapPinned, Megaphone, PlusCircle, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { categoryColour } from '../../components/domain';
import { IncidentMap } from '../../components/maps';
import { ErrorState, LoadingState, Select, Stat, StatusBadge } from '../../components/ui';
import { getPublic } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { AlertCard } from '../resident/AlertsFeedPage';
import type { FeedAlert } from '../resident/useResidentAlerts';

const millis = (ms: number) => ({ toMillis: () => ms });

/**
 * FR-38: the landing page for everyone who is not signed in. It shows what is happening around
 * Sol Plaatje right now (active alerts, open issues on a map, headline figures) and lets anyone
 * report a problem straight away, as a guest (FR-39), or sign in.
 */
export default function PublicHomePage() {
  const [feed, setFeed] = useState<PublicFeed | null>(null);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [area, setArea] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    getPublic<PublicFeed>('feed', ctrl.signal).then(setFeed).catch((e: Error) => e.name !== 'AbortError' && setError(e));
    getPublic<PublicStats>('stats', ctrl.signal).then(setStats).catch(() => {});
    return () => ctrl.abort();
  }, []);

  const alerts = (feed?.alerts ?? []).filter((a) => !area || a.targetSuburbs.includes(area) || a.targetSuburbs.includes(ALL_SUBURBS));
  const issues = (feed?.openIssues ?? []).filter((i) => !area || i.suburb === area);
  const s = stats?.summary;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand-800 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 font-bold tracking-tight">
            <img src="/favicon.svg" alt="" className="size-7" /> CivicLink
          </span>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/login" className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold hover:bg-white/10">
              <LogIn className="size-4" aria-hidden /> Sign in
            </Link>
            <Link to="/register" className="hidden items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20 sm:flex">
              <UserPlus className="size-4" aria-hidden /> Create account
            </Link>
          </nav>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-4">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">What's happening in Sol Plaatje</h1>
          <p className="mt-1 max-w-2xl text-brand-100">
            Live alerts from the municipality and the problems residents have reported near you. Spotted something? Report it in under a minute, no
            account needed.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              to="/report"
              data-testid="report-as-guest"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 font-semibold text-brand-800 shadow hover:bg-brand-50"
            >
              <PlusCircle className="size-5" aria-hidden /> Report an issue
            </Link>
            <span className="text-sm text-brand-100">
              or{' '}
              <Link to="/login" className="font-semibold text-white underline">
                sign in
              </Link>{' '}
              to follow your reports
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="area" className="text-sm font-medium text-slate-700">
            Show my area
          </label>
          <Select id="area" value={area} onChange={(e) => setArea(e.target.value)} className="w-full sm:w-56">
            <option value="">All of Sol Plaatje</option>
            {SUBURBS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </div>

        {!feed && !error && <LoadingState label="Loading what's happening" />}
        {error && <ErrorState error={error} />}

        {feed && (
          <>
            <section className="space-y-3" data-testid="public-alerts">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <Megaphone className="size-4" aria-hidden /> Alerts {area ? `for ${area}` : 'across Sol Plaatje'} ({alerts.length})
              </h2>
              {alerts.length === 0 && <p className="text-sm text-slate-600">No active alerts. Good news.</p>}
              {alerts.map((a) => (
                <AlertCard
                  key={a.id}
                  alert={{ ...a, createdAt: millis(a.createdAt), expiresAt: millis(a.expiresAt), read: true } as unknown as FeedAlert}
                />
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <MapPinned className="size-4" aria-hidden /> Open issues {area ? `in ${area}` : ''} ({issues.length})
              </h2>
              <IncidentMap
                height="h-[50vh]"
                points={issues.map((i) => ({
                  id: i.id,
                  location: i.location,
                  colour: categoryColour(i.categoryId),
                  popup: (
                    <div className="space-y-1">
                      <p className="font-semibold">{i.categoryName}</p>
                      <StatusBadge status={i.status} />
                      <p className="text-xs">
                        {i.suburb} · {timeAgo(i.createdAt)}
                        {i.affectedCount > 1 ? ` · ${i.affectedCount} reports` : ''}
                      </p>
                    </div>
                  ),
                }))}
              />
              <p className="text-xs text-slate-500">Locations are approximate (about 100 m) to protect residents' privacy.</p>
            </section>
          </>
        )}

        {s && stats && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <BarChart3 className="size-4" aria-hidden /> How the municipality is responding
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Open issues" value={s.open} tone="blue" />
              <Stat label={`Fixed in ${stats.days} days`} value={s.resolvedInPeriod} tone="green" />
              <Stat label="Average time to fix" value={s.avgResolutionHours === null ? '—' : `${s.avgResolutionHours} h`} />
              <Stat label="Resident satisfaction" value={stats.satisfaction.average === null ? '—' : `${stats.satisfaction.average}/5`} tone="amber" />
            </div>
            <Link to="/transparency" className="inline-block text-sm font-semibold text-brand-700 hover:underline">
              See all figures by department →
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
