import { createHash, randomBytes } from 'node:crypto';
import { LIMITS, type UserDoc } from '@civiclink/shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { z } from 'zod';
import type { upgradeGuestSchema } from '@civiclink/shared';
import type { Actor } from '../lib/command';
import { DomainError, denied, invalid, notFound, precondition } from '../lib/errors';
import { auth, col, db, ts } from '../lib/firebase';
import { writeLog } from './logService';
import { claimsFor } from './userService';

export const GUEST_NAME = 'Guest resident';
const HOUR = 3600_000;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * FR-39: reporting without an account. The browser signs in anonymously (Firebase Auth) and the
 * server gives that session a guest Resident profile. A guest can later keep everything by adding
 * an email/password or Google sign-in to the same session (same uid), or move their reports into
 * an account they already have with a one-time transfer code.
 */
export class GuestService {
  constructor(private readonly clock: () => number = Date.now) {}

  /** Creates the guest profile for an anonymous session; idempotent. BR-26: limited per network address. */
  async start(actor: Actor) {
    const ref = col.users().doc(actor.uid);
    if ((await ref.get()).exists) return { ok: true as const, created: false };
    const record = await auth.getUser(actor.uid);
    if (record.providerData.length > 0) throw denied('Only a guest session can start as a guest');

    const now = this.clock();
    if (actor.ip) {
      const window = Math.floor(now / HOUR);
      const limitRef = db.collection('rateLimits').doc(`guest-${sha(actor.ip).slice(0, 32)}-${window}`);
      await db.runTransaction(async (tx) => {
        const count = ((await tx.get(limitRef)).data()?.count as number | undefined) ?? 0;
        if (count >= LIMITS.guestSessionsPerIpPerHour) {
          throw new DomainError('resource-exhausted', 'Too many guest sessions from this network. Please create an account or try again later.');
        }
        tx.set(limitRef, { count: count + 1, expiresAt: ts((window + 2) * HOUR) });
      });
    }

    const doc: UserDoc = {
      name: GUEST_NAME, email: '', phone: null, role: 'RESIDENT', departmentId: null, suburb: null,
      isActive: true, isGuest: true, createdAt: ts(now), lastLoginAt: null,
    };
    await auth.setCustomUserClaims(actor.uid, claimsFor(doc));
    await ref.set(doc);
    return { ok: true as const, created: true };
  }

  /**
   * The guest has linked an email/password or Google sign-in to this session in the browser; the
   * profile becomes a normal resident account, and their reports show the new name.
   */
  async upgrade(input: z.infer<typeof upgradeGuestSchema>, actor: Actor) {
    if (!actor.isGuest) throw precondition('This account is already set up');
    const record = await auth.getUser(actor.uid);
    if (!record.email || record.providerData.length === 0) throw invalid('email', 'Add an email and password or a Google sign-in first');
    const ref = col.users().doc(actor.uid);
    const user = (await ref.get()).data() as UserDoc;
    const next: UserDoc = { ...user, name: input.name, email: record.email.toLowerCase(), phone: input.phone ?? null, suburb: input.suburb, isGuest: false };
    await auth.setCustomUserClaims(actor.uid, claimsFor(next));
    await ref.update({ name: next.name, email: next.email, phone: next.phone, suburb: next.suburb, isGuest: false });
    const mine = await col.reports().where('reporterId', '==', actor.uid).get();
    for (let i = 0; i < mine.docs.length; i += 450) {
      const batch = db.batch();
      for (const d of mine.docs.slice(i, i + 450)) batch.update(d.ref, { reporterName: next.name });
      await batch.commit();
    }
    await writeLog('INFO', 'guest.upgrade', `A guest created an account (${mine.size} report(s) kept)`, actor.uid);
    return { ok: true as const };
  }

  /** The guest asks for a one-time code before signing in to an existing account (valid 15 minutes). */
  async startTransfer(actor: Actor) {
    if (!actor.isGuest) throw precondition('Only a guest session can transfer its reports');
    const code = randomBytes(32).toString('base64url');
    const expiresAt = this.clock() + LIMITS.guestTransferMinutes * 60_000;
    await db.collection('guestTransfers').doc(sha(code)).set({ guestUid: actor.uid, expiresAt: ts(expiresAt), usedAt: null });
    return { code, expiresAt };
  }

  /**
   * Signed in to their real account, the resident redeems the code: the guest's reports, follows and
   * photos move to this account, and the guest session is deleted. A code works once.
   */
  async claim(code: string, actor: Actor) {
    if (actor.isGuest) throw precondition('Sign in to your account first');
    const transferRef = db.collection('guestTransfers').doc(sha(code));
    const guestUid = await db.runTransaction(async (tx) => {
      const t = (await tx.get(transferRef)).data() as { guestUid: string; expiresAt: FirebaseFirestore.Timestamp; usedAt: unknown } | undefined;
      if (!t) throw notFound('Transfer code');
      if (t.usedAt) throw precondition('This transfer code has already been used');
      if (t.expiresAt.toMillis() < this.clock()) throw precondition('This transfer code has expired. Start the transfer again.');
      tx.update(transferRef, { usedAt: ts(this.clock()), claimedBy: actor.uid });
      return t.guestUid;
    });
    const guest = (await col.users().doc(guestUid).get()).data() as UserDoc | undefined;
    if (!guest?.isGuest) throw precondition('Those reports are no longer in a guest session');

    const writes: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
    const own = await col.reports().where('reporterId', '==', guestUid).get();
    for (const d of own.docs) writes.push((b) => b.update(d.ref, { reporterId: actor.uid, reporterName: actor.name }));
    const followed = await col.reports().where('followerIds', 'array-contains', guestUid).get();
    for (const d of followed.docs) {
      writes.push((b) => b.update(d.ref, { followerIds: FieldValue.arrayRemove(guestUid) }));
      writes.push((b) => b.update(d.ref, { followerIds: FieldValue.arrayUnion(actor.uid) }));
    }
    for (const d of (await col.photos().where('ownerId', '==', guestUid).get()).docs) writes.push((b) => b.update(d.ref, { ownerId: actor.uid }));
    for (const d of (await col.users().doc(guestUid).collection('notifications').get()).docs) writes.push((b) => b.delete(d.ref));
    for (const d of (await col.users().doc(guestUid).collection('pushTokens').get()).docs) writes.push((b) => b.delete(d.ref));
    writes.push((b) => b.delete(col.users().doc(guestUid)));
    for (let i = 0; i < writes.length; i += 400) {
      const batch = db.batch();
      for (const w of writes.slice(i, i + 400)) w(batch);
      await batch.commit();
    }
    await auth.deleteUser(guestUid).catch(() => {});
    await writeLog('INFO', 'guest.claim', `${actor.name} claimed ${own.size} guest report(s)`, actor.uid);
    return { moved: own.size };
  }
}
