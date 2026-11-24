import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertContentRecordVersion, contentRecordVersion } from './local-admin/storage.mjs';

test('content versions detect updates from another editor and the missing-record state', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'portfolio-version-'));
  const content = path.join(root, 'src/data/content');
  mkdirSync(content, { recursive: true });
  const file = path.join(content, 'site.json');
  try {
    writeFileSync(file, '{"title":"first"}');
    const first = contentRecordVersion(root, 'site');
    assert.equal(typeof first, 'string');
    assert.doesNotThrow(() => assertContentRecordVersion(root, 'site', [], first));
    writeFileSync(file, '{"title":"second"}');
    assert.throws(() => assertContentRecordVersion(root, 'site', [], first), (error) => error.status === 409 && /管理标签页更新/.test(error.message));
    assert.throws(() => assertContentRecordVersion(root, 'site', [], 'missing'), (error) => error.status === 409);
    rmSync(file);
    assert.doesNotThrow(() => assertContentRecordVersion(root, 'site', [], 'missing'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
