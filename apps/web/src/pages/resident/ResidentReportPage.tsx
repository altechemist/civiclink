import { LIMITS, ResolutionPolicy, type HistoryDoc, type ReportDoc } from '@civiclink/shared';
import { collection, orderBy, query } from 'firebase/firestore';
import { CheckCircle2, RotateCcw, Star, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../../auth/AuthProvider';
import { LifecycleProgress, PhotoGrid, Timeline } from '../../components/domain';
import { BackLink, Button, Card, cx, ErrorState, Field, Input, LoadingState, Notice, SeverityBadge, StatusBadge, Textarea } from '../../components/ui';
import { call, type ApiError } from '../../lib/api';
import { db } from '../../lib/firebase';
import { formatDateTime, hours } from '../../lib/format';
import { useLiveDoc, useLiveQuery } from '../../lib/hooks';

/** FR-06 detail with timeline; FR-14 confirm or reopen within 7 days. */
export function ResidentReportPage() {
  const { id = '' } = useParams();
  const { uid } = useSession();
  const report = useLiveDoc<ReportDoc>(`reports/${id}`);
  const history = useLiveQuery<HistoryDoc>(query(collection(db, 'reports', id, 'history'), orderBy('at')), `history-${id}`);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'confirm' | 'reopen' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  // FR-37: optional rating of the service when confirming the fix.
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  if (report.loading) return <LoadingState />;
  if (report.error || !report.data) return <ErrorState error={report.error ?? 'This report does not exist or is not yours.'} />;
  const r = report.data;
  const isOwner = r.reporterId === uid;
  const canRespond = isOwner && r.status === 'RESOLVED' && r.resolvedAt && ResolutionPolicy.withinWindow(r.resolvedAt.toMillis(), Date.now());
  const resolutionHours = r.resolvedAt ? Math.round(((r.resolvedAt.toMillis() - r.createdAt.toMillis()) / 3600_000) * 10) / 10 : null;

  const act = async (kind: 'confirm' | 'reopen') => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'confirm') await call('confirmResolution', { reportId: id, ...(rating ? { rating } : {}), ...(feedback.trim() ? { feedback } : {}) });
      else await call('reopenReport', { reportId: id, reason });
      setReopening(false);
      setReason('');
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <BackLink to="/resident/reports">My reports</BackLink>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-500" data-testid="detail-ref">{r.ref}</p>
            <h1 className="text-xl font-bold text-slate-900">{r.categoryName}</h1>
            <p className="text-sm text-slate-600">
              {r.suburb}
              {r.landmark ? ` · ${r.landmark}` : ''} · {formatDateTime(r.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={r.severity} />
            <span data-testid="detail-status">
              <StatusBadge status={r.status} />
            </span>
          </div>
        </div>
        <div className="mt-4">
          <LifecycleProgress status={r.status} />
        </div>
        {!isOwner && <Notice tone="info">You're following this report because you reported the same issue.</Notice>}
        {r.affectedCount > 1 && (
          <p className="mt-3 flex items-center gap-1 text-sm text-slate-600">
            <Users className="size-4" aria-hidden /> {r.affectedCount} residents reported this issue
          </p>
        )}
        {r.status === 'DUPLICATE' && r.parentReportId && (
          <Notice tone="info">
            This issue was already reported. Follow <Link className="font-semibold underline" to={`/resident/reports/${r.parentReportId}`}>{r.parentRef}</Link> for progress.
          </Notice>
        )}
        <p className="mt-4 whitespace-pre-line text-slate-800">{r.description}</p>
        <div className="mt-3">
          <PhotoGrid ids={r.photoIds} label="Report photo" />
        </div>
        {r.assignedWorkerName && r.status !== 'RESOLVED' && r.status !== 'CLOSED' && (
          <p className="mt-3 text-sm text-slate-600">Assigned to field worker {r.assignedWorkerName}</p>
        )}
      </Card>

      {(r.status === 'RESOLVED' || r.status === 'CLOSED') && r.resolutionNotes && (
        <Card className="ring-emerald-200">
          <h2 className="flex items-center gap-2 font-semibold text-emerald-800">
            <CheckCircle2 className="size-5" aria-hidden /> Resolved in {hours(resolutionHours)}
          </h2>
          <p className="mt-2 text-sm text-slate-700">{r.resolutionNotes}</p>
          <div className="mt-3">
            <PhotoGrid ids={r.resolutionPhotoIds} label="Proof of repair" />
          </div>
        </Card>
      )}

      {canRespond && (
        <Card>
          <h2 className="font-semibold text-slate-900">Is the problem fixed?</h2>
          <p className="mb-3 text-sm text-slate-600">
            Let us know within {LIMITS.reopenWindowDays} days. If you don't respond, the report closes automatically.
          </p>
          {error && !error.fields.reason && <Notice tone="error">{error.message}</Notice>}
          {reopening ? (
            <div className="space-y-3">
              <Field label="What is still wrong?" htmlFor="reason" error={error?.fields.reason}>
                <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} invalid={!!error?.fields.reason} />
              </Field>
              <div className="flex gap-2">
                <Button variant="danger" icon={RotateCcw} busy={busy === 'reopen'} onClick={() => act('reopen')}>
                  Reopen report
                </Button>
                <Button variant="ghost" onClick={() => setReopening(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
            <div>
              <p className="mb-1 text-sm font-medium text-slate-800">How was the service? (optional)</p>
              <div role="radiogroup" aria-label="Rate the service" className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                    onClick={() => setRating(rating === n ? 0 : n)}
                    className="rounded p-1 hover:bg-amber-50"
                  >
                    <Star className={cx('size-7', n <= rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300')} aria-hidden />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <div className="mt-2">
                  <Field label="Anything to add? (optional)" htmlFor="feedback" error={error?.fields.feedback}>
                    <Input id="feedback" maxLength={LIMITS.feedbackMax} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="success" icon={CheckCircle2} busy={busy === 'confirm'} onClick={() => act('confirm')}>
                Yes, it's fixed
              </Button>
              <Button variant="secondary" icon={RotateCcw} onClick={() => setReopening(true)}>
                No, reopen it
              </Button>
            </div>
            </div>
          )}
        </Card>
      )}

      {isOwner && r.rating ? (
        <p className="flex items-center gap-1 text-sm text-slate-700" data-testid="my-rating">
          You rated this service
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={cx('size-4', n <= r.rating! ? 'fill-amber-400 text-amber-500' : 'text-slate-300')} aria-hidden />
          ))}
          <span className="sr-only">{r.rating} out of 5</span>
        </p>
      ) : null}

      <Card>
        <h2 className="mb-4 font-semibold text-slate-900">Progress history</h2>
        {history.loading ? <LoadingState /> : <Timeline items={history.data} />}
      </Card>
    </div>
  );
}
