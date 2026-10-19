import { photoFileSchema } from '@civiclink/shared';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Client-side BR-02 check; Storage rules enforce the same limits on upload. */
export function checkPhoto(file: File): string | null {
  const r = photoFileSchema.safeParse({ type: file.type, size: file.size });
  return r.success ? null : (r.error.issues[0]?.message ?? 'Invalid photo');
}

/** Uploads photos under `folder` (e.g. reports/{uid}) and returns their Storage paths. */
export async function uploadPhotos(folder: string, files: File[]): Promise<string[]> {
  return Promise.all(
    files.map(async (file) => {
      const path = `${folder}/${crypto.randomUUID()}.${EXT[file.type] ?? 'jpg'}`;
      await uploadBytes(ref(storage, path), file, { contentType: file.type });
      return path;
    }),
  );
}
