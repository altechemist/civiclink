import { LIMITS, sniffImageType, type PhotoDoc, type PhotoInput } from '@civiclink/shared';
import type { Transaction } from 'firebase-admin/firestore';
import { invalid } from '../lib/errors';
import { col, ts } from '../lib/firebase';

export interface DecodedPhoto {
  contentType: string;
  bytes: Buffer;
}

/**
 * BR-02 server-side photo checks (ADR-0006): base64 is decoded, the stored size limit is enforced and
 * the declared type must match the real type detected from the file's magic bytes, so renamed or
 * non-image files (e.g. SVG/HTML with scripts) are refused.
 */
export function decodePhotos(inputs: PhotoInput[], field: string): DecodedPhoto[] {
  return inputs.map((p, i) => {
    const bytes = Buffer.from(p.data, 'base64');
    if (bytes.length === 0 || bytes.length > LIMITS.storedPhotoBytesMax) throw invalid(field, `Photo ${i + 1} is too large after compression`);
    const real = sniffImageType(bytes);
    if (!real || real !== p.contentType) throw invalid(field, `Photo ${i + 1} is not a valid ${p.contentType.replace('image/', '').toUpperCase()} image`);
    return { contentType: real, bytes };
  });
}

/** Writes photos as binary documents inside the caller's transaction; returns their ids. */
export function writePhotos(
  tx: Transaction,
  photos: DecodedPhoto[],
  meta: { reportId: string; ownerId: string; kind: PhotoDoc['kind'] },
  now: number,
): string[] {
  return photos.map((p) => {
    const ref = col.photos().doc();
    const doc: PhotoDoc<Buffer> = { ...meta, contentType: p.contentType, size: p.bytes.length, data: p.bytes, createdAt: ts(now) };
    tx.set(ref, doc);
    return ref.id;
  });
}
