import { ReportStateMachine, type CommentDoc, type HistoryDoc, type ReportDoc, type ReportEvent, type TaskDoc, type UserDoc } from '@civiclink/shared';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { AlertOctagon, ArrowRightLeft, CheckSquare, ExternalLink, MessageSquare, UserCheck, XCircle } from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../../auth/AuthProvider';
import { categoryColour, PhotoGrid, Timeline } from '../../components/domain';
import { BackLink, Button, Card, ErrorState, Field, Input, LoadingState, Notice, Pill, SeverityBadge, Select, StatusBadge, Textarea } from '../../components/ui';
import { call, type ApiError } from '../../lib/api';
import { db } from '../../lib/firebase';
import { formatDateTime, TASK_LABEL, timeAgo } from '../../lib/format';
import { useLiveDoc, useLiveQuery } from '../../lib/hooks';
import { useDepartments } from './useStaffReports';

const IncidentMap = lazy(() => import('../../components/maps').then((m) => ({ default: m.IncidentMap })));

type Action = 'triage' | 'reject' | 'assign' | 'reassign' | 'escalate';

function ActionForm({ title, children, onCancel }: { title: string; children: ReactNode; onCancel: () => void }) {
  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <button onClick={onCancel} className="text-xs text-slate-500 hover:underline">
          Cancel
        </button>
      </div>
      {children}
    </div>
  );
}

/** FR-09, FR-10, FR-12, FR-13 (+ FR-22 comments): triage and dispatch a single report. */
export function OfficialReportPage() {
  const { id = '' } = useParams();
  const { claims } = useSession();
  const report = useLiveDoc<ReportDoc>(`reports/${id}`);
  const history = useLiveQuery<HistoryDoc>(query(collection(db, 'reports', id, 'history'), orderBy('at')), `history-${id}`);
  const comments = useLiveQuery<CommentDoc>(query(collection(db, 'reports', id, 'comments'), orderBy('createdAt')), `comments-${id}`);
  const departments = useDepartments();
  const r = report.data;
  const activeTask = useLiveDoc<TaskDoc>(r?.activeTaskId ? `tasks/${r.activeTaskId}` : null);
  const workers = useLiveQuery<UserDoc>(
    r ? query(collection(db, 'users'), where('role', '==', 'FIELD_WORKER'), where('departmentId', '==', r.departmentId), where('isActive', '==', true)) : null,
    `workers-${r?.departmentId}`,
  );

  const [action, setAction] = useState<Action | null>(null);
  const [form, setForm] = useState({ departmentId: '', workerId: '', notes: '', reason: '' });
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (report.loading) return <LoadingState />;
  if (report.error || !r) return <ErrorState error={report.error ?? 'Report not found or not in your department.'} />;

  const actor = claims.role === 'ADMIN' ? 'ADMIN' : 'OFFICIAL';
  const can = (e: ReportEvent) => ReportStateMachine.can(r.status, e, actor);
  const canAssign = can('assign') && !r.activeTaskId;
  const canReassign = can('reassign') && !!r.activeTaskId;
  const deptName = (d: string) => departments.data.find((x) => x.id === d)?.name ?? d;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await fn();
      setDone(label);
      setAction(null);
      setForm({ departmentId: '', workerId: '', notes: '', reason: '' });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  };

  const submitAction = () => {
    switch (action) {
      case 'triage':
        return run('Report moved to review', () => call('triageReport', { reportId: id, departmentId: form.departmentId || undefined }));
      case 'reject':
        return run('Report rejected', () => call('rejectReport', { reportId: id, reason: form.reason }));
      case 'escalate':
        return run('Report escalated', () => call('escalateReport', { reportId: id, reason: form.reason }));
      case 'assign':
        return run('Field worker assigned', () => call('assignReport', { reportId: id, workerId: form.workerId, notes: form.notes || undefined }));
      case 'reassign':
        return run('Task reassigned', () => call('reassignTask', { reportId: id, workerId: form.workerId, notes: form.notes || undefined }));
    }
  };

  const reasonField = (
    <Field label="Reason" htmlFor="reason" error={error?.fields.reason} hint="At least 10 characters; shown in the report history">
      <Textarea id="reason" rows={3} value={form.reason} onChange={set('reason')} invalid={!!error?.fields.reason} />
    </Field>
  );
  const workerField = (
    <>
      <Field label="Field worker" htmlFor="worker" error={error?.fields.workerId}>
        <Select id="worker" value={form.workerId} onChange={set('workerId')} invalid={!!error?.fields.workerId}>
          <option value="">Choose a {deptName(r.departmentId)} worker…</option>
          {workers.data
            .filter((w) => w.id !== r.assignedWorkerId)
            .map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
        </Select>
      </Field>
      {workers.data.length === 0 && !workers.loading && <Notice tone="warning">No active field workers in this department. Ask an administrator to add one.</Notice>}
      <Field label="Instructions (optional)" htmlFor="notes">
        <Input id="notes" value={form.notes} onChange={set('notes')} placeholder="e.g. Bring a 50 mm coupling" />
      </Field>
    </>
  );

  return (
    <div className="space-y-4">
      <BackLink to="/official/reports">Report queue</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-brand-800">{r.ref}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{r.categoryName}</h1>
          <p className="text-sm text-slate-600">
            {r.suburb}
            {r.landmark ? ` · ${r.landmark}` : ''} · reported {timeAgo(r.createdAt)} by {r.reporterName}
          </p>
        </div>
        <div className="flex items-center gap-2" data-testid="official-status">
          <SeverityBadge severity={r.severity} />
          <StatusBadge status={r.status} />
          {r.affectedCount > 1 && <Pill tone="blue">{r.affectedCount} reports</Pill>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <p className="whitespace-pre-line text-slate-800">{r.description}</p>
            <div className="mt-3">
              <PhotoGrid ids={r.photoIds} label="Resident photo" />
            </div>
            <div className="mt-4">
              <Suspense fallback={<LoadingState label="Loading map" />}>
                <IncidentMap height="h-56" zoom={16} center={r.location} points={[{ id: r.id, location: r.location, colour: categoryColour(r.categoryId), popup: r.ref }]} />
              </Suspense>
              <a
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                href={`https://www.openstreetmap.org/?mlat=${r.location.lat}&mlon=${r.location.lng}#map=18/${r.location.lat}/${r.location.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="size-3.5" aria-hidden /> {r.location.lat.toFixed(5)}, {r.location.lng.toFixed(5)}
              </a>
            </div>
          </Card>
          {(r.status === 'RESOLVED' || r.status === 'CLOSED') && r.resolutionNotes && (
            <Card>
              <h2 className="font-semibold text-emerald-800">Resolution</h2>
              <p className="mt-1 text-sm text-slate-700">{r.resolutionNotes}</p>
              <div className="mt-3">
                <PhotoGrid ids={r.resolutionPhotoIds} label="Proof of repair" />
              </div>
            </Card>
          )}
          <Card>
            <h2 className="mb-4 font-semibold text-slate-900">History</h2>
            {history.loading ? <LoadingState /> : <Timeline items={history.data} />}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-semibold text-slate-900">Actions</h2>
            <dl className="mb-4 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Department</dt>
                <dd className="text-right font-medium">{deptName(r.departmentId)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Field worker</dt>
                <dd className="text-right font-medium">{r.assignedWorkerName ?? '—'}</dd>
              </div>
              {activeTask.data && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Task</dt>
                  <dd className="text-right font-medium">{TASK_LABEL[activeTask.data.status]} · {formatDateTime(activeTask.data.assignedAt)}</dd>
                </div>
              )}
            </dl>
            {done && <Notice tone="success">{done}.</Notice>}
            {error && !Object.keys(error.fields).length && <Notice tone="error">{error.message}</Notice>}

            {!action && (
              <div className="mt-3 grid gap-2">
                {can('triage') && <Button icon={CheckSquare} onClick={() => setAction('triage')}>Review &amp; accept</Button>}
                {canAssign && <Button icon={UserCheck} onClick={() => setAction('assign')}>Assign field worker</Button>}
                {canReassign && <Button variant="secondary" icon={ArrowRightLeft} onClick={() => setAction('reassign')}>Reassign</Button>}
                {can('escalate') && <Button variant="secondary" icon={AlertOctagon} onClick={() => setAction('escalate')}>Escalate</Button>}
                {can('reject') && <Button variant="ghost" icon={XCircle} onClick={() => setAction('reject')} className="text-red-700">Reject</Button>}
                {!can('triage') && !canAssign && !canReassign && !can('escalate') && !can('reject') && (
                  <p className="text-sm text-slate-600">
                    {r.status === 'RESOLVED' ? 'Waiting for the resident to confirm the fix (auto-closes after 7 days).' : 'No further actions for this report.'}
                  </p>
                )}
              </div>
            )}
            {action === 'triage' && (
              <ActionForm title="Review and accept" onCancel={() => setAction(null)}>
                <Field label="Responsible department" htmlFor="dept" error={error?.fields.departmentId}>
                  <Select id="dept" value={form.departmentId || r.departmentId} onChange={set('departmentId')}>
                    {departments.data.filter((d) => d.isActive).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </Select>
                </Field>
                <Button busy={busy} onClick={submitAction} className="w-full">Accept for review</Button>
              </ActionForm>
            )}
            {(action === 'assign' || action === 'reassign') && (
              <ActionForm title={action === 'assign' ? 'Assign field worker' : 'Reassign task'} onCancel={() => setAction(null)}>
                {workerField}
                <Button busy={busy} onClick={submitAction} className="w-full">{action === 'assign' ? 'Assign' : 'Reassign'}</Button>
              </ActionForm>
            )}
            {(action === 'reject' || action === 'escalate') && (
              <ActionForm title={action === 'reject' ? 'Reject report' : 'Escalate to management'} onCancel={() => setAction(null)}>
                {reasonField}
                <Button variant={action === 'reject' ? 'danger' : 'primary'} busy={busy} onClick={submitAction} className="w-full">
                  {action === 'reject' ? 'Reject' : 'Escalate'}
                </Button>
              </ActionForm>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
              <MessageSquare className="size-4" aria-hidden /> Internal notes
            </h2>
            <p className="mb-3 text-xs text-slate-500">Visible to staff only, never to residents.</p>
            <ul className="mb-3 space-y-2">
              {comments.data.length === 0 && <li className="text-sm text-slate-500">No notes yet.</li>}
              {comments.data.map((c) => (
                <li key={c.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                  <p className="text-slate-800">{c.text}</p>
                  <p className="text-xs text-slate-500">{c.authorName} · {timeAgo(c.createdAt)}</p>
                </li>
              ))}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (comment.trim()) void run('Note added', async () => { await call('addComment', { reportId: id, text: comment }); setComment(''); });
              }}
            >
              <Input aria-label="Add an internal note" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note…" />
              <Button type="submit" variant="secondary" disabled={!comment.trim()}>Add</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
