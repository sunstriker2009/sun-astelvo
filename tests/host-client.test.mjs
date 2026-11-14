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

test('duplicate contract rejects path/content overrides and mismatched copy results', async () => {
  const { assertRequest, assertResult } = await import('../desktop/workspace-contract.mjs');
  const id = '10000000-0000-0000-0000-000000000001';
  const copyId = '10000000-0000-0000-0000-000000000002';
  const params = { id, name: 'Copy', folderId: null, expectedHash: 'a'.repeat(64) };
  assert.doesNotThrow(() => assertRequest('script.duplicate', params));
  for (const extra of [{ path: '/outside' }, { content: 'renderer bytes' }])
    assert.throws(() => assertRequest('script.duplicate', { ...params, ...extra }));
  assert.throws(() => assertRequest('script.duplicate', { ...params, expectedHash: 'invalid' }));
  const document = { id: copyId, name: 'Copy', folderId: null, language: 'python', content: '', hash: params.expectedHash, externalChanged: false };
  const workspace = { root: '/workspace', schemaVersion: 1, id, name: 'Workspace', revision: 1, folders: [], scripts: [] };
  assert.doesNotThrow(() => assertResult('script.duplicate', { workspace, document }, params));
  for (const change of [{ id }, { name: 'Wrong' }, { folderId: copyId }, { hash: 'b'.repeat(64) }])
    assert.throws(() => assertResult('script.duplicate', { workspace, document: { ...document, ...change } }, params));
});

test('folder duplicate contract validates revision bounds and the new destination identity', async () => {
  const { assertRequest, assertResult } = await import('../desktop/workspace-contract.mjs');
  const id = '10000000-0000-0000-0000-000000000001', copyId = '10000000-0000-0000-0000-000000000002';
  const params = { id, name: 'Copy', parentId: null, expectedRevision: 10 };
  assert.doesNotThrow(() => assertRequest('folder.duplicate', params));
  for (const expectedRevision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '10'])
    assert.throws(() => assertRequest('folder.duplicate', { ...params, expectedRevision }));
  assert.throws(() => assertRequest('folder.duplicate', { ...params, path: '/outside' }));
  const folder = { id: copyId, name: 'Copy', parentId: null };
  const workspace = { root: '/workspace', schemaVersion: 1, id, name: 'Workspace', revision: 11, folders: [folder], scripts: [] };
  assert.doesNotThrow(() => assertResult('folder.duplicate', { workspace, folderId: copyId }, params));
  for (const folderId of [id, null]) assert.throws(() => assertResult('folder.duplicate', { workspace, folderId }, params));
  assert.throws(() => assertResult('folder.duplicate', { workspace: { ...workspace, folders: [] }, folderId: copyId }, params));
  assert.throws(() => assertResult('folder.duplicate', { workspace: { ...workspace, revision: 10 }, folderId: copyId }, params));
});
