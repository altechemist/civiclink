import { ALL_SUBURBS, type AlertDoc, type AlertRecipientDoc } from '@civiclink/shared';
import { collection, collectionGroup, query, where } from 'firebase/firestore';
import { useSession } from '../../auth/AuthProvider';
import { db } from '../../lib/firebase';
import { useLiveQuery, useNow, type WithId } from '../../lib/hooks';

export type FeedAlert = WithId<AlertDoc> & { read: boolean };

/** FR-17 / BR-14: active, unexpired alerts for the resident's suburb or ALL; emergencies pinned first. */
export function useResidentAlerts() {
  const { uid, claims } = useSession();
  const suburb = claims.suburb ?? '';
  const now = useNow(30_000);
  const alerts = useLiveQuery<AlertDoc>(
    query(collection(db, 'alerts'), where('targetSuburbs', 'array-contains-any', [suburb, ALL_SUBURBS])),
    `alerts-${suburb}`,
  );
  const receipts = useLiveQuery<AlertRecipientDoc>(query(collectionGroup(db, 'recipients'), where('uid', '==', uid)), `receipts-${uid}`);
  const readIds = new Set(receipts.data.filter((r) => r.readAt).map((r) => r.alertId));

  const feed: FeedAlert[] = alerts.data
    .filter((a) => a.isActive && a.expiresAt.toMillis() > now)
    .map((a) => ({ ...a, read: readIds.has(a.id) }))
    .sort((a, b) => Number(b.type === 'EMERGENCY') - Number(a.type === 'EMERGENCY') || b.createdAt.toMillis() - a.createdAt.toMillis());

  return { feed, unread: feed.filter((a) => !a.read).length, loading: alerts.loading, error: alerts.error };
}
