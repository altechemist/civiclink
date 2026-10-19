import type { AnalyticsSummary } from '@civiclink/shared';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCategories } from '../../components/domain';
import { Card, ErrorState, LoadingState, PageHeader, Select, Stat } from '../../components/ui';
import { call } from '../../lib/api';
import { hours } from '../../lib/format';

/** FR-19: live service-delivery analytics computed server-side from all reports. */
export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const categories = useCategories();

  useEffect(() => {
    let alive = true;
    setError(null);
    call('getAnalytics', { days })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [days]);

  const catName = (id: string) => categories.data.find((c) => c.id === id)?.name ?? id;

  return (
    <div>
      <PageHeader
        title="Service delivery analytics"
        subtitle="All departments, computed from live data."
        actions={
          <Select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-36">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </Select>
        }
      />
      {error && <ErrorState error={error} />}
      {!data && !error && <LoadingState />}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Open incidents" value={data.open} tone="blue" />
            <Stat label={`Resolved (${days} days)`} value={data.resolvedInPeriod} tone="green" />
            <Stat label="Avg resolution time" value={hours(data.avgResolutionHours)} />
            <Stat
              label="SLA compliance"
              value={data.slaCompliancePct == null ? '—' : `${data.slaCompliancePct}%`}
              tone={data.slaCompliancePct != null && data.slaCompliancePct < 70 ? 'red' : 'green'}
            />
          </div>
          <Card>
            <h2 className="mb-3 font-semibold text-slate-900">Reports submitted and resolved per day</h2>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={data.trend} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11 }} minTickGap={16} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="submitted" name="Submitted" stroke="#136a93" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-semibold text-slate-900">Reports by category</h2>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={Object.entries(data.byCategory).map(([id, n]) => ({ name: catName(id), n })).sort((a, b) => b.n - a.n)} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="n" name="Reports" fill="#136a93" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold text-slate-900">Department performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-2 font-semibold">Department</th>
                      <th className="py-2 pr-2 text-right font-semibold">Open</th>
                      <th className="py-2 pr-2 text-right font-semibold">Resolved</th>
                      <th className="py-2 pr-2 text-right font-semibold">Avg time</th>
                      <th className="py-2 text-right font-semibold">SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.departments.map((d) => (
                      <tr key={d.departmentId}>
                        <td className="py-2 pr-2">{d.name}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{d.open}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{d.resolved}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{hours(d.avgResolutionHours)}</td>
                        <td className={`py-2 text-right font-semibold tabular-nums ${d.slaCompliancePct != null && d.slaCompliancePct < 70 ? 'text-red-700' : 'text-emerald-700'}`}>
                          {d.slaCompliancePct == null ? 'No data' : `${d.slaCompliancePct}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
