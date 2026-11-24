import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { deleteImage, writeContent } from './local-admin/storage.mjs';

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'portfolio-pending-media-'));
  const content = path.join(root, 'src/data/content');
  mkdirSync(content, { recursive: true });
  writeFileSync(path.join(content, 'categories.json'), JSON.stringify([{ slug: 'product', title: 'Product', kind: 'grid', order: 0 }]));
  writeFileSync(path.join(content, 'site.json'), JSON.stringify({ homeCovers: [] }));
  writeFileSync(path.join(content, 'about.json'), JSON.stringify({ facts: [], biographyJa: [], biographyZh: [] }));
  writeFileSync(path.join(content, 'contact.json'), JSON.stringify({ instagram: '', email: '', wechat: '' }));
  mkdirSync(path.join(root, 'public'), { recursive: true });
  return root;
}

for (const [label, upload, prune] of [
  ['GIF', (storage, root) => storage.saveImage(root, { group: 'works/product', filename: 'draft.gif', mimeType: 'image/gif', data: Buffer.from('GIF89a-draft').toString('base64') }), (storage, root) => storage.pruneOrphanImages(root), 'images/works/product/draft.gif'],
  ['MP4', (storage, root) => storage.saveVideo(root, { category: 'product', filename: 'draft.mp4', mimeType: 'video/mp4', buffer: Buffer.from('mp4-draft') }), (storage, root) => storage.pruneOrphanVideos(root), 'videos/works/product/draft.mp4'],
]) {
  test(`unsaved ${label} upload survives cleanup after a storage-module restart`, async () => {
    const root = fixture();
    try {
      const storageUrl = pathToFileURL(path.resolve('scripts/local-admin/storage.mjs')).href;
      const firstProcess = await import(`${storageUrl}?before-restart`);
      const relativePath = upload(firstProcess, root);
      const restartedProcess = await import(`${storageUrl}?after-restart`);
      if (label === 'GIF') assert.throws(() => deleteImage(root, relativePath), /still used|edit history/i);
      prune(restartedProcess, root);
      const file = path.join(root, 'public', ...relativePath.split('/'));
      assert.equal(existsSync(file), true, 'uploaded draft media must remain available after cleanup');
      assert.equal(readFileSync(file).toString(), label === 'GIF' ? 'GIF89a-draft' : 'mp4-draft');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('saving a work transfers pending protection to its saved reference', async () => {
  const root = fixture();
  try {
    const storage = await import(pathToFileURL(path.resolve('scripts/local-admin/storage.mjs')).href);
    const imagePath = storage.saveImage(root, { group: 'works/product', filename: 'saved.webp', mimeType: 'image/webp', data: Buffer.from('saved-image').toString('base64') });
    const work = { slug: 'sample', category: 'product', title: 'Sample', type: 'Object', order: 0, template: 'articleReading', sections: [{ kind: 'imageWithCaption', image: { src: imagePath } }] };
    writeContent(root, 'work', ['product', 'sample'], work);
    assert.deepEqual(JSON.parse(readFileSync(path.join(root, '.local-admin/pending-media.json'), 'utf8')), []);
    assert.equal(existsSync(path.join(root, 'public', ...imagePath.split('/'))), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('orphan media without a saved, historical, or pending reference is still pruned', async () => {
  const root = fixture();
  try {
    const storage = await import(pathToFileURL(path.resolve('scripts/local-admin/storage.mjs')).href);
    const filePath = path.join(root, 'public/images/works/product/orphan.gif');
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, 'orphan');
    storage.pruneOrphanImages(root);
    assert.equal(existsSync(filePath), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
