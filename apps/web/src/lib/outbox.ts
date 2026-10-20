import type { CallableResults, SubmitReportInput } from '@civiclink/shared';
import { useEffect, useState } from 'react';
import { ApiError, call } from './api';

/**
 * FR-27: reports drafted without a connection wait in an on-device outbox (IndexedDB, so compressed
 * photos fit) and are sent automatically when the device is back online. Each entry keeps the
 * clientId it was created with, so a resend after a lost response is stored only once (server side).
 * Entries belong to one account: a different user on the same phone never sends them.
 */
export interface OutboxEntry {
  clientId: string;
  uid: string;
  categoryName: string;
  createdAt: number;
  payload: SubmitReportInput & { clientId: string };
  /** Set when the server refused the report (e.g. category withdrawn); the resident can discard it. */
  error?: string;
}

export interface SentEntry {
  clientId: string;
  categoryName: string;
  result: CallableResults['submitReport'];
}

const DB_NAME = 'civiclink-outbox';
const STORE = 'reports';
const CHANGED = 'civiclink:outbox-changed';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'clientId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open the on-device outbox'));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('Outbox operation failed'));
    });
  } finally {
    db.close();
  }
}

const changed = () => window.dispatchEvent(new Event(CHANGED));

export const newClientId = () => crypto.randomUUID();

export async function queueReport(entry: Omit<OutboxEntry, 'error'>): Promise<void> {
  await run('readwrite', (s) => s.put(entry));
  changed();
}

export async function listOutbox(uid: string): Promise<OutboxEntry[]> {
  const all = await run<OutboxEntry[]>('readonly', (s) => s.getAll() as IDBRequest<OutboxEntry[]>);
  return all.filter((e) => e.uid === uid).sort((a, b) => a.createdAt - b.createdAt);
}

export async function discard(clientId: string): Promise<void> {
  await run('readwrite', (s) => s.delete(clientId));
  changed();
}

/** Codes meaning "try again later" rather than "this report will never be accepted". */
const RETRYABLE = new Set(['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal', 'functions/resource-exhausted', 'functions/unauthenticated', 'unknown']);

let flushing: Promise<SentEntry[]> | null = null;

/**
 * Sends the account's waiting reports in the order they were made. Stops at the first connection
 * problem (the rest wait for the next attempt); a refused report is kept with its error.
 */
export function flushOutbox(uid: string): Promise<SentEntry[]> {
  flushing ??= (async () => {
    const sent: SentEntry[] = [];
    try {
      for (const entry of await listOutbox(uid)) {
        if (entry.error) continue;
        try {
          const result = await call('submitReport', entry.payload);
          await run('readwrite', (s) => s.delete(entry.clientId));
          sent.push({ clientId: entry.clientId, categoryName: entry.categoryName, result });
        } catch (err) {
          const code = err instanceof ApiError ? err.code : 'unknown';
          if (RETRYABLE.has(code)) break;
          await run('readwrite', (s) => s.put({ ...entry, error: (err as Error).message }));
        }
      }
    } finally {
      flushing = null;
      changed();
    }
    return sent;
  })();
  return flushing;
}

/** Live list of this account's waiting reports. */
export function useOutbox(uid: string | null | undefined) {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const load = () => void listOutbox(uid).then((e) => alive && setEntries(e)).catch(() => {});
    load();
    window.addEventListener(CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(CHANGED, load);
    };
  }, [uid]);
  return uid ? entries : [];
}
