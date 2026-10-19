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

/** Client-side photo check (BR-02); the server re-checks via Storage rules and metadata. */
export const photoFileSchema = z.object({
  type: z.enum(LIMITS.photoTypes, { error: 'Photos must be JPEG, PNG or WebP' }),
  size: z.number().max(LIMITS.photoBytesMax, 'Each photo must be 5 MB or smaller'),
});

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
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  suburb: suburbSchema.optional(),
  phone: phoneSchema,
});

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
  photoPaths: z.array(z.string().min(1)).max(LIMITS.photosMax, `At most ${LIMITS.photosMax} photos`).default([]),
});

export const triageReportSchema = z.object({ reportId: id, departmentId: id.optional() });
export const rejectReportSchema = z.object({ reportId: id, reason });
export const escalateReportSchema = z.object({ reportId: id, reason });
export const assignReportSchema = z.object({ reportId: id, workerId: id, notes: z.string().trim().max(500).optional() });
export const reassignTaskSchema = assignReportSchema;
export const updateTaskSchema = z.object({ taskId: id, action: z.enum(['accept', 'start']) });
export const completeTaskSchema = z.object({
  taskId: id,
  notes: z
    .string()
    .trim()
    .min(LIMITS.completionNotesMin, `Describe the work done (at least ${LIMITS.completionNotesMin} characters)`)
    .max(LIMITS.completionNotesMax),
  proofPaths: z
    .array(z.string().min(1))
    .min(1, 'Add at least one proof photo')
    .max(LIMITS.photosMax, `At most ${LIMITS.photosMax} photos`),
});
export const confirmResolutionSchema = z.object({ reportId: id });
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

export const alertIdSchema = z.object({ alertId: id });

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
