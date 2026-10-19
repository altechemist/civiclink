import {
  doc,
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { db, storage } from './firebase';

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

/** Resolves Storage paths to download URLs (access is checked by Storage rules). */
export function useDownloadUrls(paths: string[] | undefined): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  const key = (paths ?? []).join('|');
  useEffect(() => {
    let alive = true;
    Promise.all((paths ?? []).map((p) => getDownloadURL(ref(storage, p)).catch(() => '')))
      .then((u) => alive && setUrls(u.filter(Boolean)));
    return () => {
      alive = false;
    };
    // Dependencies are intentionally the caller-supplied key, not the (unstable) query object.
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
