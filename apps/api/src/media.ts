import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { config } from './config.js';

export interface StoredImage {
  id: string;
  objectKey: string;
  width: number;
  height: number;
  remove: () => Promise<void>;
}

/** Só aceita bitmap válido; reencode remove EXIF e outros metadados. */
export async function storeImage(buffer: Buffer): Promise<StoredImage> {
  if (buffer.length > config.maxImageBytes) throw new Error('PHOTO_TOO_LARGE');
  let output: Buffer;
  let width: number;
  let height: number;
  try {
    const input = sharp(buffer, { limitInputPixels: 20_000_000, failOn: 'error' });
    const metadata = await input.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format || '')) throw new Error('INVALID_IMAGE_FORMAT');
    const result = await input.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
    output = result.data;
    width = result.info.width;
    height = result.info.height;
  } catch {
    throw new Error('INVALID_IMAGE_FORMAT');
  }
  await mkdir(config.storageDir, { recursive: true });
  const id = randomUUID();
  const objectKey = `${id}.jpg`;
  const path = join(config.storageDir, objectKey);
  await writeFile(path, output, { flag: 'wx', mode: 0o600 });
  return { id, objectKey, width, height, remove: async () => { await unlink(path).catch(() => {}); } };
}
