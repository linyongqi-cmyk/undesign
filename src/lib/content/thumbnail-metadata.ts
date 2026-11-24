import { imageMetadata } from 'astro/assets/utils';
import { readFile } from 'node:fs/promises';

// Read source dimensions at build time; the browser can reserve the frame before loading.
export async function thumbnailMetadata(src?: string) {
  if (!src) return { width: 1, height: 1 };
  const publicRoot = new URL('../../../public/', import.meta.url);
  const url = new URL(src.replace(/^\/+/, ''), publicRoot);
  if (!url.href.startsWith(publicRoot.href)) return { width: 1, height: 1 };
  try {
    const { width, height } = await imageMetadata(await readFile(url), src);
    return { width, height };
  } catch {
    return { width: 1, height: 1 };
  }
}
