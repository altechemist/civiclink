import { TransitionError } from '@civiclink/shared';
import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';

/** Business-rule failure raised by services; mapped to an HttpsError at the API boundary. */
export class DomainError extends Error {
  constructor(
    readonly code: Extract<
      FunctionsErrorCode,
      'invalid-argument' | 'failed-precondition' | 'permission-denied' | 'not-found' | 'already-exists' | 'unauthenticated'
    >,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const notFound = (what: string) => new DomainError('not-found', `${what} not found`);
export const denied = (message = 'You do not have permission to do this') => new DomainError('permission-denied', message);
export const precondition = (message: string) => new DomainError('failed-precondition', message);
export const invalid = (field: string, message: string) => new DomainError('invalid-argument', message, { [field]: message });

export function toHttpsError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  if (err instanceof DomainError) return new HttpsError(err.code, err.message, err.details ? { fields: err.details } : undefined);
  if (err instanceof TransitionError) {
    return new HttpsError(err.code === 'actor-not-allowed' ? 'permission-denied' : 'failed-precondition', err.message);
  }
  return new HttpsError('internal', 'Something went wrong. Please try again.');
}
