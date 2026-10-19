import { describe, expect, it } from 'vitest';
import {
  broadcastAlertSchema,
  completeTaskSchema,
  createStaffUserSchema,
  fieldErrors,
  photoFileSchema,
  photoInputSchema,
  sniffImageType,
  registerResidentSchema,
  submitReportSchema,
  upsertDepartmentSchema,
  validateAlertExpiry,
} from '../src';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const png = { contentType: 'image/png', data: PNG_B64 };

const validReport = {
  categoryId: 'burst-pipe',
  description: 'Water gushing from a burst pipe on the corner.',
  location: { lat: -28.74, lng: 24.76 },
  suburb: 'Galeshewe',
  severity: 'HIGH',
  photos: [],
};

describe('submitReportSchema', () => {
  it('UT-SCH-01 description boundaries 9/10/300/301', () => {
    const at = (n: number) => submitReportSchema.safeParse({ ...validReport, description: 'x'.repeat(n) }).success;
    expect(at(9)).toBe(false);
    expect(at(10)).toBe(true);
    expect(at(300)).toBe(true);
    expect(at(301)).toBe(false);
  });

  it('UT-SCH-02 photo count 0/3/4 and file size and type', () => {
    const photos = (n: number) =>
      submitReportSchema.safeParse({ ...validReport, photos: Array.from({ length: n }, () => png) }).success;
    expect(photos(0)).toBe(true);
    expect(photos(3)).toBe(true);
    expect(photos(4)).toBe(false);
    expect(photoFileSchema.safeParse({ type: 'image/jpeg', size: 15 * 1024 * 1024 }).success).toBe(true);
    expect(photoFileSchema.safeParse({ type: 'image/jpeg', size: 15 * 1024 * 1024 + 1 }).success).toBe(false);
    // Stored photo limit (700 KB decoded) and base64 shape.
    expect(photoInputSchema.safeParse({ contentType: 'image/png', data: 'A'.repeat(Math.ceil((700 * 1024 * 4) / 3)) }).success).toBe(true);
    expect(photoInputSchema.safeParse({ contentType: 'image/png', data: 'A'.repeat(Math.ceil((700 * 1024 * 4) / 3) + 8) }).success).toBe(false);
    expect(photoInputSchema.safeParse({ contentType: 'image/png', data: 'not base64!' }).success).toBe(false);
    expect(photoInputSchema.safeParse({ contentType: 'image/gif', data: PNG_B64 }).success).toBe(false);
    expect(photoFileSchema.safeParse({ type: 'image/gif', size: 100 }).success).toBe(false);
    expect(photoFileSchema.safeParse({ type: 'image/webp', size: 100 }).success).toBe(true);
  });

  it('UT-SCH-03 location inside / outside municipal bounding box', () => {
    const loc = (lat: number, lng: number) => submitReportSchema.safeParse({ ...validReport, location: { lat, lng } });
    expect(loc(-28.55, 25.05).success).toBe(true);
    expect(loc(-28.549, 24.76).success).toBe(false);
    const res = loc(-26.2, 28.04); // Johannesburg
    expect(res.success).toBe(false);
    if (!res.success) expect(fieldErrors(res.error)['location']).toMatch(/Sol Plaatje/);
  });

  it('UT-SCH-04 rejects unknown suburb and severity with field errors', () => {
    const res = submitReportSchema.safeParse({ ...validReport, suburb: 'Sandton', severity: 'CRITICAL' });
    expect(res.success).toBe(false);
    if (!res.success) expect(Object.keys(fieldErrors(res.error)).sort()).toEqual(['severity', 'suburb']);
  });
});

describe('registerResidentSchema', () => {
  const base = { name: 'Thabo M', email: 'thabo@example.com', password: 'longenough', suburb: 'Roodepan' };
  it('UT-SCH-05 password minimum, optional SA phone, no role field accepted', () => {
    expect(registerResidentSchema.safeParse(base).success).toBe(true);
    expect(registerResidentSchema.safeParse({ ...base, password: 'short12' }).success).toBe(false);
    expect(registerResidentSchema.safeParse({ ...base, phone: '0821234567' }).success).toBe(true);
    expect(registerResidentSchema.safeParse({ ...base, phone: '' }).success).toBe(true);
    expect(registerResidentSchema.safeParse({ ...base, phone: '12345' }).success).toBe(false);
    const parsed = registerResidentSchema.parse({ ...base, role: 'ADMIN' });
    expect(parsed).not.toHaveProperty('role');
  });
});

describe('completeTaskSchema', () => {
  it('UT-SCH-06 completion requires notes ≥10 and 1–3 proof photos (BR-09)', () => {
    const ok = { taskId: 't1', notes: 'Pipe joint replaced', proofs: [png] };
    expect(completeTaskSchema.safeParse(ok).success).toBe(true);
    expect(completeTaskSchema.safeParse({ ...ok, notes: 'too short' }).success).toBe(false);
    expect(completeTaskSchema.safeParse({ ...ok, proofs: [] }).success).toBe(false);
    expect(completeTaskSchema.safeParse({ ...ok, proofs: [png, png, png, png] }).success).toBe(false);
  });
});

describe('broadcastAlertSchema', () => {
  const base = {
    type: 'EMERGENCY',
    title: 'Strike: road closures',
    message: 'Avoid the CBD; use the R31 Belgrave Road.',
    targetSuburbs: ['Galeshewe'],
    expiresAt: Date.now() + 3600_000,
  };
  it('UT-SCH-ALR-01 title/message boundaries and target suburbs (BR-13)', () => {
    expect(broadcastAlertSchema.safeParse({ ...base, title: 'x'.repeat(100) }).success).toBe(true);
    expect(broadcastAlertSchema.safeParse({ ...base, title: 'x'.repeat(101) }).success).toBe(false);
    expect(broadcastAlertSchema.safeParse({ ...base, message: 'x'.repeat(500) }).success).toBe(true);
    expect(broadcastAlertSchema.safeParse({ ...base, message: 'x'.repeat(501) }).success).toBe(false);
    expect(broadcastAlertSchema.safeParse({ ...base, targetSuburbs: [] }).success).toBe(false);
    expect(broadcastAlertSchema.parse({ ...base, targetSuburbs: ['Galeshewe', 'ALL'] }).targetSuburbs).toEqual(['ALL']);
    expect(broadcastAlertSchema.parse({ ...base, targetSuburbs: ['Galeshewe', 'Galeshewe'] }).targetSuburbs).toEqual([
      'Galeshewe',
    ]);
  });
  it('UT-SCH-ALR-02 expiry must be future and within 30 days', () => {
    const now = Date.UTC(2026, 9, 20);
    expect(validateAlertExpiry(now, now)).toMatch(/future/);
    expect(validateAlertExpiry(now + 1, now)).toBeNull();
    expect(validateAlertExpiry(now + 30 * 86400_000, now)).toBeNull();
    expect(validateAlertExpiry(now + 30 * 86400_000 + 1, now)).toMatch(/30 days/);
  });
});

describe('admin schemas', () => {
  it('UT-SCH-07 staff users need a department unless admin', () => {
    const base = { name: 'Lerato K', email: 'l@example.com', password: 'password1' };
    expect(createStaffUserSchema.safeParse({ ...base, role: 'OFFICIAL' }).success).toBe(false);
    expect(createStaffUserSchema.safeParse({ ...base, role: 'OFFICIAL', departmentId: 'water' }).success).toBe(true);
    expect(createStaffUserSchema.safeParse({ ...base, role: 'ADMIN' }).success).toBe(true);
    expect(createStaffUserSchema.safeParse({ ...base, role: 'RESIDENT' }).success).toBe(false);
  });
  it('UT-SCH-08 department SLA hours 1–720 whole numbers', () => {
    const d = (slaHours: number) => upsertDepartmentSchema.safeParse({ name: 'Water', slaHours, isActive: true }).success;
    expect(d(0)).toBe(false);
    expect(d(1)).toBe(true);
    expect(d(720)).toBe(true);
    expect(d(721)).toBe(false);
    expect(d(2.5)).toBe(false);
  });
});

describe('image sniffing (BR-02)', () => {
  it('UT-SCH-09 real type is detected from magic bytes', () => {
    expect(sniffImageType(Uint8Array.from(Buffer.from(PNG_B64, 'base64')))).toBe('image/png');
    expect(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(sniffImageType(Uint8Array.from(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')))).toBe('image/webp');
    expect(sniffImageType(Uint8Array.from(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull();
    expect(sniffImageType(Uint8Array.from(Buffer.from('%PDF-1.7')))).toBeNull();
  });
});
