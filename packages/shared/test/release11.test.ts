import { describe, expect, it } from 'vitest';
import {
  assignReportsSchema,
  broadcastAlertSchema,
  confirmResolutionSchema,
  openBySuburb,
  smsAlertText,
  submitReportSchema,
  summariseRatings,
  toE164ZA,
  updateProfileSchema,
  validateAlertSchedule,
} from '../src';

const HOUR = 3600_000;
const NOW = Date.UTC(2026, 9, 20, 8, 0);

describe('scheduled alerts (FR-28, BR-24)', () => {
  it('UT-ALS-01 publish time must be 10 min to 30 days ahead and before expiry', () => {
    expect(validateAlertSchedule(NOW + 2 * HOUR, NOW + 24 * HOUR, NOW)).toBeNull();
    expect(validateAlertSchedule(NOW + 5 * 60_000, NOW + 24 * HOUR, NOW)).toMatch(/at least 10 minutes/);
    expect(validateAlertSchedule(NOW + 31 * 24 * HOUR, NOW + 32 * 24 * HOUR, NOW)).toMatch(/within 30 days/);
    expect(validateAlertSchedule(NOW + 5 * HOUR, NOW + 5 * HOUR, NOW)).toMatch(/before it expires/);
  });
  it('UT-ALS-02 publishAt is optional in the broadcast schema', () => {
    const base = { type: 'WATER', title: 'Water off', message: 'Water off for repairs today.', targetSuburbs: ['Galeshewe'], expiresAt: NOW + HOUR };
    expect(broadcastAlertSchema.safeParse(base).success).toBe(true);
    expect(broadcastAlertSchema.parse({ ...base, publishAt: NOW + 30 * 60_000 }).publishAt).toBe(NOW + 30 * 60_000);
  });
});

describe('offline submission (FR-27)', () => {
  it('UT-OFF-01 clientId is optional and limited to a safe id format', () => {
    const report = { categoryId: 'burst-pipe', description: 'Burst pipe outside the clinic', location: { lat: -28.74, lng: 24.76 }, suburb: 'Galeshewe', severity: 'HIGH' };
    expect(submitReportSchema.safeParse(report).success).toBe(true);
    expect(submitReportSchema.safeParse({ ...report, clientId: '7f9c2ba4-e88f-11ee-9a5e-0242ac120002' }).success).toBe(true);
    expect(submitReportSchema.safeParse({ ...report, clientId: 'short' }).success).toBe(false);
    expect(submitReportSchema.safeParse({ ...report, clientId: '../../reports/x' }).success).toBe(false);
  });
});

describe('bulk assignment (FR-35)', () => {
  it('UT-BLK-01 one to 20 reports per batch', () => {
    expect(assignReportsSchema.safeParse({ reportIds: ['a'], workerId: 'w' }).success).toBe(true);
    expect(assignReportsSchema.safeParse({ reportIds: [], workerId: 'w' }).success).toBe(false);
    expect(assignReportsSchema.safeParse({ reportIds: Array.from({ length: 21 }, (_, i) => `r${i}`), workerId: 'w' }).success).toBe(false);
  });
});

describe('ratings and public figures (FR-36, FR-37)', () => {
  it('UT-RAT-01 ratings are whole stars from 1 to 5, with optional short feedback', () => {
    expect(confirmResolutionSchema.safeParse({ reportId: 'r1' }).success).toBe(true);
    expect(confirmResolutionSchema.safeParse({ reportId: 'r1', rating: 5, feedback: 'Great' }).success).toBe(true);
    for (const rating of [0, 6, 3.5]) expect(confirmResolutionSchema.safeParse({ reportId: 'r1', rating }).success).toBe(false);
    expect(confirmResolutionSchema.safeParse({ reportId: 'r1', rating: 4, feedback: 'x'.repeat(301) }).success).toBe(false);
  });
  it('UT-RAT-02 average to one decimal; no ratings gives null; invalid values ignored', () => {
    expect(summariseRatings([])).toEqual({ average: null, ratings: 0 });
    expect(summariseRatings([5, 4, null, undefined, 4])).toEqual({ average: 4.3, ratings: 3 });
    expect(summariseRatings([9, 0, 2.5, 3])).toEqual({ average: 3, ratings: 1 });
  });
  it('UT-PUB-01 open reports per suburb exclude closed, rejected and duplicate reports', () => {
    expect(
      openBySuburb([
        { status: 'SUBMITTED', suburb: 'Galeshewe' },
        { status: 'IN_PROGRESS', suburb: 'Galeshewe' },
        { status: 'ESCALATED', suburb: 'Roodepan' },
        { status: 'DUPLICATE', suburb: 'Roodepan' },
        { status: 'CLOSED', suburb: 'Homestead' },
        { status: 'REJECTED', suburb: 'Homestead' },
      ]),
    ).toEqual({ Galeshewe: 2, Roodepan: 1 });
  });
});

describe('SMS alerts (FR-25, BR-25)', () => {
  it('UT-SMS-01 South African numbers convert to E.164', () => {
    expect(toE164ZA('0821234567')).toBe('+27821234567');
    expect(toE164ZA('+27821234567')).toBe('+27821234567');
    expect(toE164ZA('082 123 4567')).toBe('+27821234567');
  });
  it('UT-SMS-02 SMS text fits one 160-character segment', () => {
    expect(smsAlertText('EMERGENCY', 'Gas leak.', 'Avoid the stadium.')).toBe('CivicLink EMERGENCY: Gas leak. Avoid the stadium.');
    const long = smsAlertText('EMERGENCY', 'Water outage', 'x '.repeat(200));
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.length).toBeGreaterThan(150);
    expect(long.endsWith('…')).toBe(true);
  });
  it('UT-SMS-03 opting in to SMS requires a mobile number', () => {
    expect(updateProfileSchema.safeParse({ name: 'Thandi', smsAlerts: true }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ name: 'Thandi', phone: '0821234567', smsAlerts: true }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ name: 'Thandi', smsAlerts: false }).success).toBe(true);
  });
});
