import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePhotographyLightboxFocusTarget } from '../src/lib/admin/photography-lightbox-focus.js';

test('photography canvas preview returns focus to the stable image settings button', () => {
  const settingsButton = { isConnected: true };
  const transientPreviewButton = { isConnected: true };
  const imageEditor = { querySelector: (selector) => selector === '.puck-component-settings' ? settingsButton : null };

  assert.equal(resolvePhotographyLightboxFocusTarget(imageEditor, transientPreviewButton), settingsButton);
});

test('photography canvas preview falls back to its trigger when the editor control is unavailable', () => {
  const trigger = { isConnected: true };
  assert.equal(resolvePhotographyLightboxFocusTarget(null, trigger), trigger);
  assert.equal(resolvePhotographyLightboxFocusTarget({ querySelector: () => ({ isConnected: false }) }, trigger), trigger);
});
