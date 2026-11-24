import test from 'node:test';
import assert from 'node:assert/strict';
import { photographyGallery2Sections } from './photography-gallery2.js';

test('saved gallery images keep their exact right-column order', () => {
  const saved = [
    { kind: 'paragraph', text: ['before'] },
    { kind: 'imageWithCaption', image: { src: 'images/a.webp', caption: 'A', cropScale: 1.5 } },
    { kind: 'paragraph', text: ['after'] },
  ];
  assert.deepEqual(photographyGallery2Sections({ template: 'photographyGallery2', gallery: ['images/legacy.webp'], photographyGallery2Sections: saved }), saved);
});

test('legacy gallery images precede right-column text and preserve image details', () => {
  const gallery = ['images/legacy.webp', { src: 'images/crop.webp', cropAspect: 1.4, caption: 'Caption', linkLabel: { text: 'Open', href: 'https://example.com', newTab: true } }];
  const result = photographyGallery2Sections({ template: 'photographyGallery2', gallery, photographyGallery2Sections: [{ kind: 'paragraph', text: ['legacy right text'] }] });
  assert.deepEqual(result, [
    { kind: 'imageWithCaption', image: { src: 'images/legacy.webp', alt: '', caption: '' } },
    { kind: 'imageWithCaption', image: gallery[1] },
    { kind: 'paragraph', text: ['legacy right text'] },
  ]);
});

test('empty legacy gallery stays empty and ordinary templates do not synthesize images', () => {
  assert.deepEqual(photographyGallery2Sections({ template: 'photographyGallery2', gallery: [], photographyGallery2Sections: [] }), []);
  assert.deepEqual(photographyGallery2Sections({ template: 'articleReading', gallery: ['images/legacy.webp'] }), []);
});
