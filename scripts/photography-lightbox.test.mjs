import test from 'node:test';
import assert from 'node:assert/strict';
import { sortPhotographyGalleryVisualOrder } from '../src/lib/content/photography-gallery-layout.js';

test('photography visual ordering sorts by visible top, then left within fixed 2px rows', () => {
  assert.equal(typeof sortPhotographyGalleryVisualOrder, 'function');
  if (typeof sortPhotographyGalleryVisualOrder !== 'function') return;

  const entries = [
    { id: 'lower-right', top: 510, left: 100 },
    { id: 'first-right', top: 0.8, left: 100 },
    { id: 'lower-left', top: 320, left: 0 },
    { id: 'first-left', top: 0, left: 0 },
  ];

  assert.deepEqual(sortPhotographyGalleryVisualOrder(entries), [
    'first-left', 'first-right', 'lower-left', 'lower-right',
  ]);
});

test('photography visual rows use a fixed first-top anchor instead of pairwise tolerance', () => {
  assert.equal(typeof sortPhotographyGalleryVisualOrder, 'function');
  if (typeof sortPhotographyGalleryVisualOrder !== 'function') return;

  const entries = [
    { id: 'row-first-right', top: 0, left: 100 },
    { id: 'next-row-left', top: 3, left: -100 },
    { id: 'row-first-left', top: 1.5, left: 0 },
  ];

  assert.deepEqual(sortPhotographyGalleryVisualOrder(entries), [
    'row-first-left', 'row-first-right', 'next-row-left',
  ]);
});

test('photography visual order keeps duplicate image paths as distinct entries', () => {
  assert.equal(typeof sortPhotographyGalleryVisualOrder, 'function');
  if (typeof sortPhotographyGalleryVisualOrder !== 'function') return;

  const entries = [
    { id: 'same-file-second-use', top: 100, left: 0, src: '/same.webp' },
    { id: 'same-file-first-use', top: 0, left: 0, src: '/same.webp' },
  ];

  assert.deepEqual(sortPhotographyGalleryVisualOrder(entries), [
    'same-file-first-use', 'same-file-second-use',
  ]);
});
