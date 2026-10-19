export const ROLES = ['RESIDENT', 'OFFICIAL', 'FIELD_WORKER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES: readonly Role[] = ['OFFICIAL', 'FIELD_WORKER', 'ADMIN'];

export const REPORT_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'IN_PROGRESS',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'DUPLICATE',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const OPEN_REPORT_STATUSES: readonly ReportStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'ESCALATED'];
export const TERMINAL_REPORT_STATUSES: readonly ReportStatus[] = ['CLOSED', 'REJECTED', 'DUPLICATE'];

export const TASK_STATUSES = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REASSIGNED', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'];

export const SEVERITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ALERT_TYPES = ['EMERGENCY', 'ELECTRICITY', 'WATER', 'ROADS', 'GENERAL'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
export const ALL_SUBURBS = 'ALL';

/** Suburbs/areas of Sol Plaatje Local Municipality used for reporting and alert targeting. */
export const SUBURBS = [
  'Beaconsfield',
  'Belgravia',
  'Cassandra',
  'De Beers',
  'Galeshewe',
  'Greenpoint',
  'Hadison Park',
  'Herlear',
  'Homestead',
  'Kenilworth',
  'Kimberley CBD',
  'Monument Heights',
  'Newton',
  'Platfontein',
  'Ritchie',
  'Riviera',
  'Roodepan',
  'Royldene',
  'Southridge',
  'West End',
] as const;
export type Suburb = (typeof SUBURBS)[number];

/** Approximate suburb centres, used to centre the map on a chosen suburb and suggest a suburb from a pin. */
export const SUBURB_CENTRES: Record<Suburb, { lat: number; lng: number }> = {
  Beaconsfield: { lat: -28.757, lng: 24.774 },
  Belgravia: { lat: -28.747, lng: 24.778 },
  Cassandra: { lat: -28.742, lng: 24.803 },
  'De Beers': { lat: -28.733, lng: 24.792 },
  Galeshewe: { lat: -28.718, lng: 24.733 },
  Greenpoint: { lat: -28.726, lng: 24.752 },
  'Hadison Park': { lat: -28.765, lng: 24.79 },
  Herlear: { lat: -28.757, lng: 24.759 },
  Homestead: { lat: -28.746, lng: 24.709 },
  Kenilworth: { lat: -28.718, lng: 24.79 },
  'Kimberley CBD': { lat: -28.7382, lng: 24.7638 },
  'Monument Heights': { lat: -28.766, lng: 24.748 },
  Newton: { lat: -28.741, lng: 24.752 },
  Platfontein: { lat: -28.66, lng: 24.74 },
  Ritchie: { lat: -29.035, lng: 24.6 },
  Riviera: { lat: -28.75, lng: 24.766 },
  Roodepan: { lat: -28.698, lng: 24.723 },
  Royldene: { lat: -28.772, lng: 24.76 },
  Southridge: { lat: -28.77, lng: 24.736 },
  'West End': { lat: -28.735, lng: 24.748 },
};

/** Bounding box enclosing Sol Plaatje Local Municipality (Kimberley, Ritchie, Platfontein). BR-02. */
export const MUNICIPAL_BOUNDS = { minLat: -29.15, maxLat: -28.55, minLng: 24.45, maxLng: 25.05 } as const;
export const KIMBERLEY_CENTRE = { lat: -28.7382, lng: 24.7638 } as const;

export const LIMITS = {
  descriptionMin: 10,
  descriptionMax: 300,
  landmarkMax: 120,
  photosMax: 3,
  photoBytesMax: 5 * 1024 * 1024,
  photoTypes: ['image/jpeg', 'image/png', 'image/webp'],
  reasonMin: 10,
  reasonMax: 300,
  completionNotesMin: 10,
  completionNotesMax: 1000,
  alertTitleMax: 100,
  alertMessageMax: 500,
  alertMaxDays: 30,
  duplicateRadiusM: 100,
  duplicateWindowHours: 72,
  reopenWindowDays: 7,
  slaHoursMin: 1,
  slaHoursMax: 720,
  commentMax: 1000,
  passwordMin: 8,
  /** Default for BR-21 when settings/app has no value. */
  reportsPerHour: 10,
  reportsPerHourMax: 100,
  photoMaxPixels: 1600,
} as const;

/** Rounding used for the public map projection (~110 m). BR-17, NFR-11. */
export const PUBLIC_LOCATION_DECIMALS = 3;
