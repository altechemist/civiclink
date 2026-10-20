import type { AlertType, ReportStatus, Role, Severity, TaskStatus } from './constants';
import type { LatLng } from './policies';

/** Structural type satisfied by both the client and Admin SDK Timestamp classes. */
export interface TimestampLike {
  toMillis(): number;
}

export interface UserDoc {
  name: string;
  email: string;
  phone?: string | null;
  /** FR-25: opted in to emergency alerts by SMS. */
  smsAlerts?: boolean;
  role: Role;
  departmentId?: string | null;
  suburb?: string | null;
  isActive: boolean;
  createdAt: TimestampLike;
  lastLoginAt?: TimestampLike | null;
}

/** Custom claims carried in the ID token and used by Security Rules. */
export interface Claims {
  role: Role;
  dept?: string | null;
  suburb?: string | null;
  active: boolean;
}

export interface DepartmentDoc {
  name: string;
  slaHours: number;
  isActive: boolean;
}

export interface SettingsDoc {
  reportsPerHour: number;
}

export interface CategoryDoc {
  name: string;
  icon: string;
  departmentId: string;
  isActive: boolean;
}

export interface ReportDoc {
  ref: string;
  reporterId: string;
  reporterName: string;
  categoryId: string;
  categoryName: string;
  departmentId: string;
  description: string;
  location: LatLng;
  geohash: string;
  suburb: string;
  landmark?: string | null;
  severity: Severity;
  /** Ids of `photos` documents (evidence). */
  photoIds: string[];
  status: ReportStatus;
  assignedWorkerId?: string | null;
  assignedWorkerName?: string | null;
  activeTaskId?: string | null;
  parentReportId?: string | null;
  parentRef?: string | null;
  affectedCount: number;
  /** Residents whose duplicate reports point here; they receive this report's status updates (FR-15). */
  followerIds: string[];
  resolutionNotes?: string | null;
  /** Ids of `photos` documents (proof of repair), copied from the completed task. */
  resolutionPhotoIds?: string[];
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  resolvedAt?: TimestampLike | null;
  escalatedAt?: TimestampLike | null;
  closedAt?: TimestampLike | null;
  /** FR-37: the reporter's 1–5 rating given when confirming the fix. */
  rating?: number | null;
  feedback?: string | null;
}

export interface HistoryDoc {
  from: ReportStatus | null;
  to: ReportStatus;
  event: string;
  actorId: string;
  actorRole: Role | 'SYSTEM';
  actorName: string;
  note: string;
  at: TimestampLike;
}

export interface PublicReportDoc {
  ref: string;
  categoryId: string;
  categoryName: string;
  status: ReportStatus;
  location: LatLng;
  suburb: string;
  affectedCount: number;
  isOpen: boolean;
  createdAt: TimestampLike;
}

export interface TaskDoc {
  reportId: string;
  reportRef: string;
  workerId: string;
  workerName: string;
  assignedBy: string;
  departmentId: string;
  categoryName: string;
  priority: Severity;
  status: TaskStatus;
  location: LatLng;
  suburb: string;
  notes?: string | null;
  completionNotes?: string | null;
  proofIds: string[];
  assignedAt: TimestampLike;
  acceptedAt?: TimestampLike | null;
  startedAt?: TimestampLike | null;
  completedAt?: TimestampLike | null;
  endedAt?: TimestampLike | null;
}

/** A compressed photo stored as binary in Firestore (ADR-0006). Readable by whoever can read its report. */
export interface PhotoDoc<B = unknown> {
  reportId: string;
  ownerId: string;
  kind: 'EVIDENCE' | 'PROOF';
  contentType: string;
  size: number;
  data: B;
  createdAt: TimestampLike;
}

export interface AlertDoc {
  type: AlertType;
  title: string;
  message: string;
  targetSuburbs: string[];
  createdBy: string;
  createdByName: string;
  isActive: boolean;
  recipientCount: number;
  readCount: number;
  /** FR-25: SMS messages queued for opted-in residents (emergency alerts only). */
  smsCount?: number;
  createdAt: TimestampLike;
  expiresAt: TimestampLike;
}

/** FR-25: one SMS for one resident (server-only; administrators can read it). */
export interface SmsDoc {
  uid: string;
  to: string;
  body: string;
  alertId: string;
  status: 'QUEUED' | 'SENT' | 'SIMULATED' | 'FAILED';
  gateway: string;
  providerId?: string | null;
  error?: string | null;
  createdAt: TimestampLike;
  sentAt?: TimestampLike | null;
}

/** FR-28: an alert waiting for its publish time. On publishing, the alert is created with the same id. */
export interface ScheduledAlertDoc {
  type: AlertType;
  title: string;
  message: string;
  targetSuburbs: string[];
  createdBy: string;
  createdByName: string;
  publishAt: TimestampLike;
  expiresAt: TimestampLike;
  status: 'SCHEDULED' | 'PUBLISHED' | 'CANCELLED';
  createdAt: TimestampLike;
  publishedAt?: TimestampLike | null;
  recipientCount?: number;
}

/** FR-36: anonymous, aggregate figures for the public transparency page (no personal data). */
export interface PublicStats {
  generatedAt: number;
  days: number;
  summary: import('./analytics').AnalyticsSummary;
  categories: Record<string, string>;
  openBySuburb: Record<string, number>;
  satisfaction: { average: number | null; ratings: number };
}

export interface AlertRecipientDoc {
  uid: string;
  alertId: string;
  channel: 'IN_APP';
  deliveredAt: TimestampLike;
  readAt?: TimestampLike | null;
}

export type NotificationType = 'REPORT_STATUS' | 'NEW_REPORT' | 'TASK_ASSIGNED' | 'TASK_UPDATE' | 'ALERT';

export interface NotificationDoc {
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  readAt?: TimestampLike | null;
  createdAt: TimestampLike;
}

export interface CommentDoc {
  authorId: string;
  authorName: string;
  authorRole: Role;
  text: string;
  createdAt: TimestampLike;
}

export interface SystemLogDoc {
  level: 'INFO' | 'WARNING' | 'ERROR';
  source: string;
  message: string;
  actorId?: string | null;
  createdAt: TimestampLike;
}

/** Callable function names and their result shapes (the API contract between web and functions). */
export interface CallableResults {
  registerResident: { uid: string };
  submitReport: { reportId: string; ref: string; duplicateOf: { reportId: string; ref: string } | null; replayed?: boolean };
  triageReport: { status: ReportStatus };
  rejectReport: { status: ReportStatus };
  escalateReport: { status: ReportStatus };
  assignReport: { taskId: string };
  assignReports: { assigned: { reportId: string; taskId: string }[]; failed: { reportId: string; message: string }[] };
  reassignTask: { taskId: string };
  updateTask: { status: TaskStatus };
  completeTask: { status: TaskStatus };
  confirmResolution: { status: ReportStatus };
  reopenReport: { status: ReportStatus };
  addComment: { commentId: string };
  broadcastAlert: { alertId: string; recipientCount: number; scheduled: boolean };
  cancelScheduledAlert: { ok: true };
  deactivateAlert: { ok: true };
  markAlertRead: { ok: true };
  createStaffUser: { uid: string };
  setUserRole: { ok: true };
  setUserActive: { ok: true };
  upsertDepartment: { id: string };
  upsertCategory: { id: string };
  getAnalytics: import('./analytics').AnalyticsSummary;
  completeProfile: { ok: true };
  registerPushToken: { ok: true };
  unregisterPushToken: { ok: true };
  affirmReport: { affectedCount: number; alreadyConfirmed: boolean };
  updateSettings: { ok: true };
  updateProfile: { ok: true };
  deleteMyAccount: { ok: true; anonymisedReports: number };
  runMaintenance: { escalated: number; closed: number; published: number };
}
