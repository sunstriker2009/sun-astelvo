import test from 'node:test';
import assert from 'node:assert/strict';
import { HostClient } from '../desktop/host-client.mjs';
for (const mode of ['invalid', 'exit', 'silent']) {
  test(`client settles pending requests after ${mode} host response`, { timeout: 5000 }, async () => {
    const client = new HostClient(process.execPath, ['tests/fake-host.mjs', mode]);
    try { await assert.rejects(client.info(mode === 'silent' ? 500 : 3000), mode === 'silent' ? /timed out/ : /disconnected/); }
    finally { await client.close(); }
  });
}
test('missing executable rejects request and closes cleanly', { timeout: 5000 }, async () => {
  const client = new HostClient('astelvo-nonexistent-test-runtime');
  try { await assert.rejects(client.info(), /disconnected/); }
  finally { await client.close(); }
});
