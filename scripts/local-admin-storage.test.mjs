import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseImageUpload, parseVideoUpload, resolveContentFile, writeContent } from './local-admin/storage.mjs';

const root = path.resolve('/tmp/portfolio-admin-fixture');

test('content paths map only to their fixed data files', () => {
  assert.equal(resolveContentFile(root, 'site'), path.join(root, 'src/data/content/site.json'));
  assert.equal(resolveContentFile(root, 'work', ['product', 'lou']), path.join(root, 'src/data/content/works/product/lou.json'));
});

test('content paths reject traversal and unknown sections', () => {
  assert.throws(() => resolveContentFile(root, 'work', ['..', 'secret']), /invalid|allow/i);
  assert.throws(() => resolveContentFile(root, 'secrets', []), /invalid|allow/i);
});

test('image uploads normalize a name into an allowed image folder', () => {
  const result = parseImageUpload({
    group: 'works/product',
    filename: 'Lamp Final.PNG',
    mimeType: 'image/png',
    data: Buffer.from('image-bytes').toString('base64'),
  });
  assert.equal(result.relativePath, 'images/works/product/lamp-final.png');
  assert.equal(result.buffer.toString(), 'image-bytes');
});

test('image uploads reject executable types, bad groups, and oversized files', () => {
  const base = { filename: 'asset.png', mimeType: 'image/png', data: Buffer.from('x').toString('base64') };
  assert.throws(() => parseImageUpload({ ...base, mimeType: 'image/svg+xml' }), /image|format/i);
  assert.throws(() => parseImageUpload({ ...base, group: '../' }), /group|folder/i);
  assert.throws(() => parseImageUpload({ ...base, group: 'home', data: Buffer.alloc(26 * 1024 * 1024).toString('base64') }), /size|large/i);
});

test('video uploads allow common browser video formats but reject mismatched and oversized files', () => {
  const parsed = parseVideoUpload({ category: 'product', filename: 'Study MOV.MOV', mimeType: 'video/quicktime', buffer: Buffer.from('video') });
  assert.equal(parsed.relativePath, 'videos/works/product/study-mov.mov');
  assert.equal(parsed.buffer.toString(), 'video');
  assert.throws(() => parseVideoUpload({ category: 'product', filename: 'clip.mp4', mimeType: 'video/quicktime', buffer: Buffer.from('video') }), /format/i);
  assert.throws(() => parseVideoUpload({ category: 'product', filename: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(201 * 1024 * 1024) }), /200 MB/i);
});

test('category saves accept arrays and invalid saves preserve the previous file', () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'portfolio-admin-'));
  const filePath = path.join(fixture, 'src/data/content/categories.json');
  const sitePath = path.join(fixture, 'src/data/content/site.json');
  const initial = [{ slug: 'product', title: 'Furniture & Product', kind: 'grid', order: 0 }];
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(initial));
  writeFileSync(sitePath, JSON.stringify({ categories: [], homeCovers: [] }));
  writeFileSync(path.join(fixture, 'src/data/content/about.json'), JSON.stringify({ facts: [], biographyJa: [], biographyZh: [] }));
  writeFileSync(path.join(fixture, 'src/data/content/contact.json'), JSON.stringify({ instagram: 'test', email: 'test@example.com', wechat: 'test' }));
  try {
    const updated = [{ slug: 'product', title: 'Products', kind: 'grid', order: 0 }];
    writeContent(fixture, 'categories', [], updated);
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')), updated);
    assert.throws(() => writeContent(fixture, 'categories', [], [{ ...updated[0], slug: '../escape' }]), /invalid/i);
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')), updated);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('work content rejects executable link targets', () => {
  mkdirSync(path.join(root, 'src/data/content'), { recursive: true });
  writeFileSync(path.join(root, 'src/data/content/categories.json'), JSON.stringify([{ slug: 'product', title: 'Products', kind: 'grid', order: 0 }]));
  assert.throws(() => writeContent(root, 'work', ['product', 'lou'], {
    slug: 'lou', category: 'product', title: 'Lou', type: 'Lighting', order: 0,
    template: 'splitDetail', sections: [{ kind: 'link', linkLabel: 'open', linkHref: 'javascript:alert(1)' }],
  }), /link|address|HTTPS/i);
});

test('photography lightbox settings and descriptions validate while legacy string images remain accepted', () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'portfolio-admin-photography-'));
  const filePath = path.join(fixture, 'src/data/content/works/photography/sample.json');
  const imagePath = 'images/works/photography/sample.webp';
  mkdirSync(path.dirname(filePath), { recursive: true });
  mkdirSync(path.join(fixture, 'public/images/works/photography'), { recursive: true });
  mkdirSync(path.join(fixture, 'src/data/content'), { recursive: true });
  writeFileSync(path.join(fixture, 'src/data/content/categories.json'), JSON.stringify([{ slug: 'photography', title: 'Photography', kind: 'masonry', order: 0 }]));
  writeFileSync(path.join(fixture, 'src/data/content/site.json'), JSON.stringify({ homeCovers: [] }));
  writeFileSync(path.join(fixture, 'src/data/content/about.json'), JSON.stringify({ facts: [], biographyJa: [], biographyZh: [] }));
  writeFileSync(path.join(fixture, 'src/data/content/contact.json'), JSON.stringify({ instagram: 'test', email: 'test@example.com', wechat: 'test' }));
  writeFileSync(path.join(fixture, 'public', imagePath), 'test image');
  const work = {
    slug: 'sample', category: 'photography', title: 'Sample', type: 'Photo', order: 0,
    template: 'photographyGallery', photographyLightboxEnabled: true, sections: [],
    gallery: [imagePath, { src: imagePath, photographyDescription: 'Tokyo\n2026' }],
  };
  try {
    writeContent(fixture, 'work', ['photography', 'sample'], work);
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')), work);
    assert.throws(() => writeContent(fixture, 'work', ['photography', 'sample'], { ...work, photographyLightboxEnabled: 'true' }), /lightbox|enabled|disabled/i);
    assert.throws(() => writeContent(fixture, 'work', ['photography', 'sample'], { ...work, gallery: [imagePath, { src: imagePath, photographyDescription: 42 }] }), /photography description.*text/i);
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')), work);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('content rejects non-local image paths and malformed nested blocks without overwriting', () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'portfolio-admin-images-'));
  const filePath = path.join(fixture, 'src/data/content/works/product/lou.json');
  mkdirSync(path.dirname(filePath), { recursive: true });
  mkdirSync(path.join(fixture, 'public/images/works/product'), { recursive: true });
  mkdirSync(path.join(fixture, 'public/images/home'), { recursive: true });
  writeFileSync(path.join(fixture, 'src/data/content/categories.json'), JSON.stringify([{ slug: 'product', title: 'Products', kind: 'grid', order: 0 }]));
  writeFileSync(path.join(fixture, 'src/data/content/site.json'), JSON.stringify({ homeCovers: [] }));
  writeFileSync(path.join(fixture, 'src/data/content/about.json'), JSON.stringify({ facts: [], biographyJa: [], biographyZh: [] }));
  writeFileSync(path.join(fixture, 'src/data/content/contact.json'), JSON.stringify({ instagram: 'test', email: 'test@example.com', wechat: 'test' }));
  writeFileSync(path.join(fixture, 'public/images/works/product/lou.webp'), 'test image');
  writeFileSync(path.join(fixture, 'public/images/home/cover.webp'), 'test image');
  const initial = { slug: 'lou', category: 'product', title: 'Lou', type: 'Lighting', image: 'images/works/product/lou.webp', order: 0, template: 'splitDetail', sections: [] };
  writeFileSync(filePath, JSON.stringify(initial));
  const sitePath = path.join(fixture, 'src/data/content/site.json');
  const site = { siteTitle: 'Test', description: '', homeCovers: [{ src: 'images/home/cover.webp', alt: '', scale: 1, position: 'center' }], rotationSeconds: 6 };
  writeFileSync(sitePath, JSON.stringify(site));
  try {
    assert.throws(() => writeContent(fixture, 'work', ['product', 'lou'], { ...initial, image: '/images/home/missing.webp' }), /local image/i);
    assert.throws(() => writeContent(fixture, 'work', ['product', 'lou'], { ...initial, sections: [{ kind: 'gallery', images: 'not-a-list' }] }), /gallery|image/i);
    assert.throws(() => writeContent(fixture, 'site', [], { ...site, homeCovers: [{ ...site.homeCovers[0], src: '' }] }), /local image/i);
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')), initial);
    assert.deepEqual(JSON.parse(readFileSync(sitePath, 'utf8')), site);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('media compositions accept editable non-image blocks alongside image items', () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'portfolio-admin-groups-'));
  const filePath = path.join(fixture, 'src/data/content/works/product/lou.json');
  mkdirSync(path.dirname(filePath), { recursive: true });
  mkdirSync(path.join(fixture, 'src/data/content'), { recursive: true });
  writeFileSync(path.join(fixture, 'src/data/content/categories.json'), JSON.stringify([{ slug: 'product', title: 'Products', kind: 'grid', order: 0 }]));
  writeFileSync(path.join(fixture, 'src/data/content/site.json'), JSON.stringify({ homeCovers: [] }));
  writeFileSync(path.join(fixture, 'src/data/content/about.json'), JSON.stringify({ facts: [], biographyJa: [], biographyZh: [] }));
  writeFileSync(path.join(fixture, 'src/data/content/contact.json'), JSON.stringify({ instagram: 'test', email: 'test@example.com', wechat: 'test' }));
  const initial = { slug: 'lou', category: 'product', title: 'Lou', type: 'Lighting', order: 0, template: 'splitDetail', leftSections: [], sections: [] };
  writeFileSync(filePath, JSON.stringify(initial));
  try {
    const composition = { kind: 'mediaComposition', columns: [{ items: [
      { kind: 'image', image: { src: '', alt: '' } },
      { kind: 'content', block: { kind: 'paragraph', text: ['An editable grouped paragraph'] } },
      { kind: 'content', block: { kind: 'quote', quote: 'A grouped quote' } },
    ] }] };
    assert.doesNotThrow(() => writeContent(fixture, 'work', ['product', 'lou'], { ...initial, leftSections: [composition] }));
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')).leftSections[0], composition);

    const mobileWork = {
      ...initial,
      leftSections: [
        {
          kind: 'mediaComposition',
          mobile: { layout: 'keep' },
          columns: [
            { items: [{ kind: 'image', image: { src: '', alt: '', mobileCropAspect: 1.5, mobileCropScale: 1.2, mobileCropPosition: '40% 50%' }, mobile: { hidden: true } }] },
            { items: [{ kind: 'image', image: { src: '', alt: '' } }] },
          ],
        },
        { kind: 'sourceCard', text: 'Source', mobile: { hidden: true, displayWidth: 75, align: 'center' } },
      ],
    };
    assert.doesNotThrow(() => writeContent(fixture, 'work', ['product', 'lou'], mobileWork));
    assert.throws(() => writeContent(fixture, 'work', ['product', 'lou'], {
      ...initial,
      leftSections: [{ kind: 'sourceCard', text: 'Source', mobile: { displayWidth: 200 } }],
    }), /10% 至 100%/);
    assert.throws(() => writeContent(fixture, 'work', ['product', 'lou'], {
      ...initial,
      leftSections: [{ kind: 'mediaComposition', mobile: { layout: 'invalid' }, columns: [{ items: [{ kind: 'image', image: { src: '', alt: '' } }] }] }],
    }), /排列方式无效/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
