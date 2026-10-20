import {
  KIMBERLEY_CENTRE,
  LIMITS,
  MUNICIPAL_BOUNDS,
  SUBURB_CENTRES,
  type Suburb,
  OPEN_REPORT_STATUSES,
  PUBLIC_LOCATION_DECIMALS,
  type ReportStatus,
} from './constants';

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Great-circle distance in metres (haversine). */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface DuplicateCandidate {
  id: string;
  categoryId: string;
  status: ReportStatus;
  location: LatLng;
  createdAt: number; // epoch millis
}

/**
 * BR-03: a new report duplicates an open report of the same category within 100 m created in the last 72 hours.
 * Returns the closest matching candidate (oldest on a tie) or null.
 */
export const DuplicatePolicy = {
  radiusM: LIMITS.duplicateRadiusM,
  windowMs: LIMITS.duplicateWindowHours * HOUR,

  isMatch(newReport: { categoryId: string; location: LatLng }, c: DuplicateCandidate, now: number): boolean {
    return (
      c.categoryId === newReport.categoryId &&
      OPEN_REPORT_STATUSES.includes(c.status) &&
      now - c.createdAt <= DuplicatePolicy.windowMs &&
      distanceMetres(newReport.location, c.location) <= DuplicatePolicy.radiusM
    );
  },

  findParent<T extends DuplicateCandidate>(
    newReport: { categoryId: string; location: LatLng },
    candidates: T[],
    now: number,
  ): T | null {
    const matches = candidates
      .filter((c) => DuplicatePolicy.isMatch(newReport, c, now))
      .map((c) => ({ c, d: distanceMetres(newReport.location, c.location) }))
      .sort((x, y) => x.d - y.d || x.c.createdAt - y.c.createdAt);
    return matches[0]?.c ?? null;
  },
};

/** BR-10: an open, not-yet-escalated report past its department SLA is escalated once. */
export const SlaPolicy = {
  isBreached(r: { status: ReportStatus; createdAt: number; escalatedAt?: number | null }, slaHours: number, now: number) {
    const escalatable: ReportStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS'];
    return escalatable.includes(r.status) && !r.escalatedAt && now - r.createdAt > slaHours * HOUR;
  },
  dueAt(createdAt: number, slaHours: number) {
    return createdAt + slaHours * HOUR;
  },
};

/** BR-11: residents may confirm or reopen within 7 days of resolution; afterwards the report auto-closes. */
export const ResolutionPolicy = {
  windowMs: LIMITS.reopenWindowDays * DAY,
  withinWindow(resolvedAt: number, now: number) {
    return now - resolvedAt <= ResolutionPolicy.windowMs;
  },
  shouldAutoClose(r: { status: ReportStatus; resolvedAt?: number | null }, now: number) {
    return r.status === 'RESOLVED' && !!r.resolvedAt && !ResolutionPolicy.withinWindow(r.resolvedAt, now);
  },
};

/** BR-04: CL-<year>-<sequence>, zero-padded to at least four digits. */
export function formatReference(year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) throw new RangeError('sequence must be a positive integer');
  return `CL-${year}-${String(sequence).padStart(4, '0')}`;
}

/** BR-17: approximate location for the public map. */
export function approximateLocation({ lat, lng }: LatLng): LatLng {
  const f = 10 ** PUBLIC_LOCATION_DECIMALS;
  return { lat: Math.round(lat * f) / f, lng: Math.round(lng * f) / f };
}

export function insideMunicipality({ lat, lng }: LatLng): boolean {
  return lat >= MUNICIPAL_BOUNDS.minLat && lat <= MUNICIPAL_BOUNDS.maxLat && lng >= MUNICIPAL_BOUNDS.minLng && lng <= MUNICIPAL_BOUNDS.maxLng;
}

/** Nearest suburb centre within `maxMetres` (default 6 km), used to pre-fill the suburb from a map pin. */
export function nearestSuburb(p: LatLng, maxMetres = 6000): Suburb | null {
  let best: { s: Suburb; d: number } | null = null;
  for (const [s, c] of Object.entries(SUBURB_CENTRES) as [Suburb, LatLng][]) {
    const d = distanceMetres(p, c);
    if (!best || d < best.d) best = { s, d };
  }
  return best && best.d <= maxMetres ? best.s : null;
}

export const distanceFromKimberley = (p: LatLng) => distanceMetres(p, KIMBERLEY_CENTRE);

/** FR-25: South African mobile numbers (0821234567 or +27821234567) in the E.164 form SMS gateways expect. */
export function toE164ZA(phone: string): string {
  const digits = phone.replace(/\s+/g, '');
  return digits.startsWith('0') ? `+27${digits.slice(1)}` : digits;
}

/** FR-25: one SMS segment (160 characters): "CivicLink EMERGENCY: <title>. <message>", shortened with an ellipsis. */
export function smsAlertText(type: string, title: string, message: string, max = 160): string {
  const text = `CivicLink ${type}: ${title.replace(/[.\s]+$/, '')}. ${message}`.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
