/**
 * Deterministic demo/test data for the local emulator (issue #3).
 *   npm run seed            → reset and seed
 * Every generated report follows the real state machine, so history, tasks, the public projection,
 * counters and analytics are consistent with what the Cloud Functions would have produced.
 */
import {
  approximateLocation,
  formatReference,
  OPEN_REPORT_STATUSES,
  ReportStateMachine,
  type HistoryDoc,
  type ReportDoc,
  type ReportEvent,
  type ReportStatus,
  type Severity,
  type TaskDoc,
  SUBURB_CENTRES as SHARED_CENTRES,
} from '@civiclink/shared';
import { geohashForLocation } from 'geofire-common';
import {
  adminDb,
  CATEGORIES,
  createUser,
  DEFAULT_PASSWORD,
  DEPARTMENTS,
  PROD,
  PROJECT_ID,
  resetEmulators,
  seedConfig,
  Timestamp,
} from '../tests/support/emulator';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const NOW = Date.now();

// Deterministic PRNG (mulberry32) so every seed run produces the same dataset.
let state = 20260331;
const rand = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const between = (a: number, b: number) => a + rand() * (b - a);

const SUBURB_CENTRES: Record<string, { lat: number; lng: number }> = SHARED_CENTRES;
const SUBURB_WEIGHTS = ['Galeshewe', 'Galeshewe', 'Galeshewe', 'Roodepan', 'Roodepan', 'Kimberley CBD', 'Kimberley CBD', 'Homestead', 'Homestead', ...Object.keys(SUBURB_CENTRES)];

const DESCRIPTIONS: Record<string, string[]> = {
  'burst-pipe': ['Burst pipe flooding the street, water pouring out since this morning.', 'Main water pipe burst near the school gate, road under water.', 'Water spraying from a broken pipe on the pavement.'],
  'water-leak': ['Leaking water meter wasting water day and night.', 'Slow leak from the fire hydrant on the corner.', 'Water seeping up through the road surface.'],
  electricity: ['Whole street without power since last night.', 'Streetlights out for the whole block, very dark and unsafe.', 'Transformer making loud noises and sparking.'],
  'road-damage': ['Large pothole damaging cars, already two flat tyres today.', 'Road surface collapsed next to the stormwater drain.', 'Deep pothole at the taxi stop, taxis swerving into traffic.'],
  'illegal-dumping': ['Building rubble and household waste dumped on the open field.', 'Illegal dumping site growing behind the shops, attracting rats.', 'Truck dumped tyres and rubble overnight.'],
  'public-safety': ['Open manhole with no cover next to the walkway.', 'Fallen tree blocking half the road after the storm.', 'Exposed electrical cables at the park.'],
  vandalism: ['Traffic signs vandalised and removed at the intersection.', 'Park benches broken and fencing stolen.', 'Graffiti and broken windows at the community hall.'],
  other: ['Stray animals on the main road causing near accidents.', 'Blocked stormwater drain causing flooding when it rains.'],
};
const COMPLETION = ['Repaired and tested; no further problems observed.', 'Damaged section replaced and area cleaned up.', 'Fault fixed and site made safe.', 'Material removed and site cleared.'];

interface Person {
  uid: string;
  name: string;
  email: string;
}

async function main() {
  if (PROD) {
    console.log(`Seeding the REAL project ${PROJECT_ID}…`);
    if (!(await adminDb.collection('users').limit(1).get()).empty) {
      console.error('This project already has users. Seeding is only allowed on an empty project.');
      process.exit(1);
    }
  } else {
    console.log('Resetting emulators…');
    await resetEmulators();
  }
  await seedConfig();
  await adminDb.collection('settings').doc('app').set({ reportsPerHour: 10 });

  console.log('Creating users…');
  const residents: Person[] = [];
  for (const [name, email, suburb] of [
    ['Thandi Mokoena', 'thandi@civiclink.demo', 'Galeshewe'],
    ['Pieter van Wyk', 'pieter@civiclink.demo', 'Roodepan'],
    ['Ayesha Petersen', 'ayesha@civiclink.demo', 'Kimberley CBD'],
    ['Kagiso Molefe', 'kagiso@civiclink.demo', 'Homestead'],
  ] as const) {
    residents.push({ uid: await createUser({ email, name, role: 'RESIDENT', suburb }), name, email });
  }
  const officials: Record<string, Person> = {};
  for (const [name, email, dept] of [
    ['Naledi Khumalo', 'naledi@civiclink.demo', 'water'],
    ['Thabo Nkosi', 'thabo@civiclink.demo', 'electricity'],
    ['Johan Steyn', 'johan@civiclink.demo', 'roads'],
    ['Lindiwe Sithole', 'lindiwe@civiclink.demo', 'waste'],
    ['Mandla Zulu', 'mandla@civiclink.demo', 'safety'],
  ] as const) {
    officials[dept] = { uid: await createUser({ email, name, role: 'OFFICIAL', departmentId: dept }), name, email };
  }
  const workers: Record<string, Person[]> = {};
  for (const [name, email, dept] of [
    ['Sipho Dlamini', 'sipho@civiclink.demo', 'water'],
    ['Anele Mthembu', 'anele@civiclink.demo', 'water'],
    ['Bongani Shabalala', 'bongani@civiclink.demo', 'electricity'],
    ['Mpho Radebe', 'mpho@civiclink.demo', 'roads'],
    ['Tumelo Baloyi', 'tumelo@civiclink.demo', 'waste'],
    ['Zanele Ndlovu', 'zanele@civiclink.demo', 'safety'],
  ] as const) {
    (workers[dept] ??= []).push({ uid: await createUser({ email, name, role: 'FIELD_WORKER', departmentId: dept }), name, email });
  }
  const admin = { uid: await createUser({ email: 'admin@civiclink.demo', name: 'Ayanda Admin', role: 'ADMIN' }), name: 'Ayanda Admin' };

  console.log('Generating reports…');
  const slaOf = new Map(DEPARTMENTS.map((d) => [d.id, d.slaHours]));
  const generated: { created: number; build: (seq: number) => Promise<void> }[] = [];

  for (let i = 0; i < 150; i++) {
    const category = pick(CATEGORIES);
    const suburb = pick(SUBURB_WEIGHTS);
    const centre = SUBURB_CENTRES[suburb]!;
    const location = { lat: centre.lat + between(-0.008, 0.008), lng: centre.lng + between(-0.008, 0.008) };
    // Thandi gets a share of reports so the demo resident has a rich history.
    const reporter = i % 7 === 0 ? residents[0]! : pick(residents);
    const created = NOW - Math.pow(rand(), 1.4) * 30 * DAY - HOUR;
    const severity: Severity = pick(['HIGH', 'MEDIUM', 'MEDIUM', 'LOW']);
    generated.push({ created, build: (seq) => buildReport(seq, { category, suburb, location, reporter, created, severity }) });
  }

  async function buildReport(
    seq: number,
    a: { category: (typeof CATEGORIES)[number]; suburb: string; location: { lat: number; lng: number }; reporter: Person; created: number; severity: Severity },
  ) {
    const dept = a.category.departmentId;
    const official = officials[dept]!;
    const worker = pick(workers[dept]!);
    const sla = slaOf.get(dept)!;
    const ref = formatReference(new Date(a.created).getUTCFullYear(), seq);
    const reportRef = adminDb.collection('reports').doc();
    const history: HistoryDoc[] = [];
    let status: ReportStatus | null = null;
    let t = a.created;
    const patch: Partial<ReportDoc> = {};
    let task: TaskDoc | null = null;
    const taskRef = adminDb.collection('tasks').doc();

    const step = (event: ReportEvent, actor: 'RESIDENT' | 'OFFICIAL' | 'FIELD_WORKER' | 'SYSTEM', who: { uid: string; name: string }, note: string) => {
      const to = ReportStateMachine.next(status, event, actor);
      history.push({ from: status, to, event, actorId: who.uid, actorRole: actor, actorName: who.name, note, at: Timestamp.fromMillis(t) });
      status = to;
    };
    const taskEvent = (event: string, note: string) =>
      history.push({ from: status, to: status!, event, actorId: worker.uid, actorRole: 'FIELD_WORKER', actorName: worker.name, note, at: Timestamp.fromMillis(t) });
    const advance = (minH: number, maxH: number) => {
      const next = t + between(minH, maxH) * HOUR;
      if (next >= NOW - 5 * 60_000) return false;
      t = next;
      return true;
    };
    const maybeEscalate = (deadline: number) => {
      if (deadline < NOW && deadline < t && status !== 'ESCALATED' && !patch.escalatedAt) {
        const saved = t;
        t = a.created + sla * HOUR + between(0.1, 1) * HOUR;
        if (t < saved) {
          step('escalate', 'SYSTEM', { uid: 'system', name: 'CivicLink system' }, `Automatically escalated: not resolved within the ${sla}-hour SLA`);
          patch.escalatedAt = Timestamp.fromMillis(t);
        }
        t = Math.max(t, saved);
      }
    };

    step('submit', 'RESIDENT', a.reporter, 'Report submitted');
    const roll = rand();
    // Lifecycle simulation: each step happens only if its time is already in the past.
    if (roll < 0.06 && advance(1, 10)) {
      step('reject', 'OFFICIAL', official, 'Rejected: Located on private property, not a municipal responsibility');
      patch.closedAt = Timestamp.fromMillis(t);
    } else if (advance(0.5, 10)) {
      step('triage', 'OFFICIAL', official, 'Report reviewed');
      const slow = rand() < 0.25;
      if (advance(0.5, slow ? 30 : 8)) {
        maybeEscalate(a.created + sla * HOUR);
        step('assign', 'OFFICIAL', official, `Assigned to ${worker.name}`);
        task = {
          reportId: reportRef.id, reportRef: ref, workerId: worker.uid, workerName: worker.name, assignedBy: official.uid, departmentId: dept,
          categoryName: a.category.name, priority: a.severity, status: 'ASSIGNED', location: a.location, suburb: a.suburb, notes: null,
          completionNotes: null, proofIds: [], assignedAt: Timestamp.fromMillis(t), acceptedAt: null, startedAt: null, completedAt: null, endedAt: null,
        };
        patch.assignedWorkerId = worker.uid;
        patch.assignedWorkerName = worker.name;
        patch.activeTaskId = taskRef.id;
        if (advance(0.2, 3)) {
          taskEvent('task.accept', `${worker.name} accepted the task`);
          task.status = 'ACCEPTED';
          task.acceptedAt = Timestamp.fromMillis(t);
          if (advance(0.5, 6)) {
            taskEvent('task.start', `${worker.name} started work on site`);
            task.status = 'IN_PROGRESS';
            task.startedAt = Timestamp.fromMillis(t);
            if (advance(1, slow ? sla * 1.6 : sla * 0.6)) {
              maybeEscalate(a.created + sla * HOUR);
              const notes = pick(COMPLETION);
              step('completeTask', 'FIELD_WORKER', worker, `Resolved by ${worker.name}: ${notes}`);
              Object.assign(task, { status: 'COMPLETED', completionNotes: notes, completedAt: Timestamp.fromMillis(t), endedAt: Timestamp.fromMillis(t) });
              Object.assign(patch, { resolvedAt: Timestamp.fromMillis(t), activeTaskId: null, resolutionNotes: notes, resolutionPhotoIds: [] });
              const resolvedAt = t;
              if (rand() < 0.5 && advance(2, 72)) {
                step('confirm', 'RESIDENT', a.reporter, 'Resident confirmed the fix');
                patch.closedAt = Timestamp.fromMillis(t);
              } else if (NOW - resolvedAt > 7 * DAY) {
                t = resolvedAt + 7 * DAY + HOUR;
                step('autoClose', 'SYSTEM', { uid: 'system', name: 'CivicLink system' }, 'Closed automatically after 7 days without a response');
                patch.closedAt = Timestamp.fromMillis(t);
              }
            }
          }
        }
      }
    }
    // Still open past its SLA without escalation → the hourly schedule would have escalated it.
    if (OPEN_REPORT_STATUSES.includes(status!) && status !== 'ESCALATED' && !patch.escalatedAt && a.created + sla * HOUR < NOW - HOUR) {
      t = a.created + sla * HOUR + 0.5 * HOUR;
      step('escalate', 'SYSTEM', { uid: 'system', name: 'CivicLink system' }, `Automatically escalated: not resolved within the ${sla}-hour SLA`);
      patch.escalatedAt = Timestamp.fromMillis(t);
    }

    const finalStatus = status! as ReportStatus;
    const description = pick(DESCRIPTIONS[a.category.id] ?? DESCRIPTIONS.other!);
    const report: ReportDoc = {
      ref, reporterId: a.reporter.uid, reporterName: a.reporter.name, categoryId: a.category.id, categoryName: a.category.name, departmentId: dept,
      description, location: a.location, geohash: geohashForLocation([a.location.lat, a.location.lng]), suburb: a.suburb, landmark: null,
      severity: a.severity, photoIds: [], status: finalStatus, assignedWorkerId: null, assignedWorkerName: null, activeTaskId: null,
      parentReportId: null, parentRef: null, affectedCount: 1 + (rand() < 0.15 ? Math.floor(between(1, 5)) : 0), followerIds: [],
      createdAt: Timestamp.fromMillis(a.created), updatedAt: Timestamp.fromMillis(t), resolvedAt: null, escalatedAt: null, closedAt: null,
      ...patch,
    };
    const batch = adminDb.batch();
    batch.set(reportRef, report);
    for (const h of history) batch.set(reportRef.collection('history').doc(), h);
    if (task) batch.set(taskRef, task);
    batch.set(adminDb.collection('publicReports').doc(reportRef.id), {
      ref, categoryId: report.categoryId, categoryName: report.categoryName, status: finalStatus, location: approximateLocation(report.location),
      suburb: report.suburb, affectedCount: report.affectedCount, isOpen: OPEN_REPORT_STATUSES.includes(finalStatus), createdAt: report.createdAt,
    });
    await batch.commit();
  }

  generated.sort((x, y) => x.created - y.created);
  for (let i = 0; i < generated.length; i++) await generated[i]!.build(i + 1);
  await adminDb.collection('counters').doc(`reports-${new Date(NOW).getUTCFullYear()}`).set({ next: generated.length });

  console.log('Broadcasting alerts…');
  const residentsBySuburb = new Map<string, string[]>();
  for (const s of (await adminDb.collection('users').where('role', '==', 'RESIDENT').get()).docs) {
    const suburb = s.get('suburb') as string;
    residentsBySuburb.set(suburb, [...(residentsBySuburb.get(suburb) ?? []), s.id]);
  }
  const alerts = [
    { type: 'EMERGENCY', title: 'Strike: road closures in the CBD', message: 'Municipal workers are marching through the CBD. Du Toitspan and Jones Streets are closed until 16:00. Use the R31 Belgrave Road as an alternative route.', targetSuburbs: ['Kimberley CBD', 'Galeshewe', 'West End'], createdAt: NOW - 3 * HOUR, expiresAt: NOW + 20 * HOUR, by: officials.roads! },
    { type: 'ELECTRICITY', title: 'Planned outage: Roodepan substation maintenance', message: 'Power will be off on Saturday from 08:00 to 14:00 while the substation is upgraded. Please switch off sensitive appliances.', targetSuburbs: ['Roodepan', 'Platfontein'], createdAt: NOW - 26 * HOUR, expiresAt: NOW + 3 * DAY, by: officials.electricity! },
    { type: 'WATER', title: 'Low water pressure expected tonight', message: 'Reservoir cleaning will lower water pressure between 22:00 and 05:00 across Sol Plaatje. Store drinking water in advance.', targetSuburbs: ['ALL'], createdAt: NOW - 5 * HOUR, expiresAt: NOW + 2 * DAY, by: officials.water! },
    { type: 'ROADS', title: 'Resurfacing on Long Street completed', message: 'Long Street has reopened to all traffic. Thank you for your patience.', targetSuburbs: ['Homestead'], createdAt: NOW - 6 * DAY, expiresAt: NOW - 4 * DAY, by: officials.roads! },
  ] as const;
  for (const a of alerts) {
    const recipients = a.targetSuburbs.includes('ALL' as never) ? [...residentsBySuburb.values()].flat() : a.targetSuburbs.flatMap((s) => residentsBySuburb.get(s) ?? []);
    const ref = adminDb.collection('alerts').doc();
    const reads = recipients.filter(() => rand() < 0.4);
    const batch = adminDb.batch();
    batch.set(ref, {
      type: a.type, title: a.title, message: a.message, targetSuburbs: [...a.targetSuburbs], createdBy: a.by.uid, createdByName: a.by.name, isActive: true,
      recipientCount: recipients.length, readCount: reads.length, createdAt: Timestamp.fromMillis(a.createdAt), expiresAt: Timestamp.fromMillis(a.expiresAt),
    });
    for (const uid of recipients) {
      batch.set(ref.collection('recipients').doc(uid), {
        uid, alertId: ref.id, channel: 'IN_APP', deliveredAt: Timestamp.fromMillis(a.createdAt), readAt: reads.includes(uid) ? Timestamp.fromMillis(a.createdAt + HOUR) : null,
      });
    }
    await batch.commit();
  }
  await adminDb.collection('systemLogs').add({ level: 'INFO', source: 'seed', message: 'Demo data seeded', actorId: admin.uid, createdAt: Timestamp.now() });

  const counts = await adminDb.collection('reports').get();
  const byStatus: Record<string, number> = {};
  for (const d of counts.docs) byStatus[d.get('status')] = (byStatus[d.get('status')] ?? 0) + 1;
  console.log(`Seeded ${counts.size} reports`, byStatus);
  console.log(`Demo password for every account: ${DEFAULT_PASSWORD}`);
  console.log('Resident: thandi@civiclink.demo · Official: naledi@civiclink.demo · Worker: sipho@civiclink.demo · Admin: admin@civiclink.demo');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
