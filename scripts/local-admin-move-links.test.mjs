import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contentRecordVersion, moveWorkRecord, removeWork, renameWorkRecord } from './local-admin/storage.mjs';

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'portfolio-work-links-'));
  const data = path.join(root, 'src/data/content');
  mkdirSync(path.join(data, 'works/product'), { recursive: true });
  mkdirSync(path.join(data, 'works/visual'), { recursive: true });
  mkdirSync(path.join(data, 'works/research'), { recursive: true });
  writeFileSync(path.join(data, 'categories.json'), JSON.stringify([
    { slug: 'product', title: 'Product', kind: 'grid', order: 0 },
    { slug: 'visual', title: 'Visual', kind: 'grid', order: 1 },
    { slug: 'research', title: 'Research', kind: 'research', order: 2 },
  ]));
  writeFileSync(path.join(data, 'site.json'), JSON.stringify({ homeCovers: [] }));
  writeFileSync(path.join(data, 'about.json'), JSON.stringify({ facts: [], biographyJa: [], biographyZh: [] }));
  writeFileSync(path.join(data, 'contact.json'), JSON.stringify({ instagram: '', email: '', wechat: '' }));
  return { root, data };
}
function work(slug, category, sections = []) { return { slug, category, title: slug, type: 'Test', order: 0, template: 'articleReading', sections }; }

 test('moving a work rewrites references before the source disappears', () => {
  const { root, data } = fixture();
  const source = path.join(data, 'works/product/lamp.json');
  const ref = path.join(data, 'works/visual/album.json');
  writeFileSync(source, JSON.stringify(work('lamp', 'product')));
  writeFileSync(ref, JSON.stringify(work('album', 'visual', [{ kind: 'componentGroup', items: [
    { kind: 'internalLink', text: 'Lamp', category: 'product', workSlug: 'lamp' },
    { kind: 'link', linkLabel: 'Lamp page', linkHref: '/works/product/lamp?view=full#research-lamp' },
  ] }])));
  try {
    moveWorkRecord(root, 'product', 'research', 'lamp');
    const updated = JSON.parse(readFileSync(ref, 'utf8')).sections[0].items;
    assert.equal(existsSync(source), false);
    assert.equal(existsSync(path.join(data, 'works/research/lamp.json')), true);
    assert.equal(updated[0].category, 'research');
    assert.equal(updated[0].workSlug, 'lamp');
    assert.equal(updated[1].linkHref, '/works/research/?view=full#research-lamp');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('moving a referenced work to trash is blocked and names the referencing work', () => {
  const { root, data } = fixture();
  writeFileSync(path.join(data, 'works/product/lamp.json'), JSON.stringify(work('lamp', 'product')));
  writeFileSync(path.join(data, 'works/visual/album.json'), JSON.stringify(work('album', 'visual', [
    { kind: 'internalLink', text: 'Lamp', category: 'product', workSlug: 'lamp' },
    { kind: 'link', linkLabel: 'Lamp page', linkHref: '/works/product/lamp/?from=album' },
  ])));
  try {
    assert.throws(() => removeWork(root, 'product', 'lamp'), /album|visual/i);
    assert.equal(existsSync(path.join(data, 'works/product/lamp.json')), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('moving a work refuses to rewrite a reference changed by another tab', () => {
  const { root, data } = fixture();
  const source = path.join(data, 'works/product/lamp.json');
  const reference = path.join(data, 'works/visual/album.json');
  writeFileSync(source, JSON.stringify(work('lamp', 'product')));
  writeFileSync(reference, JSON.stringify(work('album', 'visual', [
    { kind: 'internalLink', text: 'Lamp', category: 'product', workSlug: 'lamp' },
  ])));
  const expected = contentRecordVersion(root, 'work', ['visual', 'album']);
  try {
    const latest = JSON.parse(readFileSync(reference, 'utf8'));
    latest.title = 'Newer edit from another tab';
    writeFileSync(reference, JSON.stringify(latest));
    assert.throws(() => moveWorkRecord(root, 'product', 'research', 'lamp', undefined, { 'work/visual/album': expected }), (error) => error.status === 409);
    assert.equal(existsSync(source), true);
    assert.equal(existsSync(path.join(data, 'works/research/lamp.json')), false);
    assert.equal(JSON.parse(readFileSync(reference, 'utf8')).title, 'Newer edit from another tab');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('renaming a work refuses to rewrite a reference changed by another tab', () => {
  const { root, data } = fixture();
  const source = path.join(data, 'works/product/lamp.json');
  const reference = path.join(data, 'works/visual/album.json');
  writeFileSync(source, JSON.stringify(work('lamp', 'product')));
  writeFileSync(reference, JSON.stringify(work('album', 'visual', [
    { kind: 'internalLink', text: 'Lamp', category: 'product', workSlug: 'lamp' },
  ])));
  const expected = contentRecordVersion(root, 'work', ['visual', 'album']);
  try {
    const latest = JSON.parse(readFileSync(reference, 'utf8'));
    latest.title = 'Newer edit from another tab';
    writeFileSync(reference, JSON.stringify(latest));
    assert.throws(() => renameWorkRecord(root, 'product', 'lamp', 'new-lamp', { 'work/visual/album': expected }), (error) => error.status === 409);
    assert.equal(existsSync(source), true);
    assert.equal(existsSync(path.join(data, 'works/product/new-lamp.json')), false);
    assert.equal(JSON.parse(readFileSync(reference, 'utf8')).title, 'Newer edit from another tab');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
