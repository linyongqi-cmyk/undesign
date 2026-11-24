import assert from 'node:assert/strict';
import test from 'node:test';
import { setHomeCoverState } from './home-cover-state.js';

function node(initialAttributes = []) {
  const attributes = new Set(initialAttributes);
  const classes = new Set();
  return {
    attributes,
    classes,
    classList: {
      add: (value) => classes.add(value),
      remove: (value) => classes.delete(value),
    },
    setAttribute: (name) => attributes.add(name),
    removeAttribute: (name) => attributes.delete(name),
  };
}

test('home carousel exposes only the active cover and marks its dot current', () => {
  const covers = [node(), node(['aria-hidden'])];
  const dots = [node(['aria-current']), node()];

  const activeIndex = setHomeCoverState(covers, dots, 0, 1);

  assert.equal(activeIndex, 1);
  assert.equal(covers[0].attributes.has('aria-hidden'), true);
  assert.equal(covers[1].attributes.has('aria-hidden'), false);
  assert.equal(dots[0].attributes.has('aria-current'), false);
  assert.equal(dots[1].attributes.has('aria-current'), true);
});
