import { LIMITS, TaskStateMachine, type HistoryDoc, type ReportDoc, type TaskDoc } from '@civiclink/shared';
import { collection, orderBy, query } from 'firebase/firestore';
import { Camera, CheckCircle2, Navigation, Play, ThumbsUp, X } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../../auth/AuthProvider';
import { categoryColour, PhotoGrid, Timeline } from '../../components/domain';
import { BackLink, Button, Card, ErrorState, Field, LoadingState, Notice, Pill, SeverityBadge, Textarea } from '../../components/ui';
import { call, type ApiError } from '../../lib/api';
import { db } from '../../lib/firebase';
import { TASK_LABEL, timeAgo } from '../../lib/format';
import { useLiveDoc, useLiveQuery } from '../../lib/hooks';
import { checkPhoto, toPhotoInputs } from '../../lib/upload';

const IncidentMap = lazy(() => import('../../components/maps').then((m) => ({ default: m.IncidentMap })));

/** FR-11 / BR-08 / BR-09: accept → start → complete with notes and proof photos (TX-3). */
export function TaskPage() {
  const { id = '' } = useParams();
  const { uid } = useSession();
  const task = useLiveDoc<TaskDoc>(`tasks/${id}`);
  const t = task.data;
  const isMine = t?.workerId === uid;
  const report = useLiveDoc<ReportDoc>(t && isMine ? `reports/${t.reportId}` : null);
  const history = useLiveQuery<HistoryDoc>(
    t && isMine ? query(collection(db, 'reports', t.reportId, 'history'), orderBy('at')) : null,
    `history-${t?.reportId}`,
  );
  const [notes, setNotes] = useState('');
  const [proof, setProof] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  if (task.loading) return <LoadingState />;
  if (task.error || !t) return <ErrorState error={task.error ?? 'Task not found or not assigned to you.'} />;
  const r = report.data;

  const act = async (action: 'accept' | 'start') => {
    setBusy(action);
    setError(null);
    try {
      await call('updateTask', { taskId: id, action });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(null);
    }
  };

  const complete = async () => {
    setBusy('complete');
    setError(null);
    try {
      const proofs = await toPhotoInputs(proof);
      await call('completeTask', { taskId: id, notes, proofs });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(null);
    }
  };

  const addProof = (files: FileList | null) => {
    setPhotoError(null);
    for (const f of Array.from(files ?? [])) {
      const problem = checkPhoto(f);
      if (problem) return setPhotoError(problem);
    }
    const next = [...proof, ...Array.from(files ?? [])];
    if (next.length > LIMITS.photosMax) return setPhotoError(`At most ${LIMITS.photosMax} photos`);
    setProof(next);
  };

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${t.location.lat},${t.location.lng}`;

  return (
    <div className="space-y-4">
      <BackLink to="/worker">My tasks</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold text-field-700">{t.reportRef}</p>
          <h1 className="text-xl font-bold text-slate-900">{t.categoryName}</h1>
          <p className="text-sm text-slate-600">
            {t.suburb}
            {r?.landmark ? ` · ${r.landmark}` : ''} · assigned {timeAgo(t.assignedAt)}
          </p>
        </div>
        <div className="flex gap-1.5" data-testid="task-status">
          <SeverityBadge severity={t.priority} />
          <Pill tone={t.status === 'COMPLETED' ? 'green' : 'blue'}>{TASK_LABEL[t.status]}</Pill>
        </div>
      </div>

      {(t.status === 'REASSIGNED' || t.status === 'CANCELLED') && <Notice tone="warning">This task is no longer yours. It was {t.status.toLowerCase()}.</Notice>}
      {error && !Object.keys(error.fields).length && <Notice tone="error">{error.message}</Notice>}

      {TaskStateMachine.can(t.status, 'accept') && (
        <Button className="w-full" variant="success" icon={ThumbsUp} busy={busy === 'accept'} onClick={() => act('accept')}>
          Accept task
        </Button>
      )}
      {TaskStateMachine.can(t.status, 'start') && (
        <Button className="w-full" icon={Play} busy={busy === 'start'} onClick={() => act('start')}>
          I'm on site, start work
        </Button>
      )}

      {TaskStateMachine.can(t.status, 'complete') && (
        <Card className="ring-emerald-200">
          <h2 className="mb-3 font-semibold text-slate-900">Complete the task</h2>
          <div className="space-y-4">
            <Field label="What did you do?" htmlFor="notes" error={error?.fields.notes} hint={`At least ${LIMITS.completionNotesMin} characters`}>
              <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} invalid={!!error?.fields.notes} placeholder="e.g. Pipe joint replaced and pressure tested. No further leakage." />
            </Field>
            <Field label="Proof photos" htmlFor="proof" error={photoError ?? error?.fields.proofs} hint="At least one photo of the completed work">
              <div className="flex flex-wrap gap-2">
                {proof.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(p)} alt={`Proof ${i + 1}`} className="size-20 rounded-lg object-cover" />
                    <button type="button" aria-label={`Remove proof ${i + 1}`} onClick={() => setProof(proof.filter((_, j) => j !== i))} className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-1 text-white">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {proof.length < LIMITS.photosMax && (
                  <label htmlFor="proof" className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500">
                    <Camera className="size-5" aria-hidden /> Add
                  </label>
                )}
                <input id="proof" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only" onChange={(e) => addProof(e.target.files)} />
              </div>
            </Field>
            <Button className="w-full" variant="success" icon={CheckCircle2} busy={busy === 'complete'} onClick={complete}>
              Mark as resolved
            </Button>
          </div>
        </Card>
      )}

      {t.status === 'COMPLETED' && (
        <Card>
          <h2 className="font-semibold text-emerald-800">Completed {timeAgo(t.completedAt)}</h2>
          <p className="mt-1 text-sm text-slate-700">{t.completionNotes}</p>
          <div className="mt-3">
            <PhotoGrid ids={t.proofIds} label="Proof" />
          </div>
        </Card>
      )}

      <Card>
        {t.notes && (
          <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Instructions:</strong> {t.notes}
          </p>
        )}
        {r ? (
          <>
            <p className="whitespace-pre-line text-slate-800">{r.description}</p>
            <div className="mt-3">
              <PhotoGrid ids={r.photoIds} label="Resident photo" />
            </div>
          </>
        ) : (
          isMine && <LoadingState />
        )}
        <div className="mt-4">
          <Suspense fallback={<LoadingState label="Loading map" />}>
            <IncidentMap height="h-48" zoom={16} center={t.location} points={[{ id: t.reportId, location: t.location, colour: categoryColour(''), popup: t.reportRef }]} />
          </Suspense>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-field-700 hover:underline">
            <Navigation className="size-4" aria-hidden /> Navigate there
          </a>
        </div>
      </Card>

      {isMine && (
        <Card>
          <h2 className="mb-4 font-semibold text-slate-900">History</h2>
          <Timeline items={history.data} />
        </Card>
      )}
    </div>
  );
}
