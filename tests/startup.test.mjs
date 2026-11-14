import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('ESM entry finishes loading before Electron releases readiness', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ['tests/startup-fixture.mjs'], { timeout: 3000, maxBuffer: 65536 });
  assert.match(stdout, /Entry import finished before readiness/);
});
