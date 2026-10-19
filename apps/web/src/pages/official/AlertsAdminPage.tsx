import type { AlertDoc } from '@civiclink/shared';
import { collection, orderBy, query } from 'firebase/firestore';
import { Megaphone, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, LoadingState, Notice, PageHeader, Pill, Tabs } from '../../components/ui';
import { call } from '../../lib/api';
import { db } from '../../lib/firebase';
import { formatDateTime } from '../../lib/format';
import { useLiveQuery, useNow } from '../../lib/hooks';

type Tab = 'active' | 'ended';

/** FR-18: sent alerts with delivery and read counts; early deactivation. */
export function AlertsAdminPage() {
  const location = useLocation();
  const sent = (location.state as { sent?: string } | null)?.sent;
  const now = useNow(30_000);
  const [tab, setTab] = useState<Tab>('active');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alerts = useLiveQuery<AlertDoc>(query(collection(db, 'alerts'), orderBy('createdAt', 'desc')), 'alerts-all');
  const isLive = (a: AlertDoc) => a.isActive && a.expiresAt.toMillis() > now;
  const shown = alerts.data.filter((a) => (tab === 'active' ? isLive(a) : !isLive(a)));

  const deactivate = async (alertId: string) => {
    setBusy(alertId);
    setError(null);
    try {
      await call('deactivateAlert', { alertId });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="Broadcasts to residents, with delivery and read receipts."
        actions={
          <Link to="/official/alerts/new" className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
            <Plus className="size-4" aria-hidden /> New alert
          </Link>
        }
      />
      {sent && <div className="mb-4"><Notice tone="success">{sent}.</Notice></div>}
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'Active', count: alerts.data.filter(isLive).length },
          { value: 'ended', label: 'Expired / ended', count: alerts.data.filter((a) => !isLive(a)).length },
        ]}
      />
      {alerts.loading && <LoadingState />}
      {alerts.error && <ErrorState error={alerts.error} />}
      {!alerts.loading && shown.length === 0 && <EmptyState icon={Megaphone} title={tab === 'active' ? 'No active alerts' : 'No past alerts'} />}
      <div className="space-y-3">
        {shown.map((a) => {
          const readPct = a.recipientCount ? Math.round((a.readCount / a.recipientCount) * 100) : 0;
          return (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3" data-testid="alert-row">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={a.type === 'EMERGENCY' ? 'red' : 'blue'}>{a.type}</Pill>
                    {!a.isActive && <Pill>Deactivated</Pill>}
                    <span className="text-xs text-slate-500">
                      {formatDateTime(a.createdAt)} by {a.createdByName} · until {formatDateTime(a.expiresAt)}
                    </span>
                  </div>
                  <h3 className="mt-1 font-semibold text-slate-900">{a.title}</h3>
                  <p className="text-sm text-slate-700">{a.message}</p>
                  <p className="mt-1 text-xs text-slate-500">Areas: {a.targetSuburbs.join(', ')}</p>
                </div>
                <div className="w-44 text-right">
                  <p className="text-sm text-slate-700">
                    <strong data-testid="recipient-count">{a.recipientCount}</strong> delivered · <strong>{a.readCount}</strong> read
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-label={`${readPct}% read`}>
                    <div className="h-full bg-emerald-500" style={{ width: `${readPct}%` }} />
                  </div>
                  {isLive(a) && (
                    <Button variant="ghost" className="mt-2 text-red-700" busy={busy === a.id} onClick={() => deactivate(a.id)}>
                      End now
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
