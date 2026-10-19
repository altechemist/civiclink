import type { SystemLogDoc } from '@civiclink/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { col } from '../lib/firebase';

/** FR-23: append-only operational / audit log shown to administrators. */
export async function writeLog(level: SystemLogDoc['level'], source: string, message: string, actorId?: string | null) {
  await col.systemLogs().add({ level, source, message, actorId: actorId ?? null, createdAt: FieldValue.serverTimestamp() });
}
