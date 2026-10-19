import type { CallableResults } from '@civiclink/shared';
import { FirebaseError } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/** A command failure with an optional per-field message map for forms (NFR-03). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  'functions/unavailable': 'CivicLink is unreachable. Check your connection and try again.',
  'functions/deadline-exceeded': 'The request took too long. Please try again.',
  'functions/internal': 'Something went wrong on our side. Please try again.',
  'functions/unauthenticated': 'Your session has expired. Please sign in again.',
};

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof FirebaseError) {
    const details = (err as FirebaseError & { details?: { fields?: Record<string, string> } }).details;
    return new ApiError(FRIENDLY[err.code] ?? err.message, err.code, details?.fields ?? {});
  }
  return new ApiError(err instanceof Error ? err.message : 'Unexpected error', 'unknown');
}

/** Typed wrapper for the Cloud Functions command API. */
export async function call<K extends keyof CallableResults>(name: K, data: unknown = {}): Promise<CallableResults[K]> {
  try {
    const res = await httpsCallable(functions, name)(data);
    return res.data as CallableResults[K];
  } catch (err) {
    throw toApiError(err);
  }
}
