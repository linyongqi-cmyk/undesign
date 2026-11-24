import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beginContentBatch, rollbackContentBatch, validateContentBatch, writeContent } from './local-admin/storage.mjs';

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'portfolio-batch-'));
  const data = path.join(root, 'src/data/content');
  mkdirSync(path.join(data, 'works/product'), { recursive: true });
  mkdirSync(path.join(root, 'public/images/works/product'), { recursive: true });
  writeFileSync(path.join(data, 'categories.json'), JSON.stringify([{ slug: 'product', title: 'Product', kind: 'grid', order: 0 }]));
  writeFileSync(path.join(data, 'site.json'), JSON.stringify({ homeCovers: [] }));
  writeFileSync(path.join(data, 'about.json'), JSON.stringify({ facts: [], biographyJa: [], biographyZh: [] }));
  writeFileSync(path.join(data, 'contact.json'), JSON.stringify({ instagram: '', email: '', wechat: '' }));
  for (const slug of ['one', 'two']) writeFileSync(path.join(data, `works/product/${slug}.json`), JSON.stringify({ slug, category: 'product', title: slug, type: 'Test', order: 0, template: 'articleReading', sections: [] }));
  return { root, data };
}

test('batch validation rejects a later invalid record before any earlier record is written', () => {
  const { root, data } = fixture();
  const beforeOne = readFileSync(path.join(data, 'works/product/one.json'), 'utf8');
  const beforeTwo = readFileSync(path.join(data, 'works/product/two.json'), 'utf8');
  try {
    assert.throws(() => validateContentBatch(root, [
      { section: 'work', segments: ['product', 'one'], value: { slug: 'one', category: 'product', title: 'Updated', type: 'Test', order: 0, template: 'articleReading', sections: [] } },
      { section: 'work', segments: ['product', 'two'], value: { slug: 'two', category: 'product', title: 'two', type: 'Test', order: 0, template: 'articleReading', sections: [{ kind: 'link', linkLabel: 'Bad', linkHref: '/works/product/missing' }] } },
    ]), /two|missing/i);
    assert.equal(readFileSync(path.join(data, 'works/product/one.json'), 'utf8'), beforeOne);
    assert.equal(readFileSync(path.join(data, 'works/product/two.json'), 'utf8'), beforeTwo);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('batch rollback restores content and removes media copied during a failed transaction', () => {
  const { root, data } = fixture();
  const file = path.join(data, 'works/product/one.json');
  try {
    const batch = beginContentBatch(root);
    writeContent(root, 'work', ['product', 'one'], { slug: 'one', category: 'product', title: 'Partially written', type: 'Test', order: 0, template: 'articleReading', sections: [] });
    writeFileSync(path.join(root, 'public/images/works/product/partial.gif'), 'temporary');
    rollbackContentBatch(root, batch.id);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).title, 'one');
    assert.equal(existsSync(path.join(root, 'public/images/works/product/partial.gif')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
