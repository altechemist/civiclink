import { fieldErrors, type Role, type UserDoc } from '@civiclink/shared';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import type { z } from 'zod';
import { col } from './firebase';
import { toHttpsError } from './errors';
import { writeLog } from '../services/logService';

/** The authenticated, active caller as stored in Firestore (source of truth over possibly stale token claims). */
export interface Actor {
  uid: string;
  role: Role;
  name: string;
  departmentId: string | null;
  suburb: string | null;
}

export async function loadActor(uid: string): Promise<Actor> {
  const snap = await col.users().doc(uid).get();
  const user = snap.data() as UserDoc | undefined;
  if (!user) throw new HttpsError('permission-denied', 'Account profile not found');
  if (!user.isActive) throw new HttpsError('permission-denied', 'Account deactivated'); // BR-16
  return { uid, role: user.role, name: user.name, departmentId: user.departmentId ?? null, suburb: user.suburb ?? null };
}

/** The callable protocol serialises `undefined` as `null`; treat top-level nulls as "not provided". */
function dropNulls(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null));
}

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(dropNulls(data));
  if (!result.success) {
    const fields = fieldErrors(result.error);
    throw new HttpsError('invalid-argument', Object.values(fields)[0] ?? 'Invalid input', { fields });
  }
  return result.data;
}

interface CommandOptions<S extends z.ZodType, R> {
  name: string;
  schema: S;
  /**
   * Roles allowed to call. `'public'` allows unauthenticated callers (registration only);
   * `'signed-in'` allows any authenticated caller even without a profile yet (first Google sign-in).
   */
  roles: readonly Role[] | 'public' | 'signed-in';
  handler: (input: z.infer<S>, actor: Actor, request: CallableRequest) => Promise<R>;
}

/**
 * Wraps every state-changing command: authentication → active-account check → role check (NFR-01)
 * → schema validation (NFR-03) → service → error mapping. Unexpected errors are logged (FR-23) and
 * returned as a generic message so internals are not leaked.
 */
export function command<S extends z.ZodType, R>(opts: CommandOptions<S, R>) {
  return onCall(async (request) => {
    try {
      let actor: Actor;
      if (opts.roles === 'public') {
        actor = { uid: request.auth?.uid ?? 'anonymous', role: 'RESIDENT', name: 'Public', departmentId: null, suburb: null };
      } else if (opts.roles === 'signed-in') {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in');
        actor = { uid: request.auth.uid, role: 'RESIDENT', name: String(request.auth.token.name ?? ''), departmentId: null, suburb: null };
      } else {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in');
        actor = await loadActor(request.auth.uid);
        if (!opts.roles.includes(actor.role)) throw new HttpsError('permission-denied', 'Your role cannot do this');
      }
      const input = parse(opts.schema, request.data);
      return await opts.handler(input, actor, request);
    } catch (err) {
      const httpsError = toHttpsError(err);
      if (httpsError.code === 'internal') {
        logger.error(`${opts.name} failed`, err);
        await writeLog('ERROR', opts.name, err instanceof Error ? err.message : String(err), request.auth?.uid).catch(() => {});
      }
      throw httpsError;
    }
  });
}
