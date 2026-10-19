import type { PhotoDoc } from '@civiclink/shared';
import {
  doc,
  getDoc,
  onSnapshot,
  type Bytes,
  type DocumentData,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';

export type WithId<T> = T & { id: string };

export interface LiveState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

/**
 * Real-time query subscription (Firestore listener). `key` must change whenever the query changes;
 * pass `null` as the query to stay idle (e.g. while auth is loading).
 */
export function useLiveQuery<T>(q: Query<DocumentData> | null, key: string): LiveState<WithId<T>[]> {
  const [state, setState] = useState<LiveState<WithId<T>[]>>({ data: [], loading: true, error: null });
  useEffect(() => {
    if (!q) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })), loading: false, error: null }),
      (error) => setState({ data: [], loading: false, error }),
    );
    // Dependencies are intentionally the caller-supplied key, not the (unstable) query object.
  }, [key]);
  return state;
}

export function useLiveDoc<T>(path: string | null): LiveState<WithId<T> | null> {
  const [state, setState] = useState<LiveState<WithId<T> | null>>({ data: null, loading: true, error: null });
  useEffect(() => {
    if (!path) return;
    setState({ data: null, loading: true, error: null });
    const r = doc(db, path) as DocumentReference<DocumentData>;
    return onSnapshot(
      r,
      (snap) => setState({ data: snap.exists() ? { id: snap.id, ...(snap.data() as T) } : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }),
    );
  }, [path]);
  return state;
}

/** Loads photo documents (binary, ADR-0006) as object URLs; access is checked by Security Rules. */
export function usePhotoUrls(ids: string[] | undefined): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  const key = (ids ?? []).join('|');
  useEffect(() => {
    let alive = true;
    const created: string[] = [];
    Promise.all(
      (ids ?? []).map(async (id) => {
        const snap = await getDoc(doc(db, 'photos', id)).catch(() => null);
        const data = snap?.data() as PhotoDoc<Bytes> | undefined;
        if (!data) return '';
        const url = URL.createObjectURL(new Blob([data.data.toUint8Array() as BlobPart], { type: data.contentType }));
        created.push(url);
        return url;
      }),
    ).then((u) => alive && setUrls(u.filter(Boolean)));
    return () => {
      alive = false;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
    // Dependencies are intentionally the caller-supplied key, not the (unstable) id array.
  }, [key]);
  return urls;
}

/** Re-renders every `ms` so relative times stay fresh. */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
