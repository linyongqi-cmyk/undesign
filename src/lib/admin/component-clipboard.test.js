import test from 'node:test';
import assert from 'node:assert/strict';
import { copyPuckComponent, pastePuckComponent } from './component-clipboard.js';

const nestedData = () => ({
  root: { props: { title: 'Work' } },
  content: [
    { type: 'LayoutGroupBlock', props: { id: 'group-source', layout: 'stack' } },
    { type: 'ParagraphBlock', props: { id: 'paragraph-after', text: [{ text: 'After' }] } },
  ],
  zones: {
    'group-source:items': [{ type: 'ParagraphBlock', props: { id: 'child-source', text: [{ text: 'Nested' }] } }],
    'child-source:right': [{ type: 'ImageBlock', props: { id: 'image-source', src: 'images/detail.webp', caption: 'Caption' } }],
  },
});

test('copies a component and its nested zones as a detached snapshot', () => {
  const data = nestedData();
  const clipboard = copyPuckComponent(data, { zone: 'root', index: 0 });

  assert.ok(clipboard, 'selected component should be copied');
  assert.equal(clipboard.component.type, 'LayoutGroupBlock');
  assert.deepEqual(clipboard.zones, {
    'group-source:items': [{ type: 'ParagraphBlock', props: { id: 'child-source', text: [{ text: 'Nested' }] } }],
    'child-source:right': [{ type: 'ImageBlock', props: { id: 'image-source', src: 'images/detail.webp', caption: 'Caption' } }],
  });
  data.zones['group-source:items'][0].props.text[0].text = 'Changed after copy';
  assert.equal(clipboard.zones['group-source:items'][0].props.text[0].text, 'Nested');
});

test('pastes after the selected component and regenerates nested component IDs and zone keys', () => {
  const source = nestedData();
  const clipboard = copyPuckComponent(source, { zone: 'root', index: 0 });
  const target = {
    content: [
      { type: 'ParagraphBlock', props: { id: 'target-before', text: [{ text: 'Before' }] } },
      { type: 'QuoteBlock', props: { id: 'target-selected', quote: 'Selected' } },
    ],
    zones: {},
  };
  let id = 0;
  const result = pastePuckComponent(target, { zone: 'root', index: 1 }, clipboard, 'root:right', () => `fresh-${++id}`);

  assert.ok(result, 'copied component should paste into target document');
  assert.deepEqual(result.selector, { zone: 'root', index: 2 });
  assert.deepEqual(result.data.content.map((item) => item.props.id), ['target-before', 'target-selected', 'fresh-1']);
  assert.equal(result.data.content[2].type, 'LayoutGroupBlock');
  assert.deepEqual(Object.keys(result.data.zones).sort(), ['fresh-1:items', 'fresh-2:right']);
  assert.deepEqual(result.data.zones['fresh-1:items'][0], {
    type: 'ParagraphBlock', props: { id: 'fresh-2', text: [{ text: 'Nested' }] },
  });
  assert.deepEqual(result.data.zones['fresh-2:right'][0], {
    type: 'ImageBlock', props: { id: 'fresh-3', src: 'images/detail.webp', caption: 'Caption' },
  });
  assert.equal(target.content.length, 2);
});

test('appends to the fallback zone when no component is selected', () => {
  const clipboard = { component: { type: 'QuoteBlock', props: { id: 'source', quote: 'Copied' } }, zones: {} };
  const target = { content: [], zones: { 'root:right': [{ type: 'ParagraphBlock', props: { id: 'existing', text: [] } }] } };
  const result = pastePuckComponent(target, null, clipboard, 'root:right', () => 'fresh');

  assert.ok(result, 'component should append when there is no selection');
  assert.deepEqual(result.selector, { zone: 'root:right', index: 1 });
  assert.deepEqual(result.data.zones['root:right'].map((item) => item.props.id), ['existing', 'fresh']);
});

test('returns null for a missing source selection or clipboard', () => {
  const data = nestedData();
  assert.equal(copyPuckComponent(data, { zone: 'root', index: 5 }), null);
  assert.equal(pastePuckComponent(data, null, null, 'root', () => 'fresh'), null);
});
