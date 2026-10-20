import { CloudUpload, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../auth/AuthProvider';
import { discard, flushOutbox, useOutbox, type SentEntry } from '../lib/outbox';
import { timeAgo } from '../lib/format';
import { useOnlineStatus } from './pwa';
import { Button, Card } from './ui';

const RETRY_MS = 30_000;

/**
 * FR-27: sends reports saved offline as soon as the device is online again (on start-up, on the
 * browser's "online" event and every 30 s while some are waiting), then says what happened.
 */
export function OutboxSync() {
  const { uid } = useSession();
  const online = useOnlineStatus();
  const waiting = useOutbox(uid).filter((e) => !e.error).length;
  const [sent, setSent] = useState<SentEntry[]>([]);

  useEffect(() => {
    if (!online || waiting === 0) return;
    const send = () => void flushOutbox(uid).then((s) => s.length && setSent((prev) => [...prev, ...s])).catch(() => {});
    send();
    const timer = window.setInterval(send, RETRY_MS);
    return () => window.clearInterval(timer);
  }, [online, waiting, uid]);

  if (sent.length === 0) return null;
  return (
    <div role="status" data-testid="outbox-sent" className="fixed inset-x-0 top-3 z-[1200] mx-auto max-w-md rounded-lg bg-emerald-700 px-4 py-3 text-sm text-white shadow-lg">
      <p className="font-semibold">
        {sent.length === 1 ? 'Your saved report was sent' : `${sent.length} saved reports were sent`}
      </p>
      <ul className="mt-1 space-y-0.5">
        {sent.map((s) => (
          <li key={s.clientId}>
            {s.categoryName}:{' '}
            <Link className="font-semibold underline" to={`/resident/reports/${s.result.duplicateOf?.reportId ?? s.result.reportId}`} onClick={() => setSent([])}>
              {s.result.duplicateOf ? `added to ${s.result.duplicateOf.ref}` : s.result.ref}
            </Link>
          </li>
        ))}
      </ul>
      <button className="mt-2 text-xs underline" onClick={() => setSent([])}>
        Dismiss
      </button>
    </div>
  );
}

/** Reports waiting on this phone, with "send now" and "discard". Hidden when there are none. */
export function OutboxCard() {
  const { uid } = useSession();
  const online = useOnlineStatus();
  const entries = useOutbox(uid);
  const [busy, setBusy] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div data-testid="outbox-card">
    <Card className="bg-amber-50 ring-amber-300">
      <h2 className="flex items-center gap-2 font-semibold text-amber-900">
        <CloudUpload className="size-4" aria-hidden /> Saved on this phone ({entries.length})
      </h2>
      <p className="text-sm text-amber-900">
        {entries.every((e) => e.error)
          ? 'The municipality could not accept these. Discard them and report again.'
          : online
            ? 'Sending now…'
            : "These reports will be sent automatically when you're back online."}
      </p>
      <ul className="mt-2 divide-y divide-amber-200">
        {entries.map((e) => (
          <li key={e.clientId} className="flex items-center justify-between gap-2 py-2 text-sm" data-testid="outbox-entry">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{e.categoryName}</p>
              <p className="text-xs text-slate-600">
                Saved {timeAgo(e.createdAt)} · {e.payload.suburb}
              </p>
              {e.error && <p className="text-xs text-red-700">Not accepted: {e.error}</p>}
            </div>
            <button aria-label={`Discard saved ${e.categoryName} report`} className="rounded p-1.5 text-slate-500 hover:bg-amber-100" onClick={() => void discard(e.clientId)}>
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {online && (
        <Button className="mt-2" variant="secondary" busy={busy} onClick={async () => {
          setBusy(true);
          await flushOutbox(uid).catch(() => {});
          setBusy(false);
        }}>
          Send now
        </Button>
      )}
    </Card>
    </div>
  );
}
