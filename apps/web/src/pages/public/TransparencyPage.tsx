import type { PublicStats } from '@civiclink/shared';
import { ArrowLeft, Clock, ShieldCheck, Smile, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, ErrorState, LoadingState, Stat } from '../../components/ui';
import { publicStatsUrl } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

function Bars({ rows, testId }: { rows: [string, number][]; testId: string }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  if (rows.length === 0) return <p className="text-sm text-slate-500">No open issues.</p>;
  return (
    <ul className="space-y-2" data-testid={testId}>
      {rows.map(([label, n]) => (
        <li key={label} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="truncate text-slate-700">{label}</span>
          <span className="h-2.5 rounded-full bg-slate-100">
            <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="text-right font-semibold tabular-nums text-slate-900">{n}</span>
        </li>
      ))}
    </ul>
  );
}

const fmt = (n: number | null, suffix = '') => (n === null ? '—' : `${n}${suffix}`);

/**
 * FR-36: public transparency page, open to anyone without signing in. Shows only anonymous
 * aggregates (NFR-11), served from the CDN cache (NFR-13), so heavy public traffic cannot slow down
 * reporting.
 */
export default function TransparencyPage() {
  const [data, setData] = useState<PublicStats | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(publicStatsUrl(), { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<PublicStats>) : Promise.reject(new Error('The figures are unavailable right now. Please try again later.'))))
      .then(setData)
      .catch((err: Error) => err.name !== 'AbortError' && setError(err));
    return () => ctrl.abort();
  }, []);

  const s = data?.summary;
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand-800 px-4 py-8 text-white">
        <div className="mx-auto max-w-5xl">
          <Link to="/login" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-100 hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> CivicLink
          </Link>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">How Sol Plaatje is responding</h1>
          <p className="mt-1 max-w-2xl text-brand-100">
            Live, anonymous figures from residents' reports: how many issues are open, how quickly they are fixed and whether the municipality meets
            its own service targets.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {!data && !error && <LoadingState label="Loading figures" />}
        {error && <ErrorState error={error} />}
        {data && s && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="public-kpis">
              <Stat label="Open issues" value={s.open} tone="blue" />
              <Stat label={`Fixed in ${data.days} days`} value={s.resolvedInPeriod} tone="green" />
              <Stat label="Average time to fix" value={fmt(s.avgResolutionHours, ' h')} />
              <Stat label="Fixed within target" value={fmt(s.slaCompliancePct, '%')} tone={s.slaCompliancePct !== null && s.slaCompliancePct < 70 ? 'red' : 'green'} />
              <Stat
                label="Resident satisfaction"
                value={data.satisfaction.average === null ? '—' : `${data.satisfaction.average}/5`}
                hint={`${data.satisfaction.ratings} rating${data.satisfaction.ratings === 1 ? '' : 's'}`}
                tone="amber"
              />
            </div>

            <Card>
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                <ShieldCheck className="size-4" aria-hidden /> Departments against their service targets ({data.days} days)
              </h2>
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[520px] text-left text-sm" data-testid="public-departments">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Department</th>
                      <th className="px-3 py-2 text-right">Open</th>
                      <th className="px-3 py-2 text-right">Fixed</th>
                      <th className="px-3 py-2 text-right">Avg time to fix</th>
                      <th className="px-3 py-2 text-right">Within target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {s.departments.map((d) => (
                      <tr key={d.departmentId}>
                        <td className="px-3 py-2 font-medium text-slate-900">{d.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{d.open}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{d.resolved}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(d.avgResolutionHours, ' h')}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(d.slaCompliancePct, '%')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                  <Wrench className="size-4" aria-hidden /> Reports by category
                </h2>
                <Bars testId="public-categories" rows={Object.entries(s.byCategory).map(([id, n]) => [data.categories[id] ?? id, n] as [string, number]).sort((a, b) => b[1] - a[1])} />
              </Card>
              <Card>
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                  <Clock className="size-4" aria-hidden /> Open issues by area
                </h2>
                <Bars testId="public-suburbs" rows={Object.entries(data.openBySuburb).sort((a, b) => b[1] - a[1]).slice(0, 10)} />
              </Card>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Smile className="size-3.5" aria-hidden />
              Figures contain no names, descriptions or exact locations. Updated every few minutes; last calculated {formatDateTime(data.generatedAt)}.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
