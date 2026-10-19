import type { Claims, DepartmentDoc, Role, UserDoc } from '@civiclink/shared';
import type { z } from 'zod';
import type { createStaffUserSchema, registerResidentSchema, setUserRoleSchema } from '@civiclink/shared';
import type { Actor } from '../lib/command';
import { DomainError, denied, invalid, notFound } from '../lib/errors';
import { auth, col, ts } from '../lib/firebase';
import { writeLog } from './logService';

const claimsFor = (u: Pick<UserDoc, 'role' | 'departmentId' | 'suburb' | 'isActive'>): Claims => ({
  role: u.role,
  dept: u.departmentId ?? null,
  suburb: u.suburb ?? null,
  active: u.isActive,
});

function isEmailTaken(err: unknown) {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'auth/email-already-exists';
}

/** FR-01, FR-20: accounts, roles and activation. Claims mirror the Firestore profile for Security Rules. */
export class UserService {
  constructor(private readonly clock: () => number = Date.now) {}

  private async create(
    data: { name: string; email: string; password: string; role: Role; departmentId?: string | null; suburb?: string | null; phone?: string | null },
  ) {
    let uid: string;
    try {
      uid = (await auth.createUser({ email: data.email, password: data.password, displayName: data.name })).uid;
    } catch (err) {
      if (isEmailTaken(err)) throw new DomainError('already-exists', 'Email already registered', { email: 'Email already registered' });
      throw err;
    }
    const doc: UserDoc = {
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone ?? null,
      role: data.role,
      departmentId: data.departmentId ?? null,
      suburb: data.suburb ?? null,
      isActive: true,
      createdAt: ts(this.clock()),
      lastLoginAt: null,
    };
    try {
      await auth.setCustomUserClaims(uid, claimsFor(doc));
      await col.users().doc(uid).set(doc);
    } catch (err) {
      await auth.deleteUser(uid).catch(() => {}); // compensate so no half-created account remains
      throw err;
    }
    return { uid };
  }

  /** FR-01 / BR-16: self-registration is always RESIDENT. */
  registerResident(input: z.infer<typeof registerResidentSchema>) {
    return this.create({ ...input, role: 'RESIDENT' });
  }

  private async assertDepartment(departmentId: string | undefined | null) {
    if (!departmentId) return;
    const dept = (await col.departments().doc(departmentId).get()).data() as DepartmentDoc | undefined;
    if (!dept || !dept.isActive) throw invalid('departmentId', 'Choose an active department');
  }

  async createStaff(input: z.infer<typeof createStaffUserSchema>, actor: Actor) {
    await this.assertDepartment(input.role === 'ADMIN' ? null : input.departmentId);
    const result = await this.create({ ...input, departmentId: input.role === 'ADMIN' ? null : input.departmentId });
    await writeLog('INFO', 'admin.createStaffUser', `${actor.name} created ${input.role} ${input.email}`, actor.uid);
    return result;
  }

  private async load(uid: string) {
    const ref = col.users().doc(uid);
    const user = (await ref.get()).data() as UserDoc | undefined;
    if (!user) throw notFound('User');
    return { ref, user };
  }

  /** Revoking refresh tokens forces the client to pick up new claims; the web app also refreshes on profile change. */
  private async syncClaims(uid: string, user: UserDoc) {
    await auth.setCustomUserClaims(uid, claimsFor(user));
    await auth.revokeRefreshTokens(uid);
  }

  /** BR-15: an admin cannot demote themselves (prevents lock-out). */
  async setRole(input: z.infer<typeof setUserRoleSchema>, actor: Actor) {
    if (input.uid === actor.uid) throw denied('You cannot change your own role');
    const { ref, user } = await this.load(input.uid);
    const departmentId = input.role === 'ADMIN' || input.role === 'RESIDENT' ? null : input.departmentId!;
    await this.assertDepartment(departmentId);
    const updated: UserDoc = { ...user, role: input.role, departmentId };
    await ref.update({ role: input.role, departmentId });
    await this.syncClaims(input.uid, updated);
    await writeLog('INFO', 'admin.setUserRole', `${actor.name} set ${user.email} to ${input.role}`, actor.uid);
    return { ok: true as const };
  }

  /** BR-15/16: deactivation disables sign-in, revokes sessions and blocks every callable (loadActor). */
  async setActive(uid: string, active: boolean, actor: Actor) {
    if (uid === actor.uid) throw denied('You cannot deactivate your own account');
    const { ref, user } = await this.load(uid);
    await ref.update({ isActive: active });
    await auth.updateUser(uid, { disabled: !active });
    await this.syncClaims(uid, { ...user, isActive: active });
    await writeLog('INFO', 'admin.setUserActive', `${actor.name} ${active ? 'reactivated' : 'deactivated'} ${user.email}`, actor.uid);
    return { ok: true as const };
  }
}
