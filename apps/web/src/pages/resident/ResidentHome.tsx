import type { ReportDoc } from '@civiclink/shared';
import { OPEN_REPORT_STATUSES } from '@civiclink/shared';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { ChevronRight, Megaphone, PlusCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../../auth/AuthProvider';
import { OutboxCard } from '../../components/outbox';
import { InstallButton } from '../../components/pwa';
import { ErrorState, LoadingState, Notice, Stat } from '../../components/ui';
import { db } from '../../lib/firebase';
import { useLiveQuery } from '../../lib/hooks';
import { AlertCard } from './AlertsFeedPage';
import { ReportCard } from './MyReportsPage';
import { useResidentAlerts } from './useResidentAlerts';

export function ResidentHome() {
  const { uid, profile, claims } = useSession();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const reports = useLiveQuery<ReportDoc>(
    query(collection(db, 'reports'), where('reporterId', '==', uid), orderBy('createdAt', 'desc')),
    `my-reports-${uid}`,
  );
  const { feed } = useResidentAlerts();
  const active = reports.data.filter((r) => OPEN_REPORT_STATUSES.includes(r.status)).length;
  const resolved = reports.data.filter((r) => r.status === 'RESOLVED' || r.status === 'CLOSED').length;

  return (
    <div className="space-y-6">
      {notice && <Notice tone="success">{notice}</Notice>}
      <div>
        <p className="text-sm text-slate-600">Dumela · Molo · Hallo</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{profile?.name?.split(' ')[0] ?? 'Welcome'}</h1>
        <p className="text-sm text-slate-600">{claims.suburb}</p>
      </div>

      <Link
        to="/resident/report/new"
        className="flex items-center gap-4 rounded-2xl bg-brand-700 p-5 text-white shadow-lg transition hover:bg-brand-800"
        data-testid="report-cta"
      >
        <PlusCircle className="size-10 shrink-0" aria-hidden />
        <div className="flex-1">
          <p className="text-lg font-bold">Report an issue</p>
          <p className="text-sm text-brand-100">Burst pipe, outage, pothole, dumping… it takes under a minute.</p>
        </div>
        <ChevronRight className="size-6" aria-hidden />
      </Link>

      <OutboxCard />

      <InstallButton />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Reported" value={reports.data.length} />
        <Stat label="Active" value={active} tone="blue" />
        <Stat label="Resolved" value={resolved} tone="green" />
      </div>

      {feed.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Megaphone className="size-4" aria-hidden /> Alerts for {claims.suburb ?? 'all areas'}
            </h2>
            <Link to="/resident/alerts" className="text-sm font-medium text-brand-700">
              See all
            </Link>
          </div>
          <AlertCard alert={feed[0]!} compact />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent reports</h2>
          <Link to="/resident/reports" className="text-sm font-medium text-brand-700">
            See all
          </Link>
        </div>
        {reports.loading && <LoadingState />}
        {reports.error && <ErrorState error={reports.error} />}
        {!reports.loading && reports.data.length === 0 && (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
            You haven't reported anything yet. When you do, you'll be able to follow its progress here.
          </p>
        )}
        {reports.data.slice(0, 3).map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </section>
    </div>
  );
}
