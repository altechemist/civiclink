import { CBD, createUser, resetEmulators, seedConfig, session, type Session } from '../../tests/support/emulator';

export interface World {
  resident: Session;
  resident2: Session;
  officialWater: Session;
  officialRoads: Session;
  worker: Session;
  worker2: Session;
  workerRoads: Session;
  admin: Session;
  anon: Session;
  ids: { inactiveWorker: string };
  all: Session[];
}

/** Fresh emulator state with one user per role (plus extras for negative cases). */
export async function setupWorld(): Promise<World> {
  await resetEmulators();
  await seedConfig();
  await createUser({ email: 'thandi@test.local', name: 'Thandi Resident', role: 'RESIDENT', suburb: 'Galeshewe' });
  await createUser({ email: 'pieter@test.local', name: 'Pieter Resident', role: 'RESIDENT', suburb: 'Roodepan' });
  await createUser({ email: 'official.water@test.local', name: 'Naledi Official', role: 'OFFICIAL', departmentId: 'water' });
  await createUser({ email: 'official.roads@test.local', name: 'Johan Official', role: 'OFFICIAL', departmentId: 'roads' });
  await createUser({ email: 'worker@test.local', name: 'Sipho Worker', role: 'FIELD_WORKER', departmentId: 'water' });
  await createUser({ email: 'worker2@test.local', name: 'Anele Worker', role: 'FIELD_WORKER', departmentId: 'water' });
  await createUser({ email: 'worker.roads@test.local', name: 'Kagiso Worker', role: 'FIELD_WORKER', departmentId: 'roads' });
  const inactiveWorker = await createUser({ email: 'gone@test.local', name: 'Inactive Worker', role: 'FIELD_WORKER', departmentId: 'water', isActive: false });
  await createUser({ email: 'admin@test.local', name: 'Ayanda Admin', role: 'ADMIN' });

  const [resident, resident2, officialWater, officialRoads, worker, worker2, workerRoads, admin, anon] = await Promise.all([
    session('thandi@test.local'),
    session('pieter@test.local'),
    session('official.water@test.local'),
    session('official.roads@test.local'),
    session('worker@test.local'),
    session('worker2@test.local'),
    session('worker.roads@test.local'),
    session('admin@test.local'),
    session(),
  ]);
  const all = [resident, resident2, officialWater, officialRoads, worker, worker2, workerRoads, admin, anon];
  return { resident, resident2, officialWater, officialRoads, worker, worker2, workerRoads, admin, anon, ids: { inactiveWorker }, all };
}

export async function teardown(w: World | undefined) {
  if (w) await Promise.all(w.all.map((s) => s.close()));
}

export const validReport = (over: Record<string, unknown> = {}) => ({
  categoryId: 'burst-pipe',
  description: 'Burst pipe flooding the street outside the clinic.',
  location: CBD,
  suburb: 'Kimberley CBD',
  severity: 'HIGH',
  photos: [],
  ...over,
});

/** Submits, triages and assigns a water report; returns ids for task-level tests. */
export async function assignedReport(w: World, location = CBD) {
  const { reportId, ref } = await w.resident.call('submitReport', validReport({ location }));
  await w.officialWater.call('triageReport', { reportId });
  const { taskId } = await w.officialWater.call('assignReport', { reportId, workerId: w.worker.uid, notes: 'Bring a 50 mm coupling' });
  return { reportId, ref, taskId };
}
