import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMediaPlacement } from '../src/lib/admin/puck-media-placement.js';

const block = (type, props = {}) => ({ type, props: { id: `${type}-test`, ...props } });
const initial = block('ImageBlock', { id: 'target', src: 'images/works/product/a.webp' });

test('a component drop below creates a separate vertical content group', () => {
  const data = { content: [], zones: { 'root:left': [initial], 'target:placement': [block('ParagraphBlock', { text: [{ text: 'text' }] })] } };
  const result = applyMediaPlacement(data, 'target', 'target:placement', 'below-new-group');
  assert.deepEqual(result.zones['root:left'].map((entry) => entry.type), ['ImageBlock', 'ParagraphBlock']);
  assert.equal(result.zones['target:placement'], undefined);
});

test('all supported text, image, and video components join a vertical or horizontal group', () => {
  const componentTypes = ['ParagraphBlock', 'NoteBlock', 'SpecificationsBlock', 'InternalLinkBlock', 'ExternalLinkBlock', 'QuoteBlock', 'ImageBlock', 'ImageCarouselBlock', 'LocalVideoBlock', 'VideoEmbedBlock', 'WideMediaBlock'];
  for (const type of componentTypes) {
    const incoming = block(type, { src: 'videos/works/product/test.mp4', text: [{ text: 'value' }], quote: 'quote', url: 'https://youtu.be/abcdefghijk' });
    for (const placement of ['below-stack', 'right']) {
      const data = { content: [], zones: { 'root:left': [initial], 'target:placement': [incoming] } };
      const result = applyMediaPlacement(data, 'target', 'target:placement', placement);
      const group = result.zones['root:left'][0];
      assert.equal(group.type, 'LayoutGroupBlock', `${type} / ${placement}`);
      assert.equal(group.props.layout, placement === 'right' ? 'row' : 'column', `${type} / ${placement} layout`);
      assert.equal(result.zones[`${group.props.id}:items`].length, 2, `${type} / ${placement} items`);
      assert.equal(result.zones['target:placement'], undefined);
    }
  }
});
