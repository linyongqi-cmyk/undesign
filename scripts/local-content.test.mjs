import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../src/data/content/', import.meta.url);
const read = (relativePath) => JSON.parse(readFileSync(new URL(relativePath, root), 'utf8'));

test('migrated JSON preserves all existing page content and work ordering', () => {
  const site = read('site.json');
  const about = read('about.json');
  const contact = read('contact.json');
  const categories = read('categories.json');
  const work = read('works/product/lou.json');
  const categorySlugs = categories.map(({ slug }) => slug);

  assert.equal(site.homeCovers.length, 6);
  assert.equal(site.homeCovers[1].position, '50.00% 100.00%');
  assert.equal(about.biographyZh.length, 6);
  assert.equal(contact.email, 'blue.ighone@gmail.com');
  assert.deepEqual(categorySlugs, ['product', 'research', 'visual', 'photography']);
  assert.equal(work.title, '樓');
  assert.equal(work.image, 'images/works/product/img-8029-post.webp');
  assert.equal(work.template, 'splitDetail');
});
