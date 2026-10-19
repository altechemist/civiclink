import { LIMITS, photoFileSchema } from '@civiclink/shared';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Client-side BR-02 check; Storage rules enforce the same limits on upload. */
export function checkPhoto(file: File): string | null {
  const r = photoFileSchema.safeParse({ type: file.type, size: file.size });
  return r.success ? null : (r.error.issues[0]?.message ?? 'Invalid photo');
}

/**
 * Downscales large photos to at most LIMITS.photoMaxPixels on the long edge (JPEG, quality 0.82)
 * so uploads stay small on prepaid data. Small images and failures fall back to the original file.
 */
export async function compressPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, LIMITS.photoMaxPixels / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 600_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Uploads (compressed) photos under `folder` (e.g. reports/{uid}) and returns their Storage paths. */
export async function uploadPhotos(folder: string, files: File[]): Promise<string[]> {
  return Promise.all(
    files.map(async (file) => {
      const data = await compressPhoto(file);
      const type = data.type || file.type;
      const path = `${folder}/${crypto.randomUUID()}.${EXT[type] ?? 'jpg'}`;
      await uploadBytes(ref(storage, path), data, { contentType: type });
      return path;
    }),
  );
}
