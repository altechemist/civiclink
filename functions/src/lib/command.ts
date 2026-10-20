import { fieldErrors, type Role, type UserDoc } from '@civiclink/shared';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { z } from 'zod';
import { col } from './firebase';
import { toHttpsError } from './errors';
import { writeLog } from '../services/logService';
import { deliverPushes, withPushScope } from '../services/pushService';

/** The authenticated, active caller as stored in Firestore (source of truth over possibly stale token claims). */
export interface Actor {
  uid: string;
  role: Role;
  name: string;
  departmentId: string | null;
  suburb: string | null;
  /** FR-39: signed in as a guest (anonymous), without an account yet. */
  isGuest: boolean;
  /** Caller's network address, when the transport provides it (guest-session limit, BR-26). */
  ip?: string;
}

export async function loadActor(uid: string): Promise<Actor> {
  const snap = await col.users().doc(uid).get();
  const user = snap.data() as UserDoc | undefined;
  if (!user) throw new HttpsError('permission-denied', 'Account profile not found');
  if (!user.isActive) throw new HttpsError('permission-denied', 'Account deactivated'); // BR-16
  return { uid, role: user.role, name: user.name, departmentId: user.departmentId ?? null, suburb: user.suburb ?? null, isGuest: !!user.isGuest };
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

export interface CommandDefinition<S extends z.ZodType = z.ZodType, R = unknown> {
  name: string;
  schema: S;
  /**
   * Roles allowed to call. `'public'` allows unauthenticated callers (registration only);
   * `'signed-in'` allows any authenticated caller even without a profile yet (first Google sign-in).
   */
  roles: readonly Role[] | 'public' | 'signed-in';
  /** FR-39: set to false for resident commands that need a full account (guests are refused). */
  guests?: boolean;
  handler: (input: z.infer<S>, actor: Actor) => Promise<R>;
}

/** The verified caller, from either transport (callable request or HTTP bearer token). */
export interface Caller {
  uid: string;
  name?: string;
  ip?: string;
}

export function defineCommand<S extends z.ZodType, R>(def: CommandDefinition<S, R>): CommandDefinition<S, R> {
  return def;
}

/**
 * Runs a command independently of transport: authentication → active-account check → role check
 * (NFR-01) → schema validation (NFR-03) → service → error mapping. Unexpected errors are logged
 * (FR-23) and returned as a generic message so internals are not leaked. Throws HttpsError.
 */
export async function execute<S extends z.ZodType, R>(def: CommandDefinition<S, R>, caller: Caller | null, data: unknown): Promise<R> {
  try {
    let actor: Actor;
    if (def.roles === 'public') {
      actor = { uid: caller?.uid ?? 'anonymous', role: 'RESIDENT', name: 'Public', departmentId: null, suburb: null, isGuest: false, ip: caller?.ip };
    } else if (def.roles === 'signed-in') {
      if (!caller) throw new HttpsError('unauthenticated', 'Please sign in');
      actor = { uid: caller.uid, role: 'RESIDENT', name: caller.name ?? '', departmentId: null, suburb: null, isGuest: false, ip: caller.ip };
    } else {
      if (!caller) throw new HttpsError('unauthenticated', 'Please sign in');
      actor = { ...(await loadActor(caller.uid)), ip: caller.ip };
      if (def.guests === false && actor.isGuest) throw new HttpsError('permission-denied', 'Create an account to do this');
      if (!def.roles.includes(actor.role)) throw new HttpsError('permission-denied', 'Your role cannot do this');
    }
    const input = parse(def.schema, data);
    const { result, intents } = await withPushScope(() => def.handler(input, actor));
    // FR-24: push only after the command has committed; best-effort, bounded so it never delays the reply much.
    if (intents.length) await Promise.race([deliverPushes(intents), new Promise((r) => setTimeout(r, 4000))]);
    return result;
  } catch (err) {
    const httpsError = toHttpsError(err);
    if (httpsError.code === 'internal') {
      logger.error(`${def.name} failed`, err);
      await writeLog('ERROR', def.name, err instanceof Error ? err.message : String(err), caller?.uid).catch(() => {});
    }
    throw httpsError;
  }
}

/** Cloud Functions adapter (local emulator, or a Blaze-plan deployment). */
export function command<S extends z.ZodType, R>(def: CommandDefinition<S, R>) {
  return onCall((request) =>
    execute(def, request.auth ? { uid: request.auth.uid, name: request.auth.token.name as string | undefined, ip: request.rawRequest.ip } : null, request.data),
  );
}
