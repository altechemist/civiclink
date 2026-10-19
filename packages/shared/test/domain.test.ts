import { describe, expect, it } from 'vitest';
import {
  approximateLocation,
  computeAnalytics,
  distanceMetres,
  DuplicatePolicy,
  formatReference,
  REPORT_STATUSES,
  REPORT_TRANSITIONS,
  ReportStateMachine,
  ResolutionPolicy,
  SlaPolicy,
  TaskStateMachine,
  toCsv,
  type DuplicateCandidate,
  type ReportEvent,
  type ReportStatus,
} from '../src';

const HOUR = 3600_000;
/** Moves a point north by `m` metres. */
const north = (p: { lat: number; lng: number }, m: number) => ({ lat: p.lat + m / 111_195, lng: p.lng });

describe('ReportStateMachine', () => {
  it('UT-RSM-01 every allowed transition succeeds for its allowed actors', () => {
    for (const [event, t] of Object.entries(REPORT_TRANSITIONS) as [ReportEvent, (typeof REPORT_TRANSITIONS)[ReportEvent]][]) {
      for (const from of t.from) for (const actor of t.actors) expect(ReportStateMachine.next(from, event, actor)).toBe(t.to);
    }
  });

  it('UT-RSM-02 every other (status, event) pair is rejected', () => {
    let rejected = 0;
    for (const from of [null, ...REPORT_STATUSES] as (ReportStatus | null)[]) {
      for (const event of Object.keys(REPORT_TRANSITIONS) as ReportEvent[]) {
        if (REPORT_TRANSITIONS[event].from.includes(from)) continue;
        expect(() => ReportStateMachine.next(from, event, 'ADMIN')).toThrowError(/Cannot/);
        rejected++;
      }
    }
    expect(rejected).toBeGreaterThan(60);
  });

  it('UT-RSM-03 terminal statuses allow no events and actors are enforced', () => {
    for (const s of ['CLOSED', 'REJECTED', 'DUPLICATE'] as const) {
      for (const a of ['RESIDENT', 'OFFICIAL', 'FIELD_WORKER', 'ADMIN', 'SYSTEM'] as const) {
        expect(ReportStateMachine.eventsFrom(s, a)).toEqual([]);
      }
    }
    expect(() => ReportStateMachine.next('SUBMITTED', 'triage', 'RESIDENT')).toThrowError(/may not/);
    expect(() => ReportStateMachine.next('RESOLVED', 'reopen', 'OFFICIAL')).toThrowError(/may not/);
    expect(ReportStateMachine.eventsFrom('UNDER_REVIEW', 'OFFICIAL').sort()).toEqual(['assign', 'escalate', 'reject']);
  });
});

describe('TaskStateMachine', () => {
  it('UT-TSM-01 tasks move in order; skipping steps is rejected (BR-08)', () => {
    expect(TaskStateMachine.next('ASSIGNED', 'accept')).toBe('ACCEPTED');
    expect(TaskStateMachine.next('ACCEPTED', 'start')).toBe('IN_PROGRESS');
    expect(TaskStateMachine.next('IN_PROGRESS', 'complete')).toBe('COMPLETED');
    expect(() => TaskStateMachine.next('ASSIGNED', 'start')).toThrow();
    expect(() => TaskStateMachine.next('ASSIGNED', 'complete')).toThrow();
    expect(() => TaskStateMachine.next('COMPLETED', 'reassign')).toThrow();
    expect(TaskStateMachine.next('ACCEPTED', 'reassign')).toBe('REASSIGNED');
  });
});

describe('DuplicatePolicy (BR-03)', () => {
  const now = Date.UTC(2026, 9, 20, 12);
  const origin = { lat: -28.74, lng: 24.76 };
  const cand = (over: Partial<DuplicateCandidate> = {}): DuplicateCandidate => ({
    id: 'r1',
    categoryId: 'burst-pipe',
    status: 'SUBMITTED',
    location: origin,
    createdAt: now - HOUR,
    ...over,
  });
  const newR = (m: number, categoryId = 'burst-pipe') => ({ categoryId, location: north(origin, m) });

  it('UT-DUP-01 distance boundary 99 m / 100 m / 101 m', () => {
    expect(DuplicatePolicy.isMatch(newR(99), cand(), now)).toBe(true);
    expect(DuplicatePolicy.isMatch(newR(99.99), cand(), now)).toBe(true);
    expect(DuplicatePolicy.isMatch(newR(101), cand(), now)).toBe(false);
  });
  it('UT-DUP-02 time window 71 h / 73 h', () => {
    expect(DuplicatePolicy.isMatch(newR(10), cand({ createdAt: now - 71 * HOUR }), now)).toBe(true);
    expect(DuplicatePolicy.isMatch(newR(10), cand({ createdAt: now - 72 * HOUR }), now)).toBe(true);
    expect(DuplicatePolicy.isMatch(newR(10), cand({ createdAt: now - 73 * HOUR }), now)).toBe(false);
  });
  it('UT-DUP-03 different category is not a duplicate', () => {
    expect(DuplicatePolicy.isMatch(newR(10, 'electricity'), cand(), now)).toBe(false);
  });
  it('UT-DUP-04 parent must be open', () => {
    for (const status of ['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] as const) {
      expect(DuplicatePolicy.isMatch(newR(10), cand({ status }), now)).toBe(false);
    }
    expect(DuplicatePolicy.isMatch(newR(10), cand({ status: 'ESCALATED' }), now)).toBe(true);
  });
  it('UT-DUP-05 picks the closest candidate, oldest on a tie', () => {
    const far = cand({ id: 'far', location: north(origin, 60) });
    const nearNew = cand({ id: 'nearNew', createdAt: now - HOUR });
    const nearOld = cand({ id: 'nearOld', createdAt: now - 2 * HOUR });
    expect(DuplicatePolicy.findParent(newR(0), [far, nearNew, nearOld], now)?.id).toBe('nearOld');
    expect(DuplicatePolicy.findParent(newR(0), [], now)).toBeNull();
  });
  it('UT-DUP-06 haversine distance sanity check (Kimberley CBD → Galeshewe ≈ 3.4 km)', () => {
    const d = distanceMetres({ lat: -28.7382, lng: 24.7638 }, { lat: -28.7189, lng: 24.7334 });
    expect(d).toBeGreaterThan(3300);
    expect(d).toBeLessThan(3800);
  });
});

describe('SlaPolicy (BR-10)', () => {
  const created = Date.UTC(2026, 9, 20);
  it('UT-SLA-01 breach only after slaHours', () => {
    const r = { status: 'UNDER_REVIEW' as const, createdAt: created };
    expect(SlaPolicy.isBreached(r, 48, created + 48 * HOUR - 60_000)).toBe(false);
    expect(SlaPolicy.isBreached(r, 48, created + 48 * HOUR + 60_000)).toBe(true);
  });
  it('UT-SLA-02 never re-escalates and ignores closed work', () => {
    const late = created + 100 * HOUR;
    expect(SlaPolicy.isBreached({ status: 'IN_PROGRESS', createdAt: created, escalatedAt: late - 1 }, 48, late)).toBe(false);
    expect(SlaPolicy.isBreached({ status: 'ESCALATED', createdAt: created }, 48, late)).toBe(false);
    expect(SlaPolicy.isBreached({ status: 'RESOLVED', createdAt: created }, 48, late)).toBe(false);
  });
});

describe('ResolutionPolicy (BR-11)', () => {
  const resolved = Date.UTC(2026, 9, 20);
  it('UT-RES-01 7-day window and auto-close', () => {
    expect(ResolutionPolicy.withinWindow(resolved, resolved + 7 * 24 * HOUR)).toBe(true);
    expect(ResolutionPolicy.withinWindow(resolved, resolved + 7 * 24 * HOUR + 1)).toBe(false);
    expect(ResolutionPolicy.shouldAutoClose({ status: 'RESOLVED', resolvedAt: resolved }, resolved + 8 * 24 * HOUR)).toBe(true);
    expect(ResolutionPolicy.shouldAutoClose({ status: 'CLOSED', resolvedAt: resolved }, resolved + 8 * 24 * HOUR)).toBe(false);
  });
});

describe('references and privacy', () => {
  it('UT-REF-01 reference format and padding (BR-04)', () => {
    expect(formatReference(2026, 1)).toBe('CL-2026-0001');
    expect(formatReference(2026, 9999)).toBe('CL-2026-9999');
    expect(formatReference(2026, 10000)).toBe('CL-2026-10000');
    expect(() => formatReference(2026, 0)).toThrow();
  });
  it('UT-PRV-01 public location is rounded to ~110 m (BR-17)', () => {
    expect(approximateLocation({ lat: -28.738249, lng: 24.763861 })).toEqual({ lat: -28.738, lng: 24.764 });
  });
});

describe('analytics (FR-19)', () => {
  const now = Date.UTC(2026, 9, 20, 12);
  const depts = [
    { id: 'water', name: 'Water & Sanitation', slaHours: 48 },
    { id: 'roads', name: 'Roads', slaHours: 72 },
  ];
  it('UT-ANL-01 metrics on a fixture', () => {
    const reports = [
      { status: 'CLOSED' as const, categoryId: 'burst-pipe', departmentId: 'water', createdAt: now - 50 * HOUR, resolvedAt: now - 26 * HOUR }, // 24 h, in SLA
      { status: 'RESOLVED' as const, categoryId: 'burst-pipe', departmentId: 'water', createdAt: now - 80 * HOUR, resolvedAt: now - 20 * HOUR }, // 60 h, breach
      { status: 'IN_PROGRESS' as const, categoryId: 'pothole', departmentId: 'roads', createdAt: now - 5 * HOUR },
      { status: 'DUPLICATE' as const, categoryId: 'burst-pipe', departmentId: 'water', createdAt: now - 4 * HOUR },
    ];
    const a = computeAnalytics(reports, depts, now, 30);
    expect(a.total).toBe(3);
    expect(a.open).toBe(1);
    expect(a.resolvedInPeriod).toBe(2);
    expect(a.avgResolutionHours).toBe(42);
    expect(a.slaCompliancePct).toBe(50);
    expect(a.byStatus.DUPLICATE).toBe(1);
    expect(a.byCategory).toEqual({ 'burst-pipe': 2, pothole: 1 });
    expect(a.departments.find((d) => d.departmentId === 'roads')).toMatchObject({ open: 1, avgResolutionHours: null });
    expect(a.trend).toHaveLength(30);
    expect(a.trend.reduce((s, d) => s + d.submitted, 0)).toBe(3);
  });
  it('UT-ANL-02 empty input yields nulls, not NaN', () => {
    const a = computeAnalytics([], depts, now);
    expect(a.avgResolutionHours).toBeNull();
    expect(a.slaCompliancePct).toBeNull();
    expect(a.total).toBe(0);
  });
  it('UT-CSV-01 CSV quoting', () => {
    expect(toCsv([{ a: 'x,y', b: 'say "hi"', c: null }], ['a', 'b', 'c'])).toBe('a,b,c\r\n"x,y","say ""hi""",');
  });
});

describe('location helpers (FR-03)', () => {
  it('UT-LOC-01 municipal bounds and nearest suburb', async () => {
    const { insideMunicipality, nearestSuburb, distanceFromKimberley } = await import('../src');
    expect(insideMunicipality({ lat: -28.7382, lng: 24.7638 })).toBe(true);
    expect(insideMunicipality({ lat: -26.2041, lng: 28.0473 })).toBe(false); // Johannesburg
    expect(nearestSuburb({ lat: -28.7185, lng: 24.7335 })).toBe('Galeshewe');
    expect(nearestSuburb({ lat: -29.034, lng: 24.601 })).toBe('Ritchie');
    expect(nearestSuburb({ lat: -26.2041, lng: 28.0473 })).toBeNull();
    expect(Math.round(distanceFromKimberley({ lat: -26.2041, lng: 28.0473 }) / 1000)).toBeGreaterThan(400);
  });
});
