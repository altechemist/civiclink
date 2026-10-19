import type { ReportStatus, Role, TaskStatus } from './constants';

export type ReportEvent =
  | 'submit'
  | 'markDuplicate'
  | 'triage'
  | 'reject'
  | 'assign'
  | 'reassign'
  | 'escalate'
  | 'completeTask'
  | 'confirm'
  | 'autoClose'
  | 'reopen';

export type Actor = Role | 'SYSTEM';

interface Transition {
  from: readonly (ReportStatus | null)[];
  to: ReportStatus;
  actors: readonly Actor[];
}

/** Report lifecycle (srs.md §7, BR-05). `null` is the not-yet-created state. */
export const REPORT_TRANSITIONS: Record<ReportEvent, Transition> = {
  submit: { from: [null], to: 'SUBMITTED', actors: ['RESIDENT'] },
  markDuplicate: { from: [null], to: 'DUPLICATE', actors: ['SYSTEM'] },
  triage: { from: ['SUBMITTED'], to: 'UNDER_REVIEW', actors: ['OFFICIAL', 'ADMIN'] },
  reject: { from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'REJECTED', actors: ['OFFICIAL', 'ADMIN'] },
  assign: { from: ['UNDER_REVIEW', 'ESCALATED'], to: 'IN_PROGRESS', actors: ['OFFICIAL', 'ADMIN'] },
  reassign: { from: ['IN_PROGRESS', 'ESCALATED'], to: 'IN_PROGRESS', actors: ['OFFICIAL', 'ADMIN'] },
  escalate: {
    from: ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS'],
    to: 'ESCALATED',
    actors: ['OFFICIAL', 'ADMIN', 'SYSTEM'],
  },
  completeTask: { from: ['IN_PROGRESS', 'ESCALATED'], to: 'RESOLVED', actors: ['FIELD_WORKER'] },
  confirm: { from: ['RESOLVED'], to: 'CLOSED', actors: ['RESIDENT'] },
  autoClose: { from: ['RESOLVED'], to: 'CLOSED', actors: ['SYSTEM'] },
  reopen: { from: ['RESOLVED'], to: 'UNDER_REVIEW', actors: ['RESIDENT'] },
};

export class TransitionError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid-transition' | 'actor-not-allowed',
  ) {
    super(message);
    this.name = 'TransitionError';
  }
}

export const ReportStateMachine = {
  /** Returns the target status or throws TransitionError. */
  next(from: ReportStatus | null, event: ReportEvent, actor: Actor): ReportStatus {
    const t = REPORT_TRANSITIONS[event];
    if (!t.from.includes(from)) {
      throw new TransitionError(`Cannot ${event} a report that is ${from ?? 'new'}`, 'invalid-transition');
    }
    if (!t.actors.includes(actor)) {
      throw new TransitionError(`${actor} may not ${event} a report`, 'actor-not-allowed');
    }
    return t.to;
  },
  can(from: ReportStatus | null, event: ReportEvent, actor: Actor): boolean {
    const t = REPORT_TRANSITIONS[event];
    return t.from.includes(from) && t.actors.includes(actor);
  },
  /** Events available from a status, used by the UI to show only valid actions. */
  eventsFrom(from: ReportStatus, actor: Actor): ReportEvent[] {
    return (Object.keys(REPORT_TRANSITIONS) as ReportEvent[]).filter((e) => ReportStateMachine.can(from, e, actor));
  },
};

export type TaskEvent = 'accept' | 'start' | 'complete' | 'reassign' | 'cancel';

const TASK_TRANSITIONS: Record<TaskEvent, { from: readonly TaskStatus[]; to: TaskStatus }> = {
  accept: { from: ['ASSIGNED'], to: 'ACCEPTED' },
  start: { from: ['ACCEPTED'], to: 'IN_PROGRESS' },
  complete: { from: ['IN_PROGRESS'], to: 'COMPLETED' },
  reassign: { from: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'], to: 'REASSIGNED' },
  cancel: { from: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'], to: 'CANCELLED' },
};

/** Task lifecycle (BR-08): ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED. */
export const TaskStateMachine = {
  next(from: TaskStatus, event: TaskEvent): TaskStatus {
    const t = TASK_TRANSITIONS[event];
    if (!t.from.includes(from)) {
      throw new TransitionError(`Cannot ${event} a task that is ${from}`, 'invalid-transition');
    }
    return t.to;
  },
  can(from: TaskStatus, event: TaskEvent): boolean {
    return TASK_TRANSITIONS[event].from.includes(from);
  },
};
