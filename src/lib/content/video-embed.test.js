import test from 'node:test';
import assert from 'node:assert/strict';
import { videoEmbedSource } from './video-embed.js';

test('online video URLs resolve to the iframe hosts shared by the front end and canvas', () => {
  assert.equal(videoEmbedSource('https://youtu.be/abcdefghijk'), 'https://www.youtube.com/embed/abcdefghijk?autoplay=0');
  assert.match(videoEmbedSource('https://www.bilibili.com/video/BV1xx411c7mD?p=2'), /^https:\/\/player\.bilibili\.com\/player\.html\?/);
});

test('unsupported video URLs do not produce an iframe source', () => {
  assert.equal(videoEmbedSource('https://example.com/video'), '');
  assert.equal(videoEmbedSource('https://youtube.com/watch?v=short'), '');
});
