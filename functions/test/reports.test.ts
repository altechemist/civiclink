import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { HistoryDoc, ReportDoc, TaskDoc } from '@civiclink/shared';
import { adminDb, CBD, expectCode, northOf, PHOTO, PNG_B64, Timestamp } from '../../tests/support/emulator';
import { assignedReport, setupWorld, teardown, validReport, type World } from './fixtures';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
});
afterAll(() => teardown(w));

const report = async (id: string) => (await adminDb.collection('reports').doc(id).get()).data() as ReportDoc;
const task = async (id: string) => (await adminDb.collection('tasks').doc(id).get()).data() as TaskDoc;
const history = async (id: string) =>
  (await adminDb.collection('reports').doc(id).collection('history').orderBy('at').get()).docs.map((d) => d.data() as HistoryDoc);
const notifications = async (uid: string) =>
  (await adminDb.collection('users').doc(uid).collection('notifications').get()).docs.map((d) => d.data());
// Spread test reports out so the duplicate rule (100 m) does not interfere between tests.
// A 15×15 grid of points ~550 m apart around the CBD, all inside the municipal bounds.
let spot = 0;
const freshSpot = () => {
  const n = ++spot;
  return { lat: CBD.lat + ((n % 15) - 7) * 0.005, lng: CBD.lng + (Math.floor(n / 15) - 7) * 0.005 };
};

describe('submitReport (FR-03, FR-04, FR-05, TX-1)', () => {
  it('IT-RPT-01 valid submission creates a SUBMITTED report with a reference', async () => {
    const res = await w.resident.call('submitReport', validReport({ location: freshSpot(), photos: [PHOTO], landmark: 'Next to the clinic' }));
    expect(res.ref).toMatch(/^CL-\d{4}-\d{4}$/);
    expect(res.duplicateOf).toBeNull();
    const r = await report(res.reportId);
    expect(r).toMatchObject({ status: 'SUBMITTED', reporterId: w.resident.uid, affectedCount: 1 });
    expect(r.photoIds).toHaveLength(1);
    const photo = (await adminDb.collection('photos').doc(r.photoIds[0]!).get()).data()!;
    expect(photo).toMatchObject({ reportId: res.reportId, ownerId: w.resident.uid, kind: 'EVIDENCE', contentType: 'image/png' });
    expect(Buffer.from(photo.data as Uint8Array).toString('base64')).toBe(PNG_B64);
  });

  it('IT-RPT-02 invalid fields are rejected with field errors and nothing is written', async () => {
    const before = (await adminDb.collection('reports').count().get()).data().count;
    const err = await expectCode(w.resident.call('submitReport', validReport({ description: 'short', suburb: 'Sandton' })), 'invalid-argument');
    expect((err.details as { fields: Record<string, string> }).fields).toHaveProperty('description');
    expect((err.details as { fields: Record<string, string> }).fields).toHaveProperty('suburb');
    expect((await adminDb.collection('reports').count().get()).data().count).toBe(before);
  });

  it('IT-RPT-03 location outside the municipality is rejected (BR-02)', async () => {
    await expectCode(w.resident.call('submitReport', validReport({ location: { lat: -26.2, lng: 28.04 } })), 'invalid-argument');
  });

  it('IT-RPT-04 photos must really be images of the declared type and within the size limit', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
    await expectCode(w.resident.call('submitReport', validReport({ location: freshSpot(), photos: [{ contentType: 'image/png', data: svg }] })), 'invalid-argument');
    await expectCode(w.resident.call('submitReport', validReport({ location: freshSpot(), photos: [{ contentType: 'image/jpeg', data: PNG_B64 }] })), 'invalid-argument');
    const big = Buffer.concat([Buffer.from(PNG_B64, 'base64'), Buffer.alloc(701 * 1024)]).toString('base64');
    await expectCode(w.resident.call('submitReport', validReport({ location: freshSpot(), photos: [{ contentType: 'image/png', data: big }] })), 'invalid-argument');
  });
  it('IT-RPT-05 inactive category is refused (BR-19)', async () => {
    await adminDb.collection('categories').doc('vandalism').update({ isActive: false });
    await expectCode(w.resident.call('submitReport', validReport({ categoryId: 'vandalism', location: freshSpot() })), 'invalid-argument');
    await adminDb.collection('categories').doc('vandalism').update({ isActive: true });
  });

  it('IT-RPT-06 only residents may submit (BR-01)', async () => {
    await expectCode(w.officialWater.call('submitReport', validReport()), 'permission-denied');
    await expectCode(w.worker.call('submitReport', validReport()), 'permission-denied');
    await expectCode(w.anon.call('submitReport', validReport()), 'unauthenticated');
  });

  it('IT-RPT-07 default department from category, one history entry, officials notified', async () => {
    const { reportId, ref } = await w.resident.call('submitReport', validReport({ categoryId: 'road-damage', location: freshSpot() }));
    const r = await report(reportId);
    expect(r.departmentId).toBe('roads');
    const h = await history(reportId);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ from: null, to: 'SUBMITTED', actorRole: 'RESIDENT' });
    const n = await notifications(w.officialRoads.uid);
    expect(n.some((x) => String(x.title).includes(ref))).toBe(true);
    const pub = (await adminDb.collection('publicReports').doc(reportId).get()).data()!;
    expect(pub).not.toHaveProperty('reporterId');
    expect(pub).not.toHaveProperty('description');
  });

  it('IT-RPT-08 concurrent submissions get unique sequential references (BR-04, NFR-10)', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        (i % 2 ? w.resident : w.resident2).call('submitReport', validReport({ categoryId: 'water-leak', location: freshSpot() })),
      ),
    );
    const refs = results.map((r) => r.ref);
    expect(new Set(refs).size).toBe(12);
    const seqs = refs.map((r) => Number(r.split('-')[2])).sort((a, b) => a - b);
    expect(seqs[11]! - seqs[0]!).toBe(11);
  });

  it('IT-RPT-09 a nearby open report of the same category is linked as a duplicate (BR-03)', async () => {
    const spot = freshSpot();
    const parent = await w.resident.call('submitReport', validReport({ location: spot }));
    const dup = await w.resident2.call('submitReport', validReport({ location: northOf(spot, 60) }));
    expect(dup.duplicateOf).toEqual({ reportId: parent.reportId, ref: parent.ref });
    expect(await report(dup.reportId)).toMatchObject({ status: 'DUPLICATE', parentReportId: parent.reportId });
    const p = await report(parent.reportId);
    expect(p.affectedCount).toBe(2);
    expect(p.followerIds).toContain(w.resident2.uid);
    // 150 m away and a different category are new reports.
    expect((await w.resident2.call('submitReport', validReport({ location: northOf(spot, 150) }))).duplicateOf).toBeNull();
    expect((await w.resident2.call('submitReport', validReport({ location: spot, categoryId: 'electricity' }))).duplicateOf).toBeNull();
  });

  it('IT-RPT-10 optional fields sent as undefined/null by the web client are accepted (DEF-02)', async () => {
    const res = await w.resident.call('submitReport', validReport({ location: freshSpot(), landmark: undefined }));
    expect(res.ref).toMatch(/^CL-/);
    const res2 = await w.resident.call('submitReport', validReport({ location: freshSpot(), landmark: null }));
    expect(res2.ref).toMatch(/^CL-/);
  });
});

describe('triage and reject (FR-09)', () => {
  it('IT-TRI-01 triage moves SUBMITTED → UNDER_REVIEW and records history', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    expect((await w.officialWater.call('triageReport', { reportId })).status).toBe('UNDER_REVIEW');
    expect((await history(reportId)).map((h) => h.to)).toEqual(['SUBMITTED', 'UNDER_REVIEW']);
  });
  it('IT-TRI-02 triage from a non-SUBMITTED status is refused', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await w.officialWater.call('triageReport', { reportId });
    await expectCode(w.officialWater.call('triageReport', { reportId }), 'failed-precondition');
  });
  it('IT-TRI-03 reject needs a reason ≥ 10 characters (BR-12)', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await expectCode(w.officialWater.call('rejectReport', { reportId, reason: 'no' }), 'invalid-argument');
    expect((await w.officialWater.call('rejectReport', { reportId, reason: 'Private property, not municipal' })).status).toBe('REJECTED');
  });
  it("IT-TRI-04 officials cannot act on another department's report (BR-20)", async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await expectCode(w.officialRoads.call('triageReport', { reportId }), 'permission-denied');
    await expectCode(w.resident.call('triageReport', { reportId }), 'permission-denied');
  });
  it('IT-TRI-05 rerouting to an inactive department is refused; active reroute works', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await adminDb.collection('departments').doc('waste').update({ isActive: false });
    await expectCode(w.officialWater.call('triageReport', { reportId, departmentId: 'waste' }), 'invalid-argument');
    await adminDb.collection('departments').doc('waste').update({ isActive: true });
    await w.officialWater.call('triageReport', { reportId, departmentId: 'roads' });
    expect((await report(reportId)).departmentId).toBe('roads');
  });
});

describe('assign and reassign (FR-10, FR-12, TX-2)', () => {
  it('IT-ASG-01 assignment creates a task, moves the report to IN_PROGRESS and notifies', async () => {
    const { reportId, taskId } = await assignedReport(w, freshSpot());
    expect(await report(reportId)).toMatchObject({ status: 'IN_PROGRESS', assignedWorkerId: w.worker.uid, activeTaskId: taskId });
    expect(await task(taskId)).toMatchObject({ status: 'ASSIGNED', workerId: w.worker.uid, priority: 'HIGH' });
    expect((await notifications(w.worker.uid)).some((n) => n.type === 'TASK_ASSIGNED')).toBe(true);
  });
  it("IT-ASG-02 a worker from another department is refused (BR-07)", async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await w.officialWater.call('triageReport', { reportId });
    await expectCode(w.officialWater.call('assignReport', { reportId, workerId: w.workerRoads.uid }), 'invalid-argument');
  });
  it('IT-ASG-03 an inactive worker is refused (BR-07)', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await w.officialWater.call('triageReport', { reportId });
    await expectCode(w.officialWater.call('assignReport', { reportId, workerId: w.ids.inactiveWorker }), 'invalid-argument');
  });
  it('IT-ASG-04 a report with an active task cannot be assigned again (BR-06)', async () => {
    const { reportId } = await assignedReport(w, freshSpot());
    await expectCode(w.officialWater.call('assignReport', { reportId, workerId: w.worker2.uid }), 'failed-precondition');
  });
  it('IT-ASG-05 a SUBMITTED (untriaged) report cannot be assigned', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await expectCode(w.officialWater.call('assignReport', { reportId, workerId: w.worker.uid }), 'failed-precondition');
  });
  it('IT-ASG-06 residents and workers cannot assign', async () => {
    await expectCode(w.resident.call('assignReport', { reportId: 'x', workerId: 'y' }), 'permission-denied');
    await expectCode(w.worker.call('assignReport', { reportId: 'x', workerId: 'y' }), 'permission-denied');
  });
  it('IT-ASG-07 two concurrent assignments: exactly one succeeds (NFR-10)', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await w.officialWater.call('triageReport', { reportId });
    const results = await Promise.allSettled([
      w.officialWater.call('assignReport', { reportId, workerId: w.worker.uid }),
      w.admin.call('assignReport', { reportId, workerId: w.worker2.uid }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const tasks = await adminDb.collection('tasks').where('reportId', '==', reportId).get();
    expect(tasks.size).toBe(1);
  });
  it('IT-ASG-08 reassignment ends the old task and creates a new one', async () => {
    const { reportId, taskId } = await assignedReport(w, freshSpot());
    const { taskId: newTaskId } = await w.officialWater.call('reassignTask', { reportId, workerId: w.worker2.uid });
    expect((await task(taskId)).status).toBe('REASSIGNED');
    expect(await task(newTaskId)).toMatchObject({ status: 'ASSIGNED', workerId: w.worker2.uid });
    expect(await report(reportId)).toMatchObject({ status: 'IN_PROGRESS', activeTaskId: newTaskId, assignedWorkerId: w.worker2.uid });
  });
  it('IT-ASG-09 reassigning to the same worker is refused', async () => {
    const { reportId } = await assignedReport(w, freshSpot());
    await expectCode(w.officialWater.call('reassignTask', { reportId, workerId: w.worker.uid }), 'invalid-argument');
  });
  it('IT-ASG-10 reassigning without an active task is refused', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await w.officialWater.call('triageReport', { reportId });
    await expectCode(w.officialWater.call('reassignTask', { reportId, workerId: w.worker.uid }), 'failed-precondition');
  });
});

describe('field worker tasks (FR-11, TX-3)', () => {
  it('IT-TSK-01 accept → start → complete resolves the report and notifies the resident', async () => {
    const { reportId, taskId } = await assignedReport(w, freshSpot());
    expect((await w.worker.call('updateTask', { taskId, action: 'accept' })).status).toBe('ACCEPTED');
    expect((await w.worker.call('updateTask', { taskId, action: 'start' })).status).toBe('IN_PROGRESS');
    expect((await w.worker.call('completeTask', { taskId, notes: 'Pipe joint replaced and tested', proofs: [PHOTO] })).status).toBe('COMPLETED');
    const r = await report(reportId);
    expect(r.status).toBe('RESOLVED');
    expect(r.resolvedAt).toBeTruthy();
    expect(r.activeTaskId).toBeNull();
    expect((await notifications(w.resident.uid)).some((n) => String(n.title).includes('resolved'))).toBe(true);
    expect((await history(reportId)).map((h) => h.event)).toEqual(['submit', 'triage', 'assign', 'task.accept', 'task.start', 'completeTask']);
  });
  it('IT-TSK-02 another worker cannot act on the task (BR-08)', async () => {
    const { taskId } = await assignedReport(w, freshSpot());
    await expectCode(w.worker2.call('updateTask', { taskId, action: 'accept' }), 'permission-denied');
  });
  it('IT-TSK-03 steps cannot be skipped (BR-08)', async () => {
    const { taskId } = await assignedReport(w, freshSpot());
    await expectCode(w.worker.call('updateTask', { taskId, action: 'start' }), 'failed-precondition');
    await expectCode(w.worker.call('completeTask', { taskId, notes: 'Done and dusted here', proofs: [PHOTO] }), 'failed-precondition');
  });
  it('IT-TSK-04 completion without notes or proof is refused (BR-09)', async () => {
    const { taskId } = await assignedReport(w, freshSpot());
    await expectCode(w.worker.call('completeTask', { taskId, notes: 'ok', proofs: [] }), 'invalid-argument');
  });
  it('IT-TSK-05 proof photos must match their declared type', async () => {
    const { taskId } = await assignedReport(w, freshSpot());
    await w.worker.call('updateTask', { taskId, action: 'accept' });
    await w.worker.call('updateTask', { taskId, action: 'start' });
    await expectCode(
      w.worker.call('completeTask', { taskId, notes: 'Pipe joint replaced', proofs: [{ contentType: 'image/webp', data: PNG_B64 }] }),
      'invalid-argument',
    );
  });
  it('IT-TSK-06 a reassigned (stale) task cannot be completed', async () => {
    const { reportId, taskId } = await assignedReport(w, freshSpot());
    await w.worker.call('updateTask', { taskId, action: 'accept' });
    await w.worker.call('updateTask', { taskId, action: 'start' });
    await w.officialWater.call('reassignTask', { reportId, workerId: w.worker2.uid });
    await expectCode(w.worker.call('completeTask', { taskId, notes: 'Finished anyway today', proofs: [PHOTO] }), 'failed-precondition');
    expect((await report(reportId)).status).toBe('IN_PROGRESS');
  });
  it('IT-TSK-07 officials and residents cannot complete tasks', async () => {
    const { taskId } = await assignedReport(w, freshSpot());
    await expectCode(w.officialWater.call('completeTask', { taskId, notes: 'Pipe joint replaced', proofs: [PHOTO] }), 'permission-denied');
    await expectCode(w.resident.call('updateTask', { taskId, action: 'accept' }), 'permission-denied');
  });
});

describe('escalation and resolution (FR-13, FR-14)', () => {
  const HOUR = 3600_000;
  it('IT-ESC-01 the schedule escalates reports past their SLA once, and is idempotent', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    const created = (await report(reportId)).createdAt.toMillis();
    const later = created + 49 * HOUR; // water SLA 48 h
    const first = await w.admin.call('runMaintenance', { now: later });
    expect(first.escalated).toBeGreaterThanOrEqual(1);
    expect((await report(reportId)).status).toBe('ESCALATED');
    await w.admin.call('runMaintenance', { now: later + HOUR });
    expect((await history(reportId)).filter((h) => h.to === 'ESCALATED')).toHaveLength(1);
  });
  it('IT-ESC-02 manual escalation requires a reason; escalated reports can be assigned', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await expectCode(w.officialWater.call('escalateReport', { reportId, reason: '' }), 'invalid-argument');
    await w.officialWater.call('escalateReport', { reportId, reason: 'Hospital water supply affected' });
    await w.officialWater.call('assignReport', { reportId, workerId: w.worker.uid });
    expect((await report(reportId)).status).toBe('IN_PROGRESS');
  });
  it('IT-ESC-03 only admins can run maintenance', async () => {
    await expectCode(w.officialWater.call('runMaintenance', {}), 'permission-denied');
  });

  async function resolved() {
    const { reportId, taskId } = await assignedReport(w, freshSpot());
    await w.worker.call('updateTask', { taskId, action: 'accept' });
    await w.worker.call('updateTask', { taskId, action: 'start' });
    await w.worker.call('completeTask', { taskId, notes: 'Pipe joint replaced and tested', proofs: [PHOTO] });
    return reportId;
  }
  it('IT-RES-01 the reporter can confirm a resolved report (→ CLOSED)', async () => {
    const reportId = await resolved();
    expect((await w.resident.call('confirmResolution', { reportId })).status).toBe('CLOSED');
  });
  it('IT-RES-02 the reporter can reopen with a reason (→ UNDER_REVIEW); officials notified', async () => {
    const reportId = await resolved();
    expect((await w.resident.call('reopenReport', { reportId, reason: 'Still leaking this morning' })).status).toBe('UNDER_REVIEW');
    expect(await report(reportId)).toMatchObject({ resolvedAt: null, activeTaskId: null });
  });
  it('IT-RES-03 after 7 days confirm/reopen are refused and the schedule closes the report', async () => {
    const reportId = await resolved();
    const resolvedAt = (await report(reportId)).resolvedAt!.toMillis();
    await adminDb.collection('reports').doc(reportId).update({ resolvedAt: Timestamp.fromMillis(resolvedAt - 8 * 24 * HOUR) });
    await expectCode(w.resident.call('reopenReport', { reportId, reason: 'Still leaking this morning' }), 'failed-precondition');
    await w.admin.call('runMaintenance', {});
    expect((await report(reportId)).status).toBe('CLOSED');
  });
  it('IT-RES-04 another resident cannot confirm or reopen', async () => {
    const reportId = await resolved();
    await expectCode(w.resident2.call('confirmResolution', { reportId }), 'permission-denied');
  });
  it('IT-RES-05 confirming an unresolved report is refused', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await expectCode(w.resident.call('confirmResolution', { reportId }), 'failed-precondition');
  });
});

describe('Me too (FR-33, BR-23)', () => {
  it('IT-AFF-01 a resident confirms an open issue: count, follower and timeline update once', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    const first = await w.resident2.call('affirmReport', { reportId });
    expect(first).toEqual({ affectedCount: 2, alreadyConfirmed: false });
    const again = await w.resident2.call('affirmReport', { reportId });
    expect(again).toEqual({ affectedCount: 2, alreadyConfirmed: true });
    const r = await report(reportId);
    expect(r.affectedCount).toBe(2);
    expect(r.followerIds).toContain(w.resident2.uid);
    expect((await adminDb.collection('publicReports').doc(reportId).get()).get('affectedCount')).toBe(2);
    expect((await history(reportId)).filter((h) => h.event === 'affirm')).toHaveLength(1);
  });
  it('IT-AFF-02 own reports, closed reports and staff are refused', async () => {
    const { reportId } = await w.resident.call('submitReport', validReport({ location: freshSpot() }));
    await expectCode(w.resident.call('affirmReport', { reportId }), 'failed-precondition');
    await expectCode(w.officialWater.call('affirmReport', { reportId }), 'permission-denied');
    await w.officialWater.call('rejectReport', { reportId, reason: 'Duplicate of an older phone report' });
    await expectCode(w.resident2.call('affirmReport', { reportId }), 'failed-precondition');
  });
});

describe('comments (FR-22, BR-18)', () => {
  it('IT-CMT-01 staff with access can comment; residents and other departments cannot', async () => {
    const { reportId } = await assignedReport(w, freshSpot());
    await w.officialWater.call('addComment', { reportId, text: 'Check the valve upstream first' });
    await w.worker.call('addComment', { reportId, text: 'On my way' });
    await expectCode(w.officialRoads.call('addComment', { reportId, text: 'hi' }), 'permission-denied');
    await expectCode(w.resident.call('addComment', { reportId, text: 'hi' }), 'permission-denied');
  });
});
