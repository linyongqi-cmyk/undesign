import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPhotographyImageIndex } from '../src/lib/content/photography-lightbox.js';

test('photography lightbox navigation wraps in both directions and stays put for one image', () => {
  assert.equal(nextPhotographyImageIndex(0, -1, 3), 2);
  assert.equal(nextPhotographyImageIndex(2, 1, 3), 0);
  assert.equal(nextPhotographyImageIndex(0, 1, 1), 0);
  assert.equal(nextPhotographyImageIndex(0, 1, 0), 0);
});
