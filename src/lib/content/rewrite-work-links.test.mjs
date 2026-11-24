import test from 'node:test';
import assert from 'node:assert/strict';
import { hasWorkLink, rewriteWorkLinks } from './rewrite-work-links.js';

test('moving a work rewrites nested structured and URL links to its new category', () => {
  const record = { sections: [{ kind: 'componentGroup', items: [
    { kind: 'internalLink', text: 'Target', category: 'product', workSlug: 'lamp' },
    { kind: 'link', linkLabel: 'Open', linkHref: '/works/product/lamp?from=detail#research-lamp' },
  ] }] };
  rewriteWorkLinks(record, 'product', 'lamp', 'lamp', 'research');
  assert.equal(record.sections[0].items[0].category, 'research');
  assert.equal(record.sections[0].items[0].workSlug, 'lamp');
  assert.equal(record.sections[0].items[1].linkHref, '/works/research/?from=detail#research-lamp');
});

test('moving a work preserves an unrelated URL fragment and query', () => {
  const record = { kind: 'link', linkHref: '/works/research/?mode=full#research-lamp' };
  rewriteWorkLinks(record, 'research', 'lamp', 'lamp', 'visual');
  assert.equal(record.linkHref, '/works/visual/lamp/?mode=full');
});

test('reference detection recognizes standalone and Research Log URL links', () => {
  assert.equal(hasWorkLink({ kind: 'link', linkHref: '/works/product/lamp/?view=full' }, 'product', 'lamp'), true);
  assert.equal(hasWorkLink({ kind: 'link', linkHref: '/works/research/?view=full#research-lamp' }, 'research', 'lamp'), true);
  assert.equal(hasWorkLink({ kind: 'link', linkHref: '/works/product/other/' }, 'product', 'lamp'), false);
});
