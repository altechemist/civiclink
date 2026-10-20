/**
 * CivicLink Cloud Functions: the command API (callable functions) and scheduled business rules.
 * Reads are served directly from Firestore under Security Rules; every state change goes through here (ADR-0001).
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { COMMANDS } from './commands';
import { command } from './lib/command';
import { AlertService } from './services/alertService';
import { MaintenanceService } from './services/maintenanceService';
import { PublicFeedService, PublicStatsService } from './services/publicStatsService';
import { deliverPushes, withPushScope } from './services/pushService';

// Johannesburg region keeps resident data in South Africa (POPIA, NFR-11).
setGlobalOptions({ region: 'africa-south1', maxInstances: 10 });

export const registerResident = command(COMMANDS.registerResident);
export const createStaffUser = command(COMMANDS.createStaffUser);
export const setUserRole = command(COMMANDS.setUserRole);
export const completeProfile = command(COMMANDS.completeProfile);
export const updateProfile = command(COMMANDS.updateProfile);
export const startGuestSession = command(COMMANDS.startGuestSession);
export const upgradeGuest = command(COMMANDS.upgradeGuest);
export const startGuestTransfer = command(COMMANDS.startGuestTransfer);
export const claimGuestReports = command(COMMANDS.claimGuestReports);
export const deleteMyAccount = command(COMMANDS.deleteMyAccount);
export const setUserActive = command(COMMANDS.setUserActive);
export const submitReport = command(COMMANDS.submitReport);
export const triageReport = command(COMMANDS.triageReport);
export const rejectReport = command(COMMANDS.rejectReport);
export const escalateReport = command(COMMANDS.escalateReport);
export const assignReport = command(COMMANDS.assignReport);
export const assignReports = command(COMMANDS.assignReports);
export const reassignTask = command(COMMANDS.reassignTask);
export const confirmResolution = command(COMMANDS.confirmResolution);
export const reopenReport = command(COMMANDS.reopenReport);
export const affirmReport = command(COMMANDS.affirmReport);
export const registerPushToken = command(COMMANDS.registerPushToken);
export const unregisterPushToken = command(COMMANDS.unregisterPushToken);
export const addComment = command(COMMANDS.addComment);
export const updateTask = command(COMMANDS.updateTask);
export const completeTask = command(COMMANDS.completeTask);
export const broadcastAlert = command(COMMANDS.broadcastAlert);
export const deactivateAlert = command(COMMANDS.deactivateAlert);
export const cancelScheduledAlert = command(COMMANDS.cancelScheduledAlert);
export const markAlertRead = command(COMMANDS.markAlertRead);
export const sendTestSms = command(COMMANDS.sendTestSms);
export const upsertDepartment = command(COMMANDS.upsertDepartment);
export const upsertCategory = command(COMMANDS.upsertCategory);
export const updateSettings = command(COMMANDS.updateSettings);
export const getAnalytics = command(COMMANDS.getAnalytics);
export const runMaintenance = command(COMMANDS.runMaintenance);

// ---- Public transparency figures (FR-36), same cache policy as the Vercel route ----
const publicStatsService = new PublicStatsService();
export const publicStats = onRequest({ cors: true }, async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.json(await publicStatsService.get());
});
const publicFeedService = new PublicFeedService();
export const publicFeed = onRequest({ cors: true }, async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=60');
  res.json(await publicFeedService.get());
});

// ---- Scheduled business rules (FR-13, FR-14, FR-28) ----
export const escalateOverdue = onSchedule({ schedule: 'every 60 minutes', timeZone: 'Africa/Johannesburg' }, async () => {
  await new MaintenanceService().escalateOverdue();
});
export const publishScheduledAlerts = onSchedule({ schedule: 'every 15 minutes', timeZone: 'Africa/Johannesburg' }, async () => {
  const { intents } = await withPushScope(() => new AlertService().publishDue());
  await deliverPushes(intents);
});
export const autoCloseResolved = onSchedule({ schedule: 'every day 02:00', timeZone: 'Africa/Johannesburg' }, async () => {
  await new MaintenanceService().autoCloseResolved();
});
