import type { SystemLogDoc } from '@civiclink/shared';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { PlayCircle, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, EmptyState, ErrorState, LoadingState, Notice, PageHeader, Pill } from '../../components/ui';
import { call } from '../../lib/api';
import { db } from '../../lib/firebase';
import { formatDateTime } from '../../lib/format';
import { useLiveQuery } from '../../lib/hooks';

/** FR-23: operational/audit log, plus a manual run of the scheduled SLA and auto-close rules (FR-13, FR-14). */
export function LogsPage() {
  const logs = useLiveQuery<SystemLogDoc>(query(collection(db, 'systemLogs'), orderBy('createdAt', 'desc'), limit(100)), 'logs');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await call('runMaintenance', {});
      setResult(`${r.escalated} report(s) escalated for SLA breach, ${r.closed} resolved report(s) auto-closed`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="System log"
        subtitle="Administrative actions, scheduled rules and server errors."
        actions={<Button variant="secondary" icon={PlayCircle} busy={busy} onClick={runNow}>Run SLA &amp; auto-close now</Button>}
      />
      {result && <div className="mb-4"><Notice tone="success">{result}.</Notice></div>}
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <Card>
        {logs.loading && <LoadingState />}
        {logs.error && <ErrorState error={logs.error} />}
        {!logs.loading && logs.data.length === 0 && <EmptyState icon={ScrollText} title="No events recorded yet" />}
        <ul className="divide-y divide-slate-100">
          {logs.data.map((l) => (
            <li key={l.id} className="flex flex-wrap items-start gap-3 py-2.5 text-sm">
              <Pill tone={l.level === 'ERROR' ? 'red' : l.level === 'WARNING' ? 'amber' : 'slate'}>{l.level}</Pill>
              <span className="font-mono text-xs text-slate-500">{l.source}</span>
              <span className="flex-1 text-slate-800">{l.message}</span>
              <span className="text-xs text-slate-500">{formatDateTime(l.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
