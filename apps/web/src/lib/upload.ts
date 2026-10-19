import { LIMITS, photoFileSchema, type PhotoInput } from '@civiclink/shared';

/** Client-side BR-02 check of a picked file; the server re-checks size and real type. */
export function checkPhoto(file: File): string | null {
  const r = photoFileSchema.safeParse({ type: file.type, size: file.size });
  return r.success ? null : (r.error.issues[0]?.message ?? 'Invalid photo');
}

async function toJpeg(bitmap: ImageBitmap, maxPixels: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, maxPixels / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Compresses a photo until it fits the stored limit (≤ 700 KB, ADR-0006): small files are kept as
 * they are; larger ones are re-encoded as JPEG at ≤ 1280 px, lowering quality/size if needed.
 */
export async function compressPhoto(file: File): Promise<Blob> {
  if (file.size <= LIMITS.storedPhotoBytesMax && file.size < 400_000) return file;
  const bitmap = await createImageBitmap(file);
  for (const [px, q] of [
    [LIMITS.photoMaxPixels, 0.8],
    [LIMITS.photoMaxPixels, 0.65],
    [1024, 0.6],
    [800, 0.55],
  ] as const) {
    const blob = await toJpeg(bitmap, px, q);
    if (blob && blob.size <= LIMITS.storedPhotoBytesMax) return blob;
  }
  throw new Error('This photo could not be made small enough. Try another photo.');
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Compresses and encodes photos for a command request; the server stores them as binary documents. */
export async function toPhotoInputs(files: File[]): Promise<PhotoInput[]> {
  return Promise.all(
    files.map(async (file) => {
      const blob = await compressPhoto(file);
      return { contentType: (blob.type || file.type) as PhotoInput['contentType'], data: await toBase64(blob) };
    }),
  );
}
