import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MAX_VIDEO_BYTES,
  assertContentRecordVersion,
  contentRecordVersion,
  resolveContentFile,
  retainHistoryMedia,
} from './storage.mjs';

test('MAX_VIDEO_BYTES enforces 50MB GitHub-safe cap', () => {
  assert.equal(MAX_VIDEO_BYTES, 50 * 1024 * 1024);
});

test('resolveContentFile rejects path traversal and invalid slugs', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'portfolio-storage-'));
  try {
    assert.throws(() => resolveContentFile(root, 'work', ['../etc', 'passwd']), /Invalid category/);
    assert.throws(() => resolveContentFile(root, 'work', ['product', 'Bad_Slug']), /Invalid work/);
    assert.throws(() => resolveContentFile(root, 'unknown', []), /Invalid content section/);
    const valid = resolveContentFile(root, 'work', ['product', 'lou']);
    assert.ok(valid.endsWith(path.join('src', 'data', 'content', 'works', 'product', 'lou.json')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertContentRecordVersion detects stale concurrent writes with 409', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'portfolio-storage-'));
  try {
    const file = resolveContentFile(root, 'site', []);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ siteTitle: 'v1' }) + '\n', 'utf8');
    const v1 = contentRecordVersion(root, 'site', []);
    assert.ok(v1);
    assert.doesNotThrow(() => assertContentRecordVersion(root, 'site', [], v1));

    writeFileSync(file, JSON.stringify({ siteTitle: 'v2' }) + '\n', 'utf8');
    assert.throws(
      () => assertContentRecordVersion(root, 'site', [], v1),
      (err) => err?.status === 409,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('retainHistoryMedia rejects traversal paths safely', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'portfolio-storage-'));
  try {
    assert.doesNotThrow(() => retainHistoryMedia(root, ['images/home/cover.jpg', 'images/../secret.txt']));
    assert.throws(() => retainHistoryMedia(root, 'not-an-array'), /Invalid history media paths/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
