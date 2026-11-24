import test from 'node:test';
import assert from 'node:assert/strict';
import { switchPuckTemplate } from './template-transition.js';

const image = (id, props) => ({ type: 'ImageBlock', props: { id, ...props } });

test('switching to split detail keeps body text on the right and media on the left', () => {
  const document = { root: { props: { template: 'articleReading', gallery: ['images/old.webp'] } }, content: [
    { type: 'ParagraphBlock', props: { id: 'paragraph-1', text: 'Description' } },
    image('image-1', { src: 'images/body.webp', caption: 'Body image' }),
  ], zones: {} };
  const next = switchPuckTemplate(document, 'splitDetail');
  assert.equal(next.root.props.template, 'splitDetail');
  assert.equal(next.zones['root:left'][0].props.src, 'images/old.webp');
  assert.equal(next.zones['root:left'][1].props.src, 'images/body.webp');
  assert.equal(next.zones['root:right'][0].props.id, 'paragraph-1');
  assert.deepEqual(next.content, []);
});

test('photography gallery 2 promotes the legacy gallery before existing right-column blocks', () => {
  const document = { root: { props: { template: 'splitDetail', gallery: ['images/legacy.webp'] } }, content: [], zones: {
    'root:left': [image('ImageBlock-gallery-1', { src: 'images/legacy.webp', __galleryImage: true }), { type: 'ParagraphBlock', props: { id: 'left-text', text: 'Left text' } }],
    'root:right': [{ type: 'ParagraphBlock', props: { id: 'right-text', text: 'Right text' } }],
  } };
  const next = switchPuckTemplate(document, 'photographyGallery2');
  assert.deepEqual(next.zones['root:photographyGallery2Right'].map((block) => block.props.src), ['images/legacy.webp']);
  assert.deepEqual(next.content.map((block) => block.props.id), ['left-text', 'right-text']);
  assert.equal(next.zones['root:left'], undefined);
});

test('switching out of photography gallery 2 preserves images and non-image order', () => {
  const document = { root: { props: { template: 'photographyGallery2', gallery: [] } }, content: [{ type: 'ParagraphBlock', props: { id: 'body', text: 'Body' } }], zones: {
    'root:photographyGallery2Right': [image('gallery-image', { src: 'images/a.webp', caption: 'A' }), { type: 'ParagraphBlock', props: { id: 'right-copy', text: 'Right copy' } }],
  } };
  const next = switchPuckTemplate(document, 'articleReading');
  assert.deepEqual(next.root.props.gallery, [{ src: 'images/a.webp', caption: 'A' }]);
  assert.deepEqual(next.content.map((block) => block.props.id), ['body', 'right-copy']);
  assert.equal(next.zones['root:photographyGallery2Right'], undefined);
});
