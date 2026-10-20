import { z } from 'zod';
import { ALERT_TYPES, ALL_SUBURBS, LIMITS, MUNICIPAL_BOUNDS, ROLES, SEVERITIES, SUBURBS } from './constants';

const id = z.string().trim().min(1, 'Required').max(128);
const reason = z
  .string()
  .trim()
  .min(LIMITS.reasonMin, `At least ${LIMITS.reasonMin} characters`)
  .max(LIMITS.reasonMax, `At most ${LIMITS.reasonMax} characters`);

export const locationSchema = z
  .object({ lat: z.number().finite(), lng: z.number().finite() })
  .refine(
    ({ lat, lng }) =>
      lat >= MUNICIPAL_BOUNDS.minLat &&
      lat <= MUNICIPAL_BOUNDS.maxLat &&
      lng >= MUNICIPAL_BOUNDS.minLng &&
      lng <= MUNICIPAL_BOUNDS.maxLng,
    { message: 'Location must be inside Sol Plaatje Municipality' },
  );

export const suburbSchema = z.enum(SUBURBS, { error: 'Choose a suburb from the list' });

/** Client-side check of a picked file (BR-02) before it is compressed. */
export const photoFileSchema = z.object({
  type: z.enum(LIMITS.photoTypes, { error: 'Photos must be JPEG, PNG or WebP' }),
  size: z.number().max(LIMITS.photoBytesMax, 'Each photo must be 15 MB or smaller'),
});

/**
 * A compressed photo in transit (base64). Stored server-side as binary in its own Firestore
 * document (ADR-0006); the server verifies the decoded size and the real file type (magic bytes).
 */
export const photoInputSchema = z.object({
  contentType: z.enum(LIMITS.photoTypes, { error: 'Photos must be JPEG, PNG or WebP' }),
  data: z
    .string()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Photo data is corrupted')
    .max(Math.ceil((LIMITS.storedPhotoBytesMax * 4) / 3) + 4, 'Photo is too large after compression'),
});
export type PhotoInput = z.infer<typeof photoInputSchema>;

/** Detects the real image type from its first bytes (server-side content sniffing). */
export function sniffImageType(bytes: Uint8Array): (typeof LIMITS.photoTypes)[number] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  const ascii = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export const registerResidentSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email: z.email('Enter a valid email').max(254),
  password: z.string().min(LIMITS.passwordMin, `At least ${LIMITS.passwordMin} characters`).max(128),
  suburb: suburbSchema,
  phone: z
    .string()
    .trim()
    .regex(/^(\+27|0)\d{9}$/, 'Use a South African number, e.g. 0821234567')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+27|0)\d{9}$/, 'Use a South African number, e.g. 0821234567')
  .optional()
  .or(z.literal('').transform(() => undefined));

/** FR-29: first sign-in with Google; the role is always RESIDENT (BR-16). */
export const completeProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  suburb: suburbSchema,
  phone: phoneSchema,
});

/** FR-31: residents update their own details; staff may update name and phone only. */
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(80),
    suburb: suburbSchema.optional(),
    phone: phoneSchema,
    /** FR-25: residents opt in to emergency alerts by SMS (needs a mobile number). */
    smsAlerts: z.boolean().optional(),
  })
  .refine((p) => !p.smsAlerts || !!p.phone, { path: ['phone'], message: 'Add a mobile number to get SMS alerts' });

/** FR-39: a guest becomes a resident account (after linking an email/password or Google sign-in on the device). */
export const upgradeGuestSchema = completeProfileSchema;
/** FR-39: claim a guest's reports into an existing account with a one-time code. */
export const claimGuestReportsSchema = z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{32,64}$/, 'Invalid transfer code') });
export const emptySchema = z.object({});

/** FR-32: deletion requires typing DELETE to confirm. */
export const deleteAccountSchema = z.object({ confirm: z.literal('DELETE', { error: 'Type DELETE to confirm' }) });

export const submitReportSchema = z.object({
  categoryId: id,
  description: z
    .string()
    .trim()
    .min(LIMITS.descriptionMin, `At least ${LIMITS.descriptionMin} characters`)
    .max(LIMITS.descriptionMax, `At most ${LIMITS.descriptionMax} characters`),
  location: locationSchema,
  suburb: suburbSchema,
  landmark: z.string().trim().max(LIMITS.landmarkMax).optional(),
  severity: z.enum(SEVERITIES),
  photos: z.array(photoInputSchema).max(LIMITS.photosMax, `At most ${LIMITS.photosMax} photos`).default([]),
  /** FR-27: random id chosen by the device, so a report re-sent after a lost connection is stored once. */
  clientId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/, 'Invalid client id').optional(),
});

export const triageReportSchema = z.object({ reportId: id, departmentId: id.optional() });
export const rejectReportSchema = z.object({ reportId: id, reason });
export const escalateReportSchema = z.object({ reportId: id, reason });
export const assignReportSchema = z.object({ reportId: id, workerId: id, notes: z.string().trim().max(500).optional() });
/** FR-35: assign several triaged reports to one field worker at once. */
export const assignReportsSchema = z.object({
  reportIds: z.array(id).min(1, 'Select at least one report').max(LIMITS.bulkAssignMax, `At most ${LIMITS.bulkAssignMax} reports at a time`),
  workerId: id,
  notes: z.string().trim().max(500).optional(),
});
export const reassignTaskSchema = assignReportSchema;
export const updateTaskSchema = z.object({ taskId: id, action: z.enum(['accept', 'start']) });
export const completeTaskSchema = z.object({
  taskId: id,
  notes: z
    .string()
    .trim()
    .min(LIMITS.completionNotesMin, `Describe the work done (at least ${LIMITS.completionNotesMin} characters)`)
    .max(LIMITS.completionNotesMax),
  proofs: z
    .array(photoInputSchema)
    .min(1, 'Add at least one proof photo')
    .max(LIMITS.photosMax, `At most ${LIMITS.photosMax} photos`),
});
/** FR-14 + FR-37: confirming a fix, optionally rating the service (1–5) with a short comment. */
export const confirmResolutionSchema = z.object({
  reportId: id,
  rating: z.number().int('Whole stars only').min(1).max(5).optional(),
  feedback: z.string().trim().max(LIMITS.feedbackMax, `At most ${LIMITS.feedbackMax} characters`).optional(),
});
/** FR-24: a browser push subscription token for this device. */
export const pushTokenSchema = z.object({ token: z.string().trim().min(20, 'Invalid push token').max(4096) });

/** FR-33: a resident confirms an existing open issue ("Me too"). */
export const affirmReportSchema = z.object({ reportId: id });
export const reopenReportSchema = z.object({ reportId: id, reason });
export const addCommentSchema = z.object({ reportId: id, text: z.string().trim().min(1).max(LIMITS.commentMax) });

export const broadcastAlertSchema = z
  .object({
    type: z.enum(ALERT_TYPES),
    title: z.string().trim().min(3, 'Enter a title').max(LIMITS.alertTitleMax, `At most ${LIMITS.alertTitleMax} characters`),
    message: z
      .string()
      .trim()
      .min(10, 'Enter a message')
      .max(LIMITS.alertMessageMax, `At most ${LIMITS.alertMessageMax} characters`),
    targetSuburbs: z
      .array(z.union([suburbSchema, z.literal(ALL_SUBURBS)]))
      .min(1, 'Choose at least one suburb or All'),
    expiresAt: z.number().int(), // epoch millis
    /** FR-28: when to publish (epoch millis); omitted means now. */
    publishAt: z.number().int().optional(),
  })
  .transform((a) => ({
    ...a,
    targetSuburbs: a.targetSuburbs.includes(ALL_SUBURBS) ? [ALL_SUBURBS] : [...new Set(a.targetSuburbs)],
  }));

/** Expiry must be in the future and at most 30 days ahead (BR-13). Checked against the server clock. */
export function validateAlertExpiry(expiresAt: number, now: number): string | null {
  if (expiresAt <= now) return 'Expiry must be in the future';
  if (expiresAt > now + LIMITS.alertMaxDays * 24 * 3600_000) return `Expiry must be within ${LIMITS.alertMaxDays} days`;
  return null;
}

/** FR-28 / BR-24: a scheduled alert starts at least 10 minutes and at most 30 days ahead, and before it expires. */
export function validateAlertSchedule(publishAt: number, expiresAt: number, now: number): string | null {
  if (publishAt < now + LIMITS.alertScheduleMinMinutes * 60_000) return `Schedule at least ${LIMITS.alertScheduleMinMinutes} minutes ahead, or send now`;
  if (publishAt > now + LIMITS.alertMaxDays * 24 * 3600_000) return `Schedule within ${LIMITS.alertMaxDays} days`;
  if (publishAt >= expiresAt) return 'The alert must start before it expires';
  return null;
}

export const alertIdSchema = z.object({ alertId: id });
/** FR-25: administrator's test SMS to a South African mobile number. */
export const testSmsSchema = z.object({ to: z.string().trim().regex(/^(\+27|0)\d{9}$/, 'Use a South African number, e.g. 0821234567') });
export const scheduledAlertIdSchema = z.object({ scheduledId: id });

export const createStaffUserSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.email().max(254),
    password: z.string().min(LIMITS.passwordMin).max(128),
    role: z.enum(['OFFICIAL', 'FIELD_WORKER', 'ADMIN']),
    departmentId: id.optional(),
  })
  .refine((u) => u.role === 'ADMIN' || !!u.departmentId, {
    message: 'Officials and field workers need a department',
    path: ['departmentId'],
  });
export const setUserRoleSchema = z
  .object({ uid: id, role: z.enum(ROLES), departmentId: id.optional() })
  .refine((u) => u.role === 'ADMIN' || u.role === 'RESIDENT' || !!u.departmentId, {
    message: 'Officials and field workers need a department',
    path: ['departmentId'],
  });
export const setUserActiveSchema = z.object({ uid: id, active: z.boolean() });

export const upsertDepartmentSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2).max(60),
  slaHours: z
    .number()
    .int('Whole hours only')
    .min(LIMITS.slaHoursMin, `At least ${LIMITS.slaHoursMin} hour`)
    .max(LIMITS.slaHoursMax, `At most ${LIMITS.slaHoursMax} hours`),
  isActive: z.boolean(),
});
export const upsertCategorySchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2).max(40),
  icon: z.string().trim().min(1).max(40),
  departmentId: id,
  isActive: z.boolean(),
});

/** FR-21: system settings (BR-21 rate limit). */
export const updateSettingsSchema = z.object({
  reportsPerHour: z.number().int('Whole numbers only').min(1, 'At least 1').max(LIMITS.reportsPerHourMax, `At most ${LIMITS.reportsPerHourMax}`),
});

export const analyticsQuerySchema = z.object({ days: z.number().int().min(7).max(90).default(30) });

export type RegisterResidentInput = z.input<typeof registerResidentSchema>;
export type SubmitReportInput = z.input<typeof submitReportSchema>;
export type AssignReportInput = z.infer<typeof assignReportSchema>;
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
export type BroadcastAlertInput = z.input<typeof broadcastAlertSchema>;
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;
export type UpsertDepartmentInput = z.infer<typeof upsertDepartmentSchema>;
export type UpsertCategoryInput = z.infer<typeof upsertCategorySchema>;

/** Flattens zod issues into { field: message } for field-level UI errors (NFR-03). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * NFR-14: the web app's Content Security Policy forbids `eval`. zod would otherwise probe it with
 * `new Function` (caught, but reported as a CSP violation); jitless validation skips the probe.
 */
export function configureJitlessValidation() {
  z.config({ jitless: true });
}
