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

test('recycle contract bounds consent/revisions and rejects misplaced delete/restore results', async () => {
  const { assertRequest, assertResult } = await import('../desktop/workspace-contract.mjs');
  const id = '10000000-0000-0000-0000-000000000001';
  const script = { id, name: 'Hello', language: 'javascript', folderId: null, sourceHash: 'a'.repeat(64) };
  const params = { id, expectedHash: script.sourceHash, expectedRevision: 3, allowUpgrade: true };
  const workspace = { root: '/workspace', schemaVersion: 2, id, name: 'Workspace', revision: 4, folders: [], scripts: [], deletedScripts: [script] };
  assert.doesNotThrow(() => assertRequest('script.delete', params));
  for (const changes of [{ allowUpgrade: 'yes' }, { expectedRevision: -1 }, { expectedHash: 'invalid' }, { path: '/outside' }])
    assert.throws(() => assertRequest('script.delete', { ...params, ...changes }));
  assert.doesNotThrow(() => assertResult('script.delete', workspace, params));
  for (const changes of [{ schemaVersion: 1 }, { revision: 3 }, { scripts: [script] }, { deletedScripts: [] }, { deletedScripts: null }])
    assert.throws(() => assertResult('script.delete', { ...workspace, ...changes }, params));
  const restore = { id, name: 'Restored', folderId: null, expectedRevision: 4 };
  assert.doesNotThrow(() => assertRequest('script.restore', restore));
  const restored = { ...workspace, revision: 5, deletedScripts: [], scripts: [{ ...script, name: 'Restored' }] };
  assert.doesNotThrow(() => assertResult('script.restore', restored, restore));
  for (const changes of [{ deletedScripts: [script] }, { scripts: [script] }, { revision: 4 }])
    assert.throws(() => assertResult('script.restore', { ...restored, ...changes }, restore));
});

test('folder recycle contract validates upgrade/revision and complete tree result placement', async () => {
  const { assertRequest, assertResult } = await import('../desktop/workspace-contract.mjs');
  const id = '10000000-0000-0000-0000-000000000001';
  const folder = { id, name: 'Original', parentId: null };
  const params = { id, expectedRevision: 1, allowUpgrade: true };
  const workspace = { root: '/workspace', schemaVersion: 3, id, name: 'Workspace', revision: 2, folders: [], scripts: [], deletedScripts: [], deletedFolderTrees: [{ rootId: id, folders: [folder], scripts: [], deletedScripts: [] }] };
  assert.doesNotThrow(() => assertRequest('folder.delete', params));
  for (const extra of [{ path: '/outside' }, { allowUpgrade: 'yes' }, { expectedRevision: -1 }])
    assert.throws(() => assertRequest('folder.delete', { ...params, ...extra }));
  assert.doesNotThrow(() => assertResult('folder.delete', workspace, params));
  for (const extra of [{ schemaVersion: 2 }, { revision: 1 }, { folders: [folder] }, { deletedFolderTrees: [] }])
    assert.throws(() => assertResult('folder.delete', { ...workspace, ...extra }, params));
  const restore = { id, name: 'Restored', parentId: null, expectedRevision: 2 };
  const restored = { ...workspace, revision: 3, folders: [{ ...folder, name: restore.name }], deletedFolderTrees: [] };
  assert.doesNotThrow(() => assertRequest('folder.restore', restore));
  assert.doesNotThrow(() => assertResult('folder.restore', restored, restore));
  assert.throws(() => assertResult('folder.restore', { ...restored, deletedFolderTrees: workspace.deletedFolderTrees }, restore));
});

test('classification contract enforces bounded unique labels and correlated v4 results', async () => {
  const { assertRequest, assertResult } = await import('../desktop/workspace-contract.mjs');
  const id = '10000000-0000-0000-0000-000000000001';
  const params = { id, tags: ['work', 'বাংলা'], favourite: true, expectedRevision: 1, allowUpgrade: true };
  const script = { id, name: 'Hello', language: 'python', folderId: null, sourceHash: 'a'.repeat(64), classification: { tags: params.tags, favourite: true } };
  const workspace = { root: '/workspace', schemaVersion: 4, id, name: 'Workspace', revision: 2, folders: [], scripts: [script], deletedScripts: [], deletedFolderTrees: [] };
  assert.doesNotThrow(() => assertRequest('script.classify', params));
  for (const changes of [{ tags: ['a', 'A'] }, { tags: [' x'] }, { tags: ['x'.repeat(41)] }, { favourite: 'yes' }, { path: '/outside' }])
    assert.throws(() => assertRequest('script.classify', { ...params, ...changes }));
  assert.doesNotThrow(() => assertResult('script.classify', workspace, params));
  for (const changes of [{ schemaVersion: 3 }, { revision: 1 }, { scripts: [] }, { scripts: [{ ...script, classification: { tags: [], favourite: false } }] }])
    assert.throws(() => assertResult('script.classify', { ...workspace, ...changes }, params));
});

test('collection contract validates exact bounded filters and correlated create/update/delete results', async () => {
  const { assertRequest, assertResult } = await import('../desktop/workspace-contract.mjs');
  const id = '10000000-0000-0000-0000-000000000001';
  const filter = { nameContains: 'Hello', language: 'python', folderId: null, tag: 'work', favouritesOnly: true };
  const params = { name: 'Saved', filter, expectedRevision: 1, allowUpgrade: true };
  const collection = { id, name: 'Saved', filter };
  const workspace = { root: '/workspace', schemaVersion: 5, id, name: 'Workspace', revision: 2, folders: [], scripts: [], deletedScripts: [], deletedFolderTrees: [], collections: [collection] };
  assert.doesNotThrow(() => assertRequest('collection.create', params));
  for (const changes of [{ nameContains: 'x'.repeat(121) }, { language: 'sql' }, { folderId: '/outside' }, { favouritesOnly: 'yes' }, { extra: true }])
    assert.throws(() => assertRequest('collection.create', { ...params, filter: { ...filter, ...changes } }));
  assert.doesNotThrow(() => assertResult('collection.create', { workspace, collectionId: id }, params));
  assert.throws(() => assertResult('collection.create', { workspace: { ...workspace, revision: 1 }, collectionId: id }, params));
  const update = { id, name: 'Saved', filter, expectedRevision: 1 };
  assert.doesNotThrow(() => assertRequest('collection.update', update));
  assert.doesNotThrow(() => assertResult('collection.update', workspace, update));
  assert.throws(() => assertResult('collection.update', { ...workspace, collections: [{ ...collection, filter: { ...filter, tag: null } }] }, update));
  assert.doesNotThrow(() => assertRequest('collection.delete', { id, expectedRevision: 1 }));
  assert.doesNotThrow(() => assertResult('collection.delete', { ...workspace, collections: [] }, { id, expectedRevision: 1 }));
  assert.throws(() => assertResult('collection.delete', workspace, { id, expectedRevision: 1 }));
});
