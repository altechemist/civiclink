/**
 * Every state-changing command of the CivicLink API, defined once and served by two adapters:
 * Cloud Functions (`index.ts`, used with the emulator) and plain Node HTTP (`http.ts`, used on Vercel).
 * Both run `execute()`, so authentication, roles, validation and errors behave identically (ADR-0006).
 */
import {
  addCommentSchema,
  affirmReportSchema,
  pushTokenSchema,
  alertIdSchema,
  analyticsQuerySchema,
  assignReportSchema,
  assignReportsSchema,
  scheduledAlertIdSchema,
  broadcastAlertSchema,
  completeProfileSchema,
  deleteAccountSchema,
  updateProfileSchema,
  updateSettingsSchema,
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
import { z } from 'zod';
import { defineCommand } from './lib/command';
import { isEmulator } from './lib/firebase';
import { AlertService } from './services/alertService';
import { AnalyticsService } from './services/analyticsService';
import { CommentService } from './services/commentService';
import { ConfigService } from './services/configService';
import { MaintenanceService } from './services/maintenanceService';
import { ReportService } from './services/reportService';
import { TaskService } from './services/taskService';
import { UserService } from './services/userService';
import { PushTokens } from './services/pushService';

const reports = new ReportService();
const tasks = new TaskService();
const alerts = new AlertService();
const users = new UserService();
const config = new ConfigService();
const comments = new CommentService();
const analytics = new AnalyticsService();

const STAFF_MANAGERS = ['OFFICIAL', 'ADMIN'] as const;

export const COMMANDS = {
  registerResident: defineCommand({ name: 'registerResident', schema: registerResidentSchema, roles: 'public', handler: (i) => users.registerResident(i) }),
  createStaffUser: defineCommand({ name: 'createStaffUser', schema: createStaffUserSchema, roles: ['ADMIN'], handler: (i, a) => users.createStaff(i, a) }),
  setUserRole: defineCommand({ name: 'setUserRole', schema: setUserRoleSchema, roles: ['ADMIN'], handler: (i, a) => users.setRole(i, a) }),
  completeProfile: defineCommand({ name: 'completeProfile', schema: completeProfileSchema, roles: 'signed-in', handler: (i, a) => users.completeProfile(a.uid, i) }),
  updateProfile: defineCommand({ name: 'updateProfile', schema: updateProfileSchema, roles: ['RESIDENT', 'OFFICIAL', 'FIELD_WORKER', 'ADMIN'], handler: (i, a) => users.updateProfile(i, a) }),
  deleteMyAccount: defineCommand({ name: 'deleteMyAccount', schema: deleteAccountSchema, roles: ['RESIDENT'], handler: (_i, a) => users.deleteMyAccount(a) }),
  setUserActive: defineCommand({ name: 'setUserActive', schema: setUserActiveSchema, roles: ['ADMIN'], handler: (i, a) => users.setActive(i.uid, i.active, a) }),
  submitReport: defineCommand({ name: 'submitReport', schema: submitReportSchema, roles: ['RESIDENT'], handler: (i, a) => reports.submit(i, a) }),
  triageReport: defineCommand({ name: 'triageReport', schema: triageReportSchema, roles: STAFF_MANAGERS, handler: (i, a) => reports.triage(i, a) }),
  rejectReport: defineCommand({ name: 'rejectReport', schema: rejectReportSchema, roles: STAFF_MANAGERS, handler: (i, a) => reports.reject(i, a) }),
  escalateReport: defineCommand({ name: 'escalateReport', schema: escalateReportSchema, roles: STAFF_MANAGERS, handler: (i, a) => reports.escalate(i, a) }),
  assignReport: defineCommand({ name: 'assignReport', schema: assignReportSchema, roles: STAFF_MANAGERS, handler: (i, a) => reports.assign(i, a) }),
  assignReports: defineCommand({ name: 'assignReports', schema: assignReportsSchema, roles: STAFF_MANAGERS, handler: (i, a) => reports.assignMany(i, a) }),
  reassignTask: defineCommand({ name: 'reassignTask', schema: reassignTaskSchema, roles: STAFF_MANAGERS, handler: (i, a) => reports.reassign(i, a) }),
  confirmResolution: defineCommand({ name: 'confirmResolution', schema: confirmResolutionSchema, roles: ['RESIDENT'], handler: (i, a) => reports.confirm(i, a) }),
  registerPushToken: defineCommand({ name: 'registerPushToken', schema: pushTokenSchema, roles: ['RESIDENT', 'OFFICIAL', 'FIELD_WORKER', 'ADMIN'], handler: (i, a) => PushTokens.register(a.uid, i.token) }),
  unregisterPushToken: defineCommand({ name: 'unregisterPushToken', schema: pushTokenSchema, roles: ['RESIDENT', 'OFFICIAL', 'FIELD_WORKER', 'ADMIN'], handler: (i, a) => PushTokens.unregister(a.uid, i.token) }),
  affirmReport: defineCommand({ name: 'affirmReport', schema: affirmReportSchema, roles: ['RESIDENT'], handler: (i, a) => reports.affirm(i.reportId, a) }),
  reopenReport: defineCommand({ name: 'reopenReport', schema: reopenReportSchema, roles: ['RESIDENT'], handler: (i, a) => reports.reopen(i, a) }),
  addComment: defineCommand({ name: 'addComment', schema: addCommentSchema, roles: ['OFFICIAL', 'FIELD_WORKER', 'ADMIN'], handler: (i, a) => comments.add(i.reportId, i.text, a) }),
  updateTask: defineCommand({ name: 'updateTask', schema: updateTaskSchema, roles: ['FIELD_WORKER'], handler: (i, a) => tasks.update(i, a) }),
  completeTask: defineCommand({ name: 'completeTask', schema: completeTaskSchema, roles: ['FIELD_WORKER'], handler: (i, a) => tasks.complete(i, a) }),
  broadcastAlert: defineCommand({ name: 'broadcastAlert', schema: broadcastAlertSchema, roles: STAFF_MANAGERS, handler: (i, a) => alerts.broadcast(i, a) }),
  deactivateAlert: defineCommand({ name: 'deactivateAlert', schema: alertIdSchema, roles: STAFF_MANAGERS, handler: (i) => alerts.deactivate(i.alertId) }),
  cancelScheduledAlert: defineCommand({ name: 'cancelScheduledAlert', schema: scheduledAlertIdSchema, roles: STAFF_MANAGERS, handler: (i, a) => alerts.cancelScheduled(i.scheduledId, a) }),
  markAlertRead: defineCommand({ name: 'markAlertRead', schema: alertIdSchema, roles: ['RESIDENT'], handler: (i, a) => alerts.markRead(i.alertId, a) }),
  upsertDepartment: defineCommand({ name: 'upsertDepartment', schema: upsertDepartmentSchema, roles: ['ADMIN'], handler: (i, a) => config.upsertDepartment(i, a) }),
  upsertCategory: defineCommand({ name: 'upsertCategory', schema: upsertCategorySchema, roles: ['ADMIN'], handler: (i, a) => config.upsertCategory(i, a) }),
  updateSettings: defineCommand({ name: 'updateSettings', schema: updateSettingsSchema, roles: ['ADMIN'], handler: (i, a) => config.updateSettings(i, a) }),
  getAnalytics: defineCommand({ name: 'getAnalytics', schema: analyticsQuerySchema, roles: STAFF_MANAGERS, handler: (i) => analytics.summary(i.days) }),
  runMaintenance: defineCommand({
    name: 'runMaintenance',
    schema: z.object({ now: z.number().int().optional() }),
    roles: ['ADMIN'],
    handler: async (i) => {
      const clock = isEmulator && i.now ? () => i.now! : Date.now;
      return new MaintenanceService(clock).runAll();
    },
  }),
};

export type CommandName = keyof typeof COMMANDS;
