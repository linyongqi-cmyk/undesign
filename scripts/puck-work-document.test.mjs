import test from 'node:test';
import assert from 'node:assert/strict';
import { puckDocumentToWork, workToPuckDocument } from '../src/lib/admin/puck-work-document.js';

test('mixed media composition survives Puck save and reload conversion', () => {
  const work = {
    slug: 'layout-check', category: 'product', title: 'Layout check', type: 'Test', order: 99,
    template: 'splitDetail', sections: [], leftSections: [{ kind: 'mediaComposition', columns: [
      { items: [{ kind: 'imageCarousel', images: [{ src: 'images/works/product/a.webp', alt: 'A' }] }, { kind: 'content', block: { kind: 'paragraph', text: ['A whole editable paragraph'] } }] },
      { items: [{ kind: 'content', block: { kind: 'quote', quote: 'A quote' } }, { kind: 'content', block: { kind: 'videoEmbed', url: 'https://youtu.be/abcdefghijk', caption: 'Clip' } }] },
    ] }],
  };
  const converted = puckDocumentToWork(workToPuckDocument(work), work);
  const expected = structuredClone(work.leftSections[0]);
  expected.columns[0].items[0].caption = '';
  expected.columns[0].items[0].images[0].caption = '';
  assert.deepEqual(converted.leftSections[0], expected);
});

test('new media blocks map into Puck blocks and round trip', () => {
  const work = {
    slug: 'layout-check', category: 'product', title: 'Layout check', type: 'Test', order: 99,
    template: 'splitDetail', leftSections: [], sections: [
      { kind: 'videoEmbed', url: 'https://www.youtube.com/watch?v=abcdefghijk', caption: 'Movie' },
      { kind: 'wideMedia', items: [{ src: 'images/works/product/a.webp', alt: 'A' }], caption: 'Wide group' },
    ],
  };
  const converted = puckDocumentToWork(workToPuckDocument(work), work);
  assert.deepEqual(converted.sections, work.sections);
});

test('photography lightbox settings and repeated-image descriptions survive Puck round trips', () => {
  const work = {
    slug: 'photo-check', category: 'photography', title: 'Photo check', type: 'Test', order: 1,
    template: 'photographyGallery', photographyLightboxEnabled: true, sections: [],
    gallery: [
      { src: 'images/works/photography/same.webp', photographyDescription: 'First view\nMorning' },
      { src: 'images/works/photography/same.webp', photographyDescription: 'Second view' },
    ],
  };

  const document = workToPuckDocument(work);
  const converted = puckDocumentToWork(document, work);

  assert.equal(document.root.props.photographyLightboxEnabled, true);
  assert.equal(converted.photographyLightboxEnabled, true);
  assert.deepEqual(converted.gallery, work.gallery);
});

test('legacy string photography images default lightbox off and retain the toggle through template changes', () => {
  const work = {
    slug: 'photo-check', category: 'photography', title: 'Photo check', type: 'Test', order: 1,
    template: 'photographyGallery', sections: [], gallery: ['images/works/photography/legacy.webp'],
  };

  const document = workToPuckDocument(work);
  assert.equal(document.root.props.photographyLightboxEnabled, false);
  assert.equal(document.root.props.gallery[0].src, work.gallery[0]);
  const switchedDocument = { ...document, root: { ...document.root, props: { ...document.root.props, template: 'articleReading' } } };
  const converted = puckDocumentToWork(switchedDocument, work);

  assert.equal(converted.photographyLightboxEnabled, false);
  assert.equal(converted.gallery[0].src, work.gallery[0]);
});

test('mobile overrides and mobile crop settings survive Puck round trips', () => {
  const work = {
    slug: 'mobile-check', category: 'product', title: 'Mobile check', type: 'Test', order: 2,
    template: 'splitDetail',
    leftSections: [
      {
        kind: 'mediaComposition',
        mobile: { layout: 'keep' },
        columns: [
          { items: [{ kind: 'image', image: { src: 'images/works/product/a.webp', alt: '', caption: '', mobileCropAspect: 1, mobileCropScale: 1.5, mobileCropPosition: '30% 50%' }, mobile: { hidden: true } }] },
          { items: [{ kind: 'image', image: { src: 'images/works/product/b.webp', alt: '', caption: '' } }] },
        ],
      },
      { kind: 'sourceCard', text: 'Source note', caption: '', mobile: { hidden: true, displayWidth: 80, align: 'center' } },
    ],
    sections: [
      { kind: 'paragraph', text: ['Hello'], mobile: { displayWidth: 75, align: 'right' } },
    ],
  };

  const converted = puckDocumentToWork(workToPuckDocument(work), work);
  assert.deepEqual(converted.leftSections, work.leftSections);
  assert.deepEqual(converted.sections, work.sections);
});
