import type { TaskDoc } from '@civiclink/shared';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { ListChecks, MapPin } from 'lucide-react';
import { useSession } from '../../auth/AuthProvider';
import { ReportLink } from '../../components/domain';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pill, SeverityBadge, Stat } from '../../components/ui';
import { db } from '../../lib/firebase';
import { TASK_LABEL, timeAgo } from '../../lib/format';
import { useLiveQuery, type WithId } from '../../lib/hooks';

const DAY = 24 * 3600_000;

function TaskCard({ task: t }: { task: WithId<TaskDoc> }) {
  return (
    <ReportLink to={`/worker/tasks/${t.id}`}>
      <div className="space-y-1.5" data-testid="task-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-slate-900">{t.categoryName}</p>
          <div className="flex gap-1.5">
            <SeverityBadge severity={t.priority} />
            <Pill tone={t.status === 'COMPLETED' ? 'green' : t.status === 'IN_PROGRESS' ? 'blue' : 'amber'}>{TASK_LABEL[t.status]}</Pill>
          </div>
        </div>
        <p className="flex items-center gap-1 text-sm text-slate-600">
          <MapPin className="size-3.5" aria-hidden /> {t.suburb} · {t.reportRef}
        </p>
        {t.notes && <p className="text-sm text-slate-700">“{t.notes}”</p>}
        <p className="text-xs text-slate-500">Assigned {timeAgo(t.assignedAt)}</p>
      </div>
    </ReportLink>
  );
}

/** FR-11: the field worker's task list, grouped by progress. */
export function WorkerHome() {
  const { uid, profile } = useSession();
  const { data, loading, error } = useLiveQuery<TaskDoc>(
    query(collection(db, 'tasks'), where('workerId', '==', uid), orderBy('assignedAt', 'desc')),
    `tasks-${uid}`,
  );
  const now = Date.now();
  const todo = data.filter((t) => t.status === 'ASSIGNED' || t.status === 'ACCEPTED').sort((a, b) => priority(a) - priority(b));
  const doing = data.filter((t) => t.status === 'IN_PROGRESS');
  const doneToday = data.filter((t) => t.status === 'COMPLETED' && t.completedAt && now - t.completedAt.toMillis() < DAY);

  return (
    <div className="space-y-5">
      <PageHeader title="My tasks" subtitle={profile?.name} />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="To do" value={todo.length} tone="amber" />
        <Stat label="On site" value={doing.length} tone="blue" />
        <Stat label="Done today" value={doneToday.length} tone="green" />
      </div>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {!loading && !error && data.length === 0 && <EmptyState icon={ListChecks} title="No tasks assigned" body="New assignments appear here instantly." />}
      {[
        ['In progress', doing],
        ['To do', todo],
        ['Completed today', doneToday],
      ].map(([title, list]) =>
        (list as WithId<TaskDoc>[]).length ? (
          <section key={title as string} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title as string}</h2>
            {(list as WithId<TaskDoc>[]).map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </section>
        ) : null,
      )}
    </div>
  );
}

const priority = (t: TaskDoc) => ({ HIGH: 0, MEDIUM: 1, LOW: 2 })[t.priority];
