import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, writeFile, mkdir, rm, readdir, rename, symlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { encodeFrame, FrameDecoder } from '../desktop/protocol.mjs';
import { HostClient } from '../desktop/host-client.mjs';
import { MAX_SOURCE } from '../desktop/workspace-contract.mjs';

function launch() {
  const executable = process.env.ASTELVO_HOST_EXECUTABLE ?? process.env.ASTELVO_DOTNET ?? 'dotnet';
  const args = process.env.ASTELVO_HOST_EXECUTABLE ? [] : ['src/Sun.Workspace.Host/bin/Release/net10.0/Sun.Workspace.Host.dll'];
  const env = { ...process.env };
  if (process.env.ASTELVO_HOST_EXECUTABLE) {
    for (const key of Object.keys(env)) if (key.toUpperCase() === 'PATH') delete env[key];
    env.PATH = ''; env.DOTNET_ROOT = path.join(os.tmpdir(), 'astelvo-missing-runtime');
  }
  return { executable, args, env };
}
function client() { const { executable, args, env } = launch(); return new HostClient(executable, args, { env }); }
async function fixture(action) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'astelvo-workspace-'));
  const host = client();
  try { await host.request('workspace.open', { path: root, create: true }); await action(host, root); }
  finally { await host.close(); await rm(root, { recursive: true, force: true }); }
}
const create = host => host.request('script.create', { name: 'Hello', language: 'javascript', folderId: null });
function save(host, document, content, changes = {}) {
  return host.request('script.save', { id: document.id, name: document.name, language: document.language, folderId: document.folderId, content, expectedHash: document.hash, ...changes });
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = (root, script) => path.join(root, 'scripts', script.id, script.sourceHash + ({ javascript: '.js', python: '.py', csharp: '.cs' }[script.language]));

test('workspace persists Unicode scripts, folder identity, rename, language and move', async () => fixture(async (host, root) => {
  let state = await host.request('folder.create', { name: 'Utilities', parentId: null });
  const folder = state.folders[0];
  state = await host.request('folder.rename', { id: folder.id, name: 'Everyday' });
  assert.equal(state.folders[0].id, folder.id);
  const initial = await create(host);
  const content = '# বাংলা 🌞\nprint("Explore")\n'.repeat(1200);
  const changed = await save(host, initial.document, content, { name: 'Greeting', language: 'python', folderId: folder.id });
  assert.equal(changed.document.id, initial.document.id);
  assert.equal(changed.document.hash, hash(content));
  assert.equal(await readFile(source(root, changed.workspace.scripts[0]), 'utf8'), content);
  assert.equal((await readdir(path.join(root, 'scripts', initial.document.id))).length, 2);
  await host.request('workspace.close');
  const reopened = await host.request('workspace.open', { path: root, create: false });
  assert.equal(reopened.folders[0].name, 'Everyday');
  const loaded = await host.request('script.read', { id: initial.document.id });
  assert.equal(loaded.content, content); assert.equal(loaded.folderId, folder.id);
}));

test('exclusive writer lease rejects a second host and releases on close', async () => fixture(async (host, root) => {
  const second = client();
  try {
    await assert.rejects(second.request('workspace.open', { path: root, create: false }), { code: 'locked' });
    await host.request('workspace.close');
    assert.equal((await second.request('workspace.open', { path: root, create: false })).schemaVersion, 1);
  } finally { await second.close(); }
}));

test('abrupt writer death releases the lease without losing the committed script', async () => fixture(async (host, root) => {
  const initial = await create(host);
  await save(host, initial.document, 'before crash');
  await host.request('workspace.close');
  const { executable, args, env } = launch();
  const writer = spawn(executable, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const exit = once(writer, 'close'); writer.stderr.resume();
  try {
    const opened = new Promise((resolve, reject) => {
      const decoder = new FrameDecoder();
      writer.once('error', reject);
      writer.stdout.on('data', chunk => {
        try { for (const reply of decoder.push(chunk)) reply.error ? reject(new Error(reply.error.message)) : resolve(reply.result); }
        catch (error) { reject(error); }
      });
    });
    writer.stdin.write(encodeFrame({ version: 1, id: randomUUID(), method: 'workspace.open', params: { path: root, create: false } }));
    await opened;
    writer.kill('SIGKILL'); await exit;
    await host.request('workspace.open', { path: root, create: false });
    assert.equal((await host.request('script.read', { id: initial.document.id })).content, 'before crash');
  } finally { writer.kill(); await exit; }
}));

test('maximum-size escaped source crosses frame chunks without data loss', async () => fixture(async host => {
  const initial = await create(host);
  const content = '\0'.repeat(MAX_SOURCE);
  const result = await save(host, initial.document, content);
  assert.equal(result.document.content, content);
  assert.equal((await host.request('script.read', { id: initial.document.id })).content, content);
}));

test('external edits cause save conflict and can be adopted after explicit read', async () => fixture(async (host, root) => {
  const initial = await create(host);
  const file = source(root, initial.workspace.scripts[0]);
  await writeFile(file, 'external edits');
  await assert.rejects(save(host, initial.document, 'my buffer'), { code: 'conflict' });
  assert.equal(await readFile(file, 'utf8'), 'external edits');
  const external = await host.request('script.read', { id: initial.document.id });
  assert.equal(external.externalChanged, true);
  const result = await save(host, external, 'reviewed edits');
  assert.equal(result.document.content, 'reviewed edits');
  assert.equal(await readFile(file, 'utf8'), 'external edits');
}));

test('external manifest changes require refresh; failed open preserves active workspace', async () => fixture(async (host, root) => {
  const initial = await create(host);
  const file = path.join(root, 'workspace.json');
  const metadata = JSON.parse(await readFile(file, 'utf8')); metadata.name = 'Externally renamed';
  await writeFile(file, JSON.stringify(metadata));
  await assert.rejects(save(host, initial.document, 'buffer'), { code: 'conflict' });
  assert.equal((await host.request('workspace.open', { path: root, create: false })).name, 'Externally renamed');
  await assert.rejects(host.request('workspace.open', { path: path.join(root, 'absent'), create: false }));
  assert.equal((await save(host, initial.document, 'buffer')).document.content, 'buffer');
}));

test('restart ignores orphan revisions and temporary writes; unsupported schema fails closed', async () => fixture(async (host, root) => {
  const first = await create(host);
  const saved = await save(host, first.document, 'committed');
  await writeFile(path.join(root, 'workspace.json.interrupted.tmp'), '{partial');
  await writeFile(path.join(root, 'scripts', first.document.id, 'orphan.tmp'), 'uncommitted');
  await host.request('workspace.close');
  await host.request('workspace.open', { path: root, create: false });
  assert.equal((await host.request('script.read', { id: first.document.id })).content, 'committed');
  await host.request('workspace.close');
  const file = path.join(root, 'workspace.json');
  const manifest = JSON.parse(await readFile(file, 'utf8')); manifest.schemaVersion = 99;
  const invalid = JSON.stringify(manifest); await writeFile(file, invalid);
  await assert.rejects(host.request('workspace.open', { path: root, create: false }), { code: 'invalid_workspace' });
  assert.equal(await readFile(file, 'utf8'), invalid);
  assert.equal(await readFile(source(root, saved.workspace.scripts[0]), 'utf8'), 'committed');
}));

test('managed symlink/junction escape is rejected without modifying the target', async () => fixture(async (host, root) => {
  const initial = await create(host);
  const moved = path.join(root, 'original-scripts');
  await rename(path.join(root, 'scripts'), moved);
  await symlink(moved, path.join(root, 'scripts'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(host.request('script.read', { id: initial.document.id }), { code: 'invalid_workspace' });
  await assert.rejects(duplicate(host, initial.document, 'Linked source copy'), { code: 'invalid_workspace' });
  assert.equal(await readFile(path.join(moved, initial.document.id, initial.document.hash + '.js'), 'utf8'), '');
}));

test('malformed metadata is rejected without rewriting or discarding source files', async () => fixture(async (host, root) => {
  const initial = await create(host);
  await host.request('workspace.close');
  const file = path.join(root, 'workspace.json');
  const original = JSON.parse(await readFile(file, 'utf8'));
  const folderId = randomUUID();
  const cases = [
    { ...original, unexpectedFutureMetadata: 'preserve rather than drop' },
    { ...original, folders: [{ id: folderId, name: 'Cycle', parentId: folderId }] },
    { ...original, scripts: [original.scripts[0], original.scripts[0]] },
    { ...original, scripts: [{ ...original.scripts[0], sourceHash: '../../outside' }] },
    { ...original, revision: Number.MAX_SAFE_INTEGER + 1 }
  ].map(JSON.stringify);
  cases.push(JSON.stringify(original).replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'));
  for (const data of cases) {
    await writeFile(file, data);
    await assert.rejects(host.request('workspace.open', { path: root, create: false }));
    assert.equal(await readFile(file, 'utf8'), data);
  }
  assert.equal(await readFile(source(root, initial.workspace.scripts[0]), 'utf8'), '');
}));

test('invalid requests and oversize scripts do not consume the client pending budget', async () => fixture(async host => {
  const initial = await create(host);
  for (let i = 0; i < 10; i++) {
    await assert.rejects(save(host, initial.document, 'x'.repeat(MAX_SOURCE + 1)), /Invalid content/);
    await assert.rejects(host.request('script.read', { id: '../../outside' }), /Invalid id/);
  }
  assert.equal((await host.info()).product, 'ASTELVO');
  assert.equal((await host.request('script.read', { id: initial.document.id })).content, '');
}));

test('moving a folder preserves its subtree, script revisions and open editor save identity across restart', async () => fixture(async (host, root) => {
  const folder = async (name, parentId = null) => {
    const state = await host.request('folder.create', { name, parentId });
    return state.folders.find(f => f.name === name);
  };
  const utilities = await folder('Utilities');
  const nested = await folder('Nested', utilities.id);
  const destination = await folder('Archive');
  const initial = await host.request('script.create', { name: 'Unicode', language: 'python', folderId: nested.id });
  const saved = await save(host, initial.document, '# বাংলা 🌞\nprint("hello")\n');
  const before = JSON.parse(await readFile(path.join(root, 'workspace.json'), 'utf8'));
  const files = await readdir(path.join(root, 'scripts', saved.document.id));
  const moved = await host.request('folder.move', { id: utilities.id, parentId: destination.id });
  assert.equal(moved.schemaVersion, 1);
  assert.equal(moved.revision, before.revision + 1);
  assert.equal(moved.id, before.id);
  assert.deepEqual(moved.scripts, before.scripts);
  assert.deepEqual(moved.folders.find(f => f.id === nested.id), nested);
  assert.deepEqual(moved.folders.find(f => f.id === utilities.id), { ...utilities, parentId: destination.id });
  assert.deepEqual(await readdir(path.join(root, 'scripts', saved.document.id)), files);
  assert.equal(await readFile(source(root, moved.scripts[0]), 'utf8'), saved.document.content);
  // A metadata-only folder move must not invalidate a dirty script's disk hash.
  const edited = await save(host, saved.document, saved.document.content + '# buffer kept\n');
  assert.equal(edited.document.folderId, nested.id);
  const movedToRoot = await host.request('folder.move', { id: nested.id, parentId: null });
  await host.request('workspace.close');
  const reopened = await host.request('workspace.open', { path: root, create: false });
  assert.deepEqual(reopened, movedToRoot);
  assert.equal((await host.request('script.read', { id: edited.document.id })).content, edited.document.content);
}));

test('invalid folder moves leave manifest and sources byte-for-byte intact and host usable', async () => fixture(async (host, root) => {
  const folder = async (name, parentId = null) => (await host.request('folder.create', { name, parentId })).folders.find(f => f.name === name && f.parentId === parentId);
  const parent = await folder('Parent');
  const child = await folder('Child', parent.id);
  const grandchild = await folder('Grandchild', child.id);
  const destination = await folder('Destination');
  await folder('PARENT', destination.id);
  const script = await create(host);
  const file = path.join(root, 'workspace.json');
  const before = await readFile(file, 'utf8');
  for (const [id, parentId, code] of [
    [parent.id, parent.id, 'invalid_workspace'],
    [parent.id, grandchild.id, 'invalid_workspace'],
    [parent.id, randomUUID(), 'invalid_workspace'],
    [randomUUID(), null, 'not_found'],
    [parent.id, destination.id, 'invalid_request']
  ]) {
    await assert.rejects(host.request('folder.move', { id, parentId }), { code });
    assert.equal(await readFile(file, 'utf8'), before);
    assert.equal(await readFile(source(root, script.workspace.scripts[0]), 'utf8'), '');
  }
  const noop = await host.request('folder.move', { id: parent.id, parentId: null });
  assert.equal(noop.revision, JSON.parse(before).revision);
  assert.equal(await readFile(file, 'utf8'), before);
  assert.equal((await host.request('folder.move', { id: child.id, parentId: null })).folders.find(f => f.id === child.id).parentId, null);
}));

test('folder move detects external metadata conflicts including no-ops and preserves external bytes', async () => fixture(async (host, root) => {
  const state = await host.request('folder.create', { name: 'Move me', parentId: null });
  const file = path.join(root, 'workspace.json');
  const external = JSON.parse(await readFile(file, 'utf8'));
  external.name = 'Reviewed external metadata';
  const bytes = JSON.stringify(external); await writeFile(file, bytes);
  await assert.rejects(host.request('folder.move', { id: state.folders[0].id, parentId: null }), { code: 'conflict' });
  assert.equal(await readFile(file, 'utf8'), bytes);
  await host.request('workspace.open', { path: root, create: false });
  const destination = await host.request('folder.create', { name: 'Destination', parentId: null });
  const result = await host.request('folder.move', { id: state.folders[0].id, parentId: destination.folders[1].id });
  assert.equal(result.name, external.name);
  for (const params of [
    { id: state.folders[0].id }, { id: state.folders[0].id, parentId: '' },
    { id: state.folders[0].id, parentId: '../../escape' },
    { id: state.folders[0].id, parentId: null, path: root }
  ]) await assert.rejects(host.request('folder.move', params), /invalid|Invalid/);
  assert.equal((await host.info()).product, 'ASTELVO');
}));

const duplicate = (host, document, name, folderId = document.folderId) => host.request('script.duplicate', { id: document.id, name, folderId, expectedHash: document.hash });

test('duplicate gives each language a new independent identity and exact durable source bytes', async () => fixture(async (host, root) => {
  const folders = await host.request('folder.create', { name: 'Copies', parentId: null });
  for (const language of ['javascript', 'python', 'csharp']) {
    const initial = await host.request('script.create', { name: language, language, folderId: null });
    const content = language === 'csharp' ? '\0'.repeat(MAX_SOURCE) : '// বাংলা 🌞\r\n' + language;
    const original = await save(host, initial.document, content);
    const oldSource = source(root, original.workspace.scripts.find(s => s.id === original.document.id));
    const oldBytes = await readFile(oldSource);
    const copy = await duplicate(host, original.document, language, folders.folders[0].id);
    assert.notEqual(copy.document.id, original.document.id);
    assert.equal(copy.document.content, content);
    assert.equal(copy.document.language, language);
    assert.equal(copy.document.folderId, folders.folders[0].id);
    assert.equal(copy.document.hash, original.document.hash);
    assert.deepEqual(copy.workspace.scripts.find(s => s.id === original.document.id), original.workspace.scripts.find(s => s.id === original.document.id));
    assert.deepEqual(await readFile(source(root, copy.workspace.scripts.find(s => s.id === copy.document.id))), oldBytes);
    await save(host, copy.document, 'independent edit');
    assert.deepEqual(await readFile(oldSource), oldBytes);
    await host.request('workspace.close');
    await host.request('workspace.open', { path: root, create: false });
    assert.equal((await host.request('script.read', { id: copy.document.id })).content, 'independent edit');
    assert.equal((await host.request('script.read', { id: original.document.id })).content, content);
  }
}));

test('duplicate failures preserve metadata, original bytes and managed directories', async () => fixture(async (host, root) => {
  const original = await create(host);
  const file = path.join(root, 'workspace.json');
  const before = await readFile(file, 'utf8');
  const directories = await readdir(path.join(root, 'scripts'));
  for (const [name, folderId, code] of [
    ['HELLO', null, 'invalid_request'], ['Missing folder', randomUUID(), 'invalid_workspace']
  ]) {
    await assert.rejects(duplicate(host, original.document, name, folderId), { code });
    assert.equal(await readFile(file, 'utf8'), before);
    assert.deepEqual(await readdir(path.join(root, 'scripts')), directories);
  }
  await assert.rejects(duplicate(host, { ...original.document, id: randomUUID() }, 'Missing'), { code: 'not_found' });
  await assert.rejects(duplicate(host, { ...original.document, hash: 'a'.repeat(64) }, 'Stale'), { code: 'conflict' });
  assert.equal(await readFile(file, 'utf8'), before);
  assert.equal(await readFile(source(root, original.workspace.scripts[0]), 'utf8'), '');
  assert.equal((await duplicate(host, original.document, 'Recovered copy', null)).document.content, '');
  // Simulate a copy revision staged before an interrupted manifest commit.
  const orphan = path.join(root, 'scripts', randomUUID());
  await mkdir(orphan);
  const orphanFile = path.join(orphan, original.document.hash + '.js');
  await writeFile(orphanFile, '');
  await writeFile(path.join(root, 'workspace.json.duplicate-interrupted.tmp'), '{partial');
  await host.request('workspace.close');
  const reopened = await host.request('workspace.open', { path: root, create: false });
  assert.equal(reopened.scripts.length, 2);
  assert.equal((await host.request('script.read', { id: original.document.id })).content, '');
  assert.equal(await readFile(orphanFile, 'utf8'), '');
}));

test('duplicate rejects unseen external source and metadata edits until reviewed and saved', async () => fixture(async (host, root) => {
  const initial = await create(host);
  const file = path.join(root, 'workspace.json');
  const committed = await readFile(file, 'utf8');
  const originalSource = source(root, initial.workspace.scripts[0]);
  await writeFile(originalSource, 'external source');
  await assert.rejects(duplicate(host, initial.document, 'Unseen'), { code: 'conflict' });
  const reviewed = await host.request('script.read', { id: initial.document.id });
  // Reading alone does not adopt an external edit into the committed revision.
  await assert.rejects(duplicate(host, reviewed, 'Uncommitted'), { code: 'conflict' });
  assert.equal(await readFile(file, 'utf8'), committed);
  assert.deepEqual(await readdir(path.join(root, 'scripts')), [initial.document.id]);
  const saved = await save(host, reviewed, reviewed.content);
  assert.equal((await duplicate(host, saved.document, 'Reviewed')).document.content, reviewed.content);
  const external = JSON.parse(await readFile(file, 'utf8')); external.name = 'External workspace';
  const bytes = JSON.stringify(external); await writeFile(file, bytes);
  await assert.rejects(duplicate(host, saved.document, 'Conflict'), { code: 'conflict' });
  assert.equal(await readFile(file, 'utf8'), bytes);
  await host.request('workspace.open', { path: root, create: false });
  assert.equal((await duplicate(host, saved.document, 'After refresh')).workspace.name, external.name);
}));

test('duplicate enforces catalog limits before staging and rejects invalid UTF-8 without copying', async () => fixture(async (host, root) => {
  const initial = await create(host);
  const file = path.join(root, 'workspace.json');
  const original = JSON.parse(await readFile(file, 'utf8'));
  const full = { ...original, scripts: Array.from({ length: 1000 }, (_, i) => i === 0 ? original.scripts[0] : { ...original.scripts[0], id: randomUUID(), name: `Script ${i}` }) };
  const fullBytes = JSON.stringify(full); await writeFile(file, fullBytes);
  await host.request('workspace.open', { path: root, create: false });
  await assert.rejects(duplicate(host, initial.document, 'Too many'), { code: 'limit_exceeded' });
  assert.equal(await readFile(file, 'utf8'), fullBytes);
  assert.deepEqual(await readdir(path.join(root, 'scripts')), [initial.document.id]);
  const invalidBytes = Buffer.from([0xff, 0xfe]);
  const invalidScript = { ...original.scripts[0], sourceHash: hash(invalidBytes) };
  await writeFile(source(root, invalidScript), invalidBytes);
  const invalidManifest = JSON.stringify({ ...original, scripts: [invalidScript] });
  await writeFile(file, invalidManifest);
  await host.request('workspace.open', { path: root, create: false });
  await assert.rejects(duplicate(host, { ...initial.document, hash: invalidScript.sourceHash }, 'Invalid text'), { code: 'invalid_request' });
  assert.equal(await readFile(file, 'utf8'), invalidManifest);
  assert.deepEqual(await readdir(path.join(root, 'scripts')), [initial.document.id]);
}));

const duplicateFolder = (host, state, id, name, parentId = null) => host.request('folder.duplicate', { id, name, parentId, expectedRevision: state.revision }, 30000);

test('folder duplicate commits a complete independent subtree and preserves original identities across restart', async () => fixture(async (host, root) => {
  let state = await host.request('folder.create', { name: 'Utilities', parentId: null });
  const original = state.folders[0];
  state = await host.request('folder.create', { name: 'Nested', parentId: original.id });
  const nested = state.folders[1];
  state = await host.request('folder.create', { name: 'Empty', parentId: nested.id });
  const empty = state.folders[2];
  state = await host.request('folder.create', { name: 'Archive', parentId: null });
  const archive = state.folders[3];
  for (const [language, folderId] of [['javascript', original.id], ['python', nested.id], ['csharp', nested.id]]) {
    const created = await host.request('script.create', { name: language, language, folderId });
    state = (await save(host, created.document, '// বাংলা 🌞\r\n' + language)).workspace;
  }
  const before = structuredClone(state);
  const result = await duplicateFolder(host, state, original.id, 'Utilities', archive.id);
  assert.notEqual(result.folderId, original.id);
  assert.equal(result.workspace.schemaVersion, 1);
  assert.equal(result.workspace.revision, before.revision + 1, 'Bulk copy has one commit point');
  assert.deepEqual(result.workspace.folders.slice(0, before.folders.length), before.folders);
  assert.deepEqual(result.workspace.scripts.slice(0, before.scripts.length), before.scripts);
  const copiedFolders = result.workspace.folders.slice(before.folders.length);
  assert.equal(copiedFolders.length, 3);
  assert.deepEqual(copiedFolders.find(f => f.id === result.folderId), { id: result.folderId, name: 'Utilities', parentId: archive.id });
  const copiedNested = copiedFolders.find(f => f.name === 'Nested');
  assert.equal(copiedNested.parentId, result.folderId);
  assert.equal(copiedFolders.find(f => f.name === 'Empty').parentId, copiedNested.id);
  const allIds = [...result.workspace.folders, ...result.workspace.scripts].map(x => x.id);
  assert.equal(new Set(allIds).size, allIds.length);
  const copies = result.workspace.scripts.slice(before.scripts.length);
  assert.equal(copies.length, 3);
  for (const copy of copies) {
    const sourceScript = before.scripts.find(s => s.language === copy.language);
    assert.equal(copy.folderId, copy.language === 'javascript' ? result.folderId : copiedNested.id);
    assert.equal(copy.name, sourceScript.name); assert.equal(copy.sourceHash, sourceScript.sourceHash);
    assert.deepEqual(await readFile(source(root, copy)), await readFile(source(root, sourceScript)));
    const document = await host.request('script.read', { id: copy.id });
    await save(host, document, 'independent copy edit');
    assert.notEqual((await host.request('script.read', { id: sourceScript.id })).content, 'independent copy edit');
  }
  await host.request('workspace.close');
  state = await host.request('workspace.open', { path: root, create: false });
  assert.equal(state.scripts.length, 6);
  for (const copy of copies) assert.equal((await host.request('script.read', { id: copy.id })).content, 'independent copy edit');
  const emptyCopy = await duplicateFolder(host, state, empty.id, 'Empty copy');
  assert.equal(emptyCopy.workspace.scripts.length, 6);
  assert.equal(emptyCopy.workspace.folders.length, 8);
}));

test('folder duplicate rejects stale revisions, invalid destinations and external sources before staging', async () => fixture(async (host, root) => {
  let state = await host.request('folder.create', { name: 'Original', parentId: null });
  const original = state.folders[0];
  state = await host.request('folder.create', { name: 'Child', parentId: original.id });
  const child = state.folders[1];
  for (const name of ['First', 'Second']) state = (await host.request('script.create', { name, language: 'javascript', folderId: original.id })).workspace;
  const file = path.join(root, 'workspace.json');
  const before = await readFile(file, 'utf8');
  const dirs = (await readdir(path.join(root, 'scripts'))).sort();
  for (const [id, name, parentId, revision, code] of [
    [original.id, 'ORIGINAL', null, state.revision, 'invalid_request'],
    [original.id, 'Copy', original.id, state.revision, 'invalid_request'],
    [original.id, 'Copy', child.id, state.revision, 'invalid_request'],
    [original.id, 'Copy', randomUUID(), state.revision, 'invalid_workspace'],
    [original.id, 'Copy', null, state.revision - 1, 'conflict'],
    [randomUUID(), 'Copy', null, state.revision, 'not_found']
  ]) {
    await assert.rejects(host.request('folder.duplicate', { id, name, parentId, expectedRevision: revision }), { code });
    assert.equal(await readFile(file, 'utf8'), before);
    assert.deepEqual((await readdir(path.join(root, 'scripts'))).sort(), dirs);
  }
  const changed = source(root, state.scripts[1]);
  await writeFile(changed, 'external');
  await assert.rejects(duplicateFolder(host, state, original.id, 'Copy'), { code: 'conflict' });
  assert.equal(await readFile(file, 'utf8'), before);
  assert.deepEqual((await readdir(path.join(root, 'scripts'))).sort(), dirs, 'All sources must preflight before any copy is staged');
  const external = await host.request('script.read', { id: state.scripts[1].id });
  state = (await save(host, external, external.content)).workspace;
  const metadata = JSON.parse(await readFile(file, 'utf8')); metadata.name = 'External metadata';
  const externalBytes = JSON.stringify(metadata); await writeFile(file, externalBytes);
  await assert.rejects(duplicateFolder(host, state, original.id, 'Copy'), { code: 'conflict' });
  assert.equal(await readFile(file, 'utf8'), externalBytes);
  state = await host.request('workspace.open', { path: root, create: false });
  assert.equal((await duplicateFolder(host, state, original.id, 'Reviewed copy')).workspace.scripts.length, 4);
}));

test('folder duplicate rejects missing, invalid UTF-8 and linked sources without exposing a partial subtree', async () => fixture(async (host, root) => {
  const folders = await host.request('folder.create', { name: 'Original', parentId: null });
  const created = await host.request('script.create', { name: 'Source', language: 'python', folderId: folders.folders[0].id });
  let state = created.workspace;
  const file = path.join(root, 'workspace.json');
  const initialBytes = await readFile(file, 'utf8');
  const sourceFile = source(root, state.scripts[0]);
  await rm(sourceFile);
  await assert.rejects(duplicateFolder(host, state, folders.folders[0].id, 'Copy'), { code: 'io_error' });
  assert.equal(await readFile(file, 'utf8'), initialBytes);
  const invalid = Buffer.from([0xff]);
  const manifest = JSON.parse(initialBytes); manifest.scripts[0].sourceHash = hash(invalid);
  await writeFile(source(root, manifest.scripts[0]), invalid);
  const invalidBytes = JSON.stringify(manifest); await writeFile(file, invalidBytes);
  state = await host.request('workspace.open', { path: root, create: false });
  await assert.rejects(duplicateFolder(host, state, folders.folders[0].id, 'Copy'), { code: 'invalid_request' });
  assert.equal(await readFile(file, 'utf8'), invalidBytes);
  assert.equal((await readdir(path.join(root, 'scripts'))).length, 1);
  const moved = path.join(root, 'original-scripts');
  await rename(path.join(root, 'scripts'), moved);
  await symlink(moved, path.join(root, 'scripts'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(duplicateFolder(host, state, folders.folders[0].id, 'Copy'), { code: 'invalid_workspace' });
  assert.deepEqual(await readdir(moved), [created.document.id]);
}));

test('folder duplicate preflights folder/script catalog caps and an 8 MiB aggregate source bound', async () => fixture(async (host, root) => {
  const folderState = await host.request('folder.create', { name: 'Original', parentId: null });
  const originalId = folderState.folders[0].id;
  const initial = await host.request('script.create', { name: 'Source', language: 'javascript', folderId: originalId });
  const file = path.join(root, 'workspace.json');
  const original = JSON.parse(await readFile(file, 'utf8'));
  const crowded = { ...original, folders: [...original.folders, ...Array.from({ length: 199 }, (_, i) => ({ id: randomUUID(), name: `Folder ${i}`, parentId: null }))] };
  const fullScripts = { ...original, scripts: [...original.scripts, ...Array.from({ length: 999 }, (_, i) => ({ ...original.scripts[0], id: randomUUID(), name: `Script ${i}`, folderId: null }))] };
  const exhausted = JSON.stringify({ ...original, revision: Number.MAX_SAFE_INTEGER });
  await writeFile(file, exhausted);
  const exhaustedState = await host.request('workspace.open', { path: root, create: false });
  await assert.rejects(duplicateFolder(host, exhaustedState, originalId, 'Copy'), { code: 'invalid_workspace' });
  assert.equal(await readFile(file, 'utf8'), exhausted);
  assert.deepEqual(await readdir(path.join(root, 'scripts')), [initial.document.id]);
  for (const manifest of [crowded, fullScripts]) {
    const bytes = JSON.stringify(manifest); await writeFile(file, bytes);
    const state = await host.request('workspace.open', { path: root, create: false });
    await assert.rejects(duplicateFolder(host, state, originalId, 'Copy'), { code: 'limit_exceeded' });
    assert.equal(await readFile(file, 'utf8'), bytes);
    assert.deepEqual(await readdir(path.join(root, 'scripts')), [initial.document.id]);
  }
  const bytes = Buffer.alloc(MAX_SOURCE, 'x');
  const scripts = Array.from({ length: 33 }, (_, i) => ({ ...original.scripts[0], id: randomUUID(), name: `Large ${i}`, sourceHash: hash(bytes) }));
  for (const script of scripts) { const target = source(root, script); await mkdir(path.dirname(target)); await writeFile(target, bytes); }
  const large = JSON.stringify({ ...original, scripts }); await writeFile(file, large);
  const dirs = (await readdir(path.join(root, 'scripts'))).sort();
  let state = await host.request('workspace.open', { path: root, create: false });
  await assert.rejects(duplicateFolder(host, state, originalId, 'Copy'), { code: 'limit_exceeded' });
  assert.equal(await readFile(file, 'utf8'), large);
  assert.deepEqual((await readdir(path.join(root, 'scripts'))).sort(), dirs);
  await writeFile(file, JSON.stringify({ ...original, scripts: scripts.slice(0, 32) }));
  state = await host.request('workspace.open', { path: root, create: false });
  const result = await duplicateFolder(host, state, originalId, 'At limit');
  assert.equal(result.workspace.scripts.length, 64);
}));

test('abrupt host death during a folder copy exposes either the whole subtree or none', async () => fixture(async (host, root) => {
  const state = await host.request('folder.create', { name: 'Original', parentId: null });
  const created = await host.request('script.create', { name: 'Seed', language: 'javascript', folderId: state.folders[0].id });
  const manifestFile = path.join(root, 'workspace.json');
  const original = JSON.parse(await readFile(manifestFile, 'utf8'));
  const bytes = Buffer.alloc(64 * 1024, 'x');
  const scripts = Array.from({ length: 64 }, (_, i) => ({ ...original.scripts[0], id: randomUUID(), name: `Script ${i}`, sourceHash: hash(bytes) }));
  for (const script of scripts) { const file = source(root, script); await mkdir(path.dirname(file)); await writeFile(file, bytes); }
  const fixtureManifest = { ...original, scripts };
  await writeFile(manifestFile, JSON.stringify(fixtureManifest));
  await host.request('workspace.close');
  const { executable, args, env } = launch();
  const writer = spawn(executable, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = once(writer, 'close'); writer.stderr.resume();
  let watcher, deadline, interrupted = false;
  try {
    const openId = randomUUID();
    const opened = new Promise((resolve, reject) => {
      const decoder = new FrameDecoder(); writer.once('error', reject);
      writer.stdout.on('data', chunk => {
        try { for (const reply of decoder.push(chunk)) if (reply.id === openId) reply.error ? reject(new Error(reply.error.message)) : resolve(reply.result); }
        catch (error) { reject(error); }
      });
    });
    writer.stdin.write(encodeFrame({ version: 1, id: openId, method: 'workspace.open', params: { path: root, create: false } }));
    await opened;
    const known = new Set((await readdir(path.join(root, 'scripts'))));
    const { watch } = await import('node:fs');
    watcher = watch(path.join(root, 'scripts'), (_event, filename) => {
      if (filename && !known.has(filename.toString())) { interrupted = true; writer.kill('SIGKILL'); }
    });
    deadline = setTimeout(() => writer.kill('SIGKILL'), 5000);
    writer.stdin.write(encodeFrame({ version: 1, id: randomUUID(), method: 'folder.duplicate', params: { id: state.folders[0].id, name: 'Interrupted copy', parentId: null, expectedRevision: fixtureManifest.revision } }));
    await closed;
    watcher.close(); clearTimeout(deadline);
    assert.equal(interrupted, true, 'Test must observe copy staging before terminating the host');
    const recovered = await host.request('workspace.open', { path: root, create: false });
    assert.ok(recovered.scripts.length === 64 || recovered.scripts.length === 128, 'No partial copied manifest may be visible');
    assert.equal(recovered.folders.length, recovered.scripts.length === 64 ? 1 : 2);
    assert.deepEqual(recovered.scripts.slice(0, 64), scripts);
    for (const script of recovered.scripts) assert.deepEqual(await readFile(source(root, script)), bytes);
  } finally { watcher?.close(); clearTimeout(deadline); writer.kill(); await closed; }
}));
