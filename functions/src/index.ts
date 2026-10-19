/**
 * CivicLink Cloud Functions: the command API (callable functions) and scheduled business rules.
 * Reads are served directly from Firestore under Security Rules; every state change goes through here (ADR-0001).
 */
import {
  addCommentSchema,
  alertIdSchema,
  analyticsQuerySchema,
  assignReportSchema,
  broadcastAlertSchema,
  completeTaskSchema,
  confirmResolutionSchema,
  createStaffUserSchema,
  escalateReportSchema,
  reassignTaskSchema,
  registerResidentSchema,
  rejectReportSchema,
  reopenReportSchema,
  setUserActiveSchema,
  setUserRoleSchema,
  submitReportSchema,
  triageReportSchema,
  updateTaskSchema,
  upsertCategorySchema,
  upsertDepartmentSchema,
} from '@civiclink/shared';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { z } from 'zod';
import { command } from './lib/command';
import { isEmulator } from './lib/firebase';
import { AlertService } from './services/alertService';
import { AnalyticsService } from './services/analyticsService';
import { CommentService } from './services/commentService';
import { ConfigService } from './services/configService';
import { MaintenanceService } from './services/maintenanceService';
import { ReportService } from './services/reportService';
import { TaskService } from './services/taskService';
import { UserService } from './services/userService';

// Johannesburg region keeps resident data in South Africa (POPIA, NFR-11).
setGlobalOptions({ region: 'africa-south1', maxInstances: 10 });

const reports = new ReportService();
const tasks = new TaskService();
const alerts = new AlertService();
const users = new UserService();
const config = new ConfigService();
const comments = new CommentService();
const analytics = new AnalyticsService();

const STAFF_MANAGERS = ['OFFICIAL', 'ADMIN'] as const;

// ---- Accounts (FR-01, FR-20) ----
export const registerResident = command({ name: 'registerResident', schema: registerResidentSchema, roles: 'public', handler: (i) => users.registerResident(i) });
export const createStaffUser = command({ name: 'createStaffUser', schema: createStaffUserSchema, roles: ['ADMIN'], handler: (i, a) => users.createStaff(i, a) });
export const setUserRole = command({ name: 'setUserRole', schema: setUserRoleSchema, roles: ['ADMIN'], handler: (i, a) => users.setRole(i, a) });
export const setUserActive = command({ name: 'setUserActive', schema: setUserActiveSchema, roles: ['ADMIN'], handler: (i, a) => users.setActive(i.uid, i.active, a) });

// ---- Reports (FR-03..FR-14) ----
export const submitReport = command({ name: 'submitReport', schema: submitReportSchema, roles: ['RESIDENT'], handler: (i, a) => reports.submit(i, a) });
export const triageReport = command({ name: 'triageReport', schema: triageReportSchema, roles: STAFF_MANAGERS, handler: (i, a) => reports.triage(i, a) });
export const rejectReport = command({ name: 'rejectReport', schema: rejectReportSchema, roles: STAFF_MANAGERS, handler: (i, a) => reports.reject(i, a) });
export const escalateReport = command({ name: 'escalateReport', schema: escalateReportSchema, roles: STAFF_MANAGERS, handler: (i, a) => reports.escalate(i, a) });
export const assignReport = command({ name: 'assignReport', schema: assignReportSchema, roles: STAFF_MANAGERS, handler: (i, a) => reports.assign(i, a) });
export const reassignTask = command({ name: 'reassignTask', schema: reassignTaskSchema, roles: STAFF_MANAGERS, handler: (i, a) => reports.reassign(i, a) });
export const confirmResolution = command({ name: 'confirmResolution', schema: confirmResolutionSchema, roles: ['RESIDENT'], handler: (i, a) => reports.confirm(i.reportId, a) });
export const reopenReport = command({ name: 'reopenReport', schema: reopenReportSchema, roles: ['RESIDENT'], handler: (i, a) => reports.reopen(i, a) });
export const addComment = command({ name: 'addComment', schema: addCommentSchema, roles: ['OFFICIAL', 'FIELD_WORKER', 'ADMIN'], handler: (i, a) => comments.add(i.reportId, i.text, a) });

// ---- Tasks (FR-11) ----
export const updateTask = command({ name: 'updateTask', schema: updateTaskSchema, roles: ['FIELD_WORKER'], handler: (i, a) => tasks.update(i, a) });
export const completeTask = command({ name: 'completeTask', schema: completeTaskSchema, roles: ['FIELD_WORKER'], handler: (i, a) => tasks.complete(i, a) });

// ---- Alerts (FR-16..FR-18) ----
export const broadcastAlert = command({ name: 'broadcastAlert', schema: broadcastAlertSchema, roles: STAFF_MANAGERS, handler: (i, a) => alerts.broadcast(i, a) });
export const deactivateAlert = command({ name: 'deactivateAlert', schema: alertIdSchema, roles: STAFF_MANAGERS, handler: (i) => alerts.deactivate(i.alertId) });
export const markAlertRead = command({ name: 'markAlertRead', schema: alertIdSchema, roles: ['RESIDENT'], handler: (i, a) => alerts.markRead(i.alertId, a) });

// ---- Configuration and insight (FR-19, FR-21) ----
export const upsertDepartment = command({ name: 'upsertDepartment', schema: upsertDepartmentSchema, roles: ['ADMIN'], handler: (i, a) => config.upsertDepartment(i, a) });
export const upsertCategory = command({ name: 'upsertCategory', schema: upsertCategorySchema, roles: ['ADMIN'], handler: (i, a) => config.upsertCategory(i, a) });
export const getAnalytics = command({ name: 'getAnalytics', schema: analyticsQuerySchema, roles: STAFF_MANAGERS, handler: (i) => analytics.summary(i.days) });

// ---- Scheduled business rules (FR-13, FR-14) ----
export const escalateOverdue = onSchedule({ schedule: 'every 60 minutes', timeZone: 'Africa/Johannesburg' }, async () => {
  await new MaintenanceService().escalateOverdue();
});
export const autoCloseResolved = onSchedule({ schedule: 'every day 02:00', timeZone: 'Africa/Johannesburg' }, async () => {
  await new MaintenanceService().autoCloseResolved();
});

/**
 * Admin-triggered run of the scheduled rules (useful in the demo, where the emulator does not fire schedules).
 * A simulated clock (`now`) is accepted only in the emulator, for tests.
 */
export const runMaintenance = command({
  name: 'runMaintenance',
  schema: z.object({ now: z.number().int().optional() }),
  roles: ['ADMIN'],
  handler: async (i) => {
    const clock = isEmulator && i.now ? () => i.now! : Date.now;
    const m = new MaintenanceService(clock);
    return { escalated: await m.escalateOverdue(), closed: await m.autoCloseResolved() };
  },
});
