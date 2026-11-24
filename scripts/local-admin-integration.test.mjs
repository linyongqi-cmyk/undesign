import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLocalAdminMiddleware } from './local-admin-integration.mjs';

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'portfolio-admin-api-'));
  const content = path.join(root, 'src/data/content');
  for (const category of ['product', 'visual', 'research']) mkdirSync(path.join(content, `works/${category}`), { recursive: true });
  writeFileSync(path.join(content, 'categories.json'), JSON.stringify([
    { slug: 'product', title: 'Product', kind: 'grid', order: 0 },
    { slug: 'visual', title: 'Visual', kind: 'grid', order: 1 },
    { slug: 'research', title: 'Research', kind: 'research', order: 2 },
  ]));
  writeFileSync(path.join(content, 'site.json'), JSON.stringify({ siteTitle: 'Test', description: '', homeCovers: [{ src: 'images/home/a.webp', alt: '', scale: 1, position: 'center' }], rotationSeconds: 3 }));
  writeFileSync(path.join(content, 'about.json'), JSON.stringify({ facts: [], biographyJa: [], biographyZh: [] }));
  writeFileSync(path.join(content, 'contact.json'), JSON.stringify({ instagram: 'test', email: 'test@example.com', wechat: 'test' }));
  return root;
}

async function withServer(root, run) {
  const middleware = createLocalAdminMiddleware(root, null);
  const base = 'http://127.0.0.1:4321';
  const request = async (url, options = {}) => {
    const body = options.body || '';
    const req = Readable.from(body ? [Buffer.from(body)] : []);
    req.url = url;
    req.method = options.method || 'GET';
    req.headers = { host: '127.0.0.1:4321', origin: base, ...(options.headers || {}) };
    req.socket = { remoteAddress: '127.0.0.1' };
    return new Promise(async (resolve, reject) => {
      const res = { writeHead(status) { this.status = status; }, end(content = '') { resolve({ status: this.status, json: async () => JSON.parse(content.toString() || '{}') }); } };
      try { await middleware(req, res, () => res.end('not found')); } catch (error) { reject(error); }
    });
  };
  await run(request);
}

test('stale tab receives a conflict and cannot overwrite a newer category record', async () => {
  const root = fixture();
  try {
    await withServer(root, async (request) => {
      const initial = await (await request('/__local-admin/api/content')).json();
      const categoriesA = [{ slug: 'product', title: 'Furniture', kind: 'grid', order: 0 }];
      const saved = await request('/__local-admin/api/content/categories', { method: 'PUT', headers: { 'content-type': 'application/json', 'if-match': initial.versions.categories }, body: JSON.stringify(categoriesA) });
      assert.equal(saved.status, 200);
      const categoriesB = [{ slug: 'product', title: 'Products (stale)', kind: 'grid', order: 0 }];
      const stale = await request('/__local-admin/api/content/categories', { method: 'PUT', headers: { 'content-type': 'application/json', 'if-match': initial.versions.categories }, body: JSON.stringify(categoriesB) });
      const conflict = await stale.json();
      assert.equal(stale.status, 409);
      assert.equal(conflict.conflict, true);
      assert.equal(conflict.record, 'categories');
      assert.equal(JSON.parse(readFileSync(path.join(root, 'src/data/content/categories.json'), 'utf8'))[0].title, 'Furniture');
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('batch lock rejects writes from another tab and commits only with its token', async () => {
  const root = fixture();
  try {
    await withServer(root, async (request) => {
      const initial = await (await request('/__local-admin/api/content')).json();
      const started = await (await request('/__local-admin/api/batch/begin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json();
      const otherTab = await request('/__local-admin/api/content/categories', { method: 'PUT', headers: { 'content-type': 'application/json', 'if-match': initial.versions.categories }, body: JSON.stringify([{ slug: 'product', title: 'Other tab', kind: 'grid', order: 0 }]) });
      assert.equal(otherTab.status, 409);
      const allowed = await request('/__local-admin/api/content/categories', { method: 'PUT', headers: { 'content-type': 'application/json', 'if-match': initial.versions.categories, 'x-content-batch': started.id }, body: JSON.stringify([{ slug: 'product', title: 'Batch tab', kind: 'grid', order: 0 }]) });
      assert.equal(allowed.status, 200);
      const committed = await request('/__local-admin/api/batch/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: started.id }) });
      assert.equal(committed.status, 200);
      assert.equal(JSON.parse(readFileSync(path.join(root, 'src/data/content/categories.json'), 'utf8'))[0].title, 'Batch tab');
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('move endpoint rejects stale reference records before rewriting them', async () => {
  const root = fixture();
  const works = path.join(root, 'src/data/content/works');
  const source = { slug: 'lamp', category: 'product', title: 'Lamp', type: '', order: 0, sections: [] };
  const reference = { slug: 'album', category: 'visual', title: 'Album', type: '', order: 0, sections: [{ kind: 'internalLink', category: 'product', workSlug: 'lamp', text: 'Lamp' }] };
  writeFileSync(path.join(works, 'product/lamp.json'), JSON.stringify(source));
  writeFileSync(path.join(works, 'visual/album.json'), JSON.stringify(reference));
  try {
    await withServer(root, async (request) => {
      const initial = await (await request('/__local-admin/api/content')).json();
      const latestReference = { ...reference, title: 'Album edited elsewhere' };
      writeFileSync(path.join(works, 'visual/album.json'), JSON.stringify(latestReference));
      const response = await request('/__local-admin/api/content/move-work/product/research/lamp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'if-match': initial.versions['work/product/lamp'] },
        body: JSON.stringify({ work: { ...source, category: 'research' }, expectedVersions: initial.versions }),
      });
      const body = await response.json();
      assert.equal(response.status, 409);
      assert.equal(body.conflict, true);
      assert.equal(body.record, '作品 visual/album');
      assert.equal(readFileSync(path.join(works, 'product/lamp.json'), 'utf8'), JSON.stringify(source));
      assert.equal(readFileSync(path.join(works, 'visual/album.json'), 'utf8'), JSON.stringify(latestReference));
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('rename endpoint rejects stale reference records before rewriting them', async () => {
  const root = fixture();
  const works = path.join(root, 'src/data/content/works');
  const source = { slug: 'lamp', category: 'product', title: 'Lamp', type: '', order: 0, sections: [] };
  const reference = { slug: 'album', category: 'visual', title: 'Album', type: '', order: 0, sections: [{ kind: 'internalLink', category: 'product', workSlug: 'lamp', text: 'Lamp' }] };
  writeFileSync(path.join(works, 'product/lamp.json'), JSON.stringify(source));
  writeFileSync(path.join(works, 'visual/album.json'), JSON.stringify(reference));
  try {
    await withServer(root, async (request) => {
      const initial = await (await request('/__local-admin/api/content')).json();
      const latestReference = { ...reference, title: 'Album edited elsewhere' };
      writeFileSync(path.join(works, 'visual/album.json'), JSON.stringify(latestReference));
      const response = await request('/__local-admin/api/content/rename-work/product/lamp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'if-match': initial.versions['work/product/lamp'] },
        body: JSON.stringify({ slug: 'new-lamp', expectedVersions: initial.versions }),
      });
      const body = await response.json();
      assert.equal(response.status, 409);
      assert.equal(body.conflict, true);
      assert.equal(body.record, '作品 visual/album');
      assert.equal(readFileSync(path.join(works, 'product/lamp.json'), 'utf8'), JSON.stringify(source));
      assert.equal(readFileSync(path.join(works, 'visual/album.json'), 'utf8'), JSON.stringify(latestReference));
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
