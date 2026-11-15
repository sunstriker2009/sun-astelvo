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


test('exhausted workspace revision rejects script writes before staging any source', async () => fixture(async (host, root) => {
  const initial = await create(host);
  const file = path.join(root, 'workspace.json');
  const metadata = JSON.parse(await readFile(file, 'utf8')); metadata.revision = Number.MAX_SAFE_INTEGER;
  const before = JSON.stringify(metadata); await writeFile(file, before);
  await host.request('workspace.open', { path: root, create: false });
  const dirs = await readdir(path.join(root, 'scripts'));
  const revisions = await readdir(path.join(root, 'scripts', initial.document.id));
  for (const action of [() => create(host), () => save(host, initial.document, 'must not stage'), () => duplicate(host, initial.document, 'Copy')]) {
    await assert.rejects(action(), { code: 'invalid_workspace' });
    assert.equal(await readFile(file, 'utf8'), before);
    assert.deepEqual(await readdir(path.join(root, 'scripts')), dirs);
    assert.deepEqual(await readdir(path.join(root, 'scripts', initial.document.id)), revisions);
  }
}));

const removeScript = (host, state, document, allowUpgrade = false) => host.request('script.delete', {
  id: document.id, expectedHash: document.hash, expectedRevision: state.revision, allowUpgrade
});
const restoreScript = (host, state, script, changes = {}) => host.request('script.restore', {
  id: script.id, name: script.name, folderId: script.folderId, expectedRevision: state.revision, ...changes
});

test('script recycle bin explicitly upgrades v1, retains exact metadata/source and restores original identities after restart', async () => fixture(async (host, root) => {
  const folderState = await host.request('folder.create', { name: 'বাংলা', parentId: null });
  const first = await host.request('script.create', { name: 'Greeting', language: 'python', folderId: folderState.folders[0].id });
  const saved = await save(host, first.document, 'print("🌞")\n');
  const file = path.join(root, 'workspace.json');
  const before = await readFile(file);
  const sourceBefore = await readFile(source(root, saved.workspace.scripts[0]));
  await assert.rejects(removeScript(host, saved.workspace, saved.document), { code: 'upgrade_required' });
  assert.deepEqual(await readFile(file), before);
  assert.equal((await readdir(root)).some(f => f.startsWith('workspace.v1.')), false);
  let state = await removeScript(host, saved.workspace, saved.document, true);
  assert.equal(state.schemaVersion, 2); assert.equal(state.scripts.length, 0);
  assert.deepEqual(state.deletedScripts, saved.workspace.scripts);
  assert.deepEqual(await readFile(path.join(root, `workspace.v1.${hash(before)}.json`)), before);
  assert.deepEqual(await readFile(source(root, state.deletedScripts[0])), sourceBefore);
  await assert.rejects(host.request('script.read', { id: saved.document.id }), { code: 'not_found' });
  await assert.rejects(save(host, saved.document, 'must not resurrect'), { code: 'not_found' });
  await assert.rejects(duplicate(host, saved.document, 'must not copy'), { code: 'not_found' });
  await host.request('workspace.close');
  state = await host.request('workspace.open', { path: root, create: false });
  const restored = await restoreScript(host, state, state.deletedScripts[0]);
  assert.equal(restored.schemaVersion, 2); assert.equal(restored.deletedScripts.length, 0);
  assert.deepEqual(restored.scripts, saved.workspace.scripts);
  assert.deepEqual(restored.folders, saved.workspace.folders);
  assert.equal(restored.id, saved.workspace.id);
  assert.equal((await host.request('script.read', { id: saved.document.id })).content, saved.document.content);
  // Subsequent normal operations retain the schema and every trash entry.
  state = await removeScript(host, restored, saved.document);
  const created = await create(host);
  assert.deepEqual(created.workspace.deletedScripts, state.deletedScripts);
  assert.equal((await host.request('folder.create', { name: 'Other', parentId: null })).deletedScripts.length, 1);
}));

test('delete and restore conflicts never rewrite metadata or sources and restore can resolve name collisions', async () => fixture(async (host, root) => {
  const initial = await create(host);
  const file = path.join(root, 'workspace.json');
  const before = await readFile(file);
  for (const [document, state, code] of [
    [{ ...initial.document, hash: 'a'.repeat(64) }, initial.workspace, 'conflict'],
    [initial.document, { ...initial.workspace, revision: initial.workspace.revision - 1 }, 'conflict'],
    [{ ...initial.document, id: randomUUID() }, initial.workspace, 'not_found']
  ]) {
    await assert.rejects(removeScript(host, state, document, true), { code });
    assert.deepEqual(await readFile(file), before);
  }
  const originalSource = source(root, initial.workspace.scripts[0]);
  await writeFile(originalSource, 'external');
  await assert.rejects(removeScript(host, initial.workspace, initial.document, true), { code: 'conflict' });
  assert.deepEqual(await readFile(file), before);
  await writeFile(originalSource, '');
  let state = await removeScript(host, initial.workspace, initial.document, true);
  const deleted = state.deletedScripts[0];
  state = (await create(host)).workspace;
  const removedBytes = await readFile(file);
  for (const changes of [{}, { folderId: randomUUID() }, { expectedRevision: state.revision - 1 }]) {
    await assert.rejects(restoreScript(host, state, deleted, changes));
    assert.deepEqual(await readFile(file), removedBytes);
  }
  await writeFile(originalSource, 'external trash');
  await assert.rejects(restoreScript(host, state, deleted, { name: 'Recovered' }), { code: 'conflict' });
  assert.deepEqual(await readFile(file), removedBytes);
  assert.equal(await readFile(originalSource, 'utf8'), 'external trash');
  await writeFile(originalSource, '');
  state = await restoreScript(host, state, deleted, { name: 'Recovered' });
  assert.equal(state.scripts.find(s => s.id === deleted.id).name, 'Recovered');
  assert.equal(state.scripts.length, 2);
  await assert.rejects(restoreScript(host, state, deleted), { code: 'not_found' });
}));

test('v2 rejects malformed trash and counts deleted scripts toward limits; v1 writes stay v1 until consent', async () => fixture(async (host, root) => {
  const initial = await create(host);
  const file = path.join(root, 'workspace.json');
  const v1 = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(Object.hasOwn(v1, 'deletedScripts'), false);
  await host.request('workspace.close');
  const deleted = { ...v1.scripts[0], id: randomUUID() };
  for (const malformed of [
    { ...v1, deletedScripts: [] }, { ...v1, deletedScripts: null },
    { ...v1, schemaVersion: 2 }, { ...v1, schemaVersion: 2, deletedScripts: null },
    { ...v1, schemaVersion: 2, deletedScripts: v1.scripts },
    { ...v1, schemaVersion: 2, deletedScripts: [{ ...deleted, futureMetadata: 'keep' }] },
    { ...v1, schemaVersion: 2, deletedScripts: [{ ...deleted, folderId: randomUUID() }] }
  ]) {
    const bytes = JSON.stringify(malformed); await writeFile(file, bytes);
    await assert.rejects(host.request('workspace.open', { path: root, create: false }));
    assert.equal(await readFile(file, 'utf8'), bytes);
  }
  const full = { ...v1, schemaVersion: 2, deletedScripts: Array.from({ length: 999 }, () => ({ ...deleted, id: randomUUID() })) };
  await writeFile(file, JSON.stringify(full));
  let state = await host.request('workspace.open', { path: root, create: false });
  const before = await readFile(file);
  await assert.rejects(host.request('script.create', { name: 'Too many', language: 'javascript', folderId: null }), { code: 'limit_exceeded' });
  assert.deepEqual(await readFile(file), before);
  // Delete does not reduce the combined cap, while restore adds no identities.
  state = await removeScript(host, state, initial.document);
  assert.equal(state.deletedScripts.length, 1000);
  state = await restoreScript(host, state, state.deletedScripts.find(s => s.id === initial.document.id));
  assert.equal(state.scripts.length + state.deletedScripts.length, 1000);
}));

test('upgrade backup conflict and exhausted revisions fail before committing; an interrupted backup is recoverable', async () => fixture(async (host, root) => {
  const initial = await create(host);
  const file = path.join(root, 'workspace.json');
  const before = await readFile(file);
  const backup = path.join(root, `workspace.v1.${hash(before)}.json`);
  await writeFile(backup, 'unrelated file');
  await assert.rejects(removeScript(host, initial.workspace, initial.document, true), { code: 'conflict' });
  assert.deepEqual(await readFile(file), before);
  assert.equal(await readFile(backup, 'utf8'), 'unrelated file');
  // Simulate termination after the backup flush but before manifest commit.
  await writeFile(backup, before);
  await writeFile(path.join(root, 'workspace.json.interrupted-upgrade.tmp'), '{partial');
  await host.request('workspace.close');
  let state = await host.request('workspace.open', { path: root, create: false });
  assert.equal(state.schemaVersion, 1);
  assert.equal((await host.request('script.read', { id: initial.document.id })).content, '');
  state = await removeScript(host, state, initial.document, true);
  assert.equal(state.deletedScripts[0].id, initial.document.id);
  assert.deepEqual(await readFile(backup), before);
  const metadata = JSON.parse(await readFile(file, 'utf8')); metadata.revision = Number.MAX_SAFE_INTEGER;
  await writeFile(file, JSON.stringify(metadata));
  state = await host.request('workspace.open', { path: root, create: false });
  const exhausted = await readFile(file);
  await assert.rejects(restoreScript(host, state, state.deletedScripts[0]), { code: 'invalid_workspace' });
  assert.deepEqual(await readFile(file), exhausted);
}));

const removeFolder = (host, state, id, allowUpgrade = false) => host.request('folder.delete', { id, expectedRevision: state.revision, allowUpgrade }, 30000);
const restoreFolder = (host, state, id, name, parentId = null) => host.request('folder.restore', { id, name, parentId, expectedRevision: state.revision }, 30000);

test('folder recycle bin preserves whole subtree identities, source bytes and independently deleted script state across restart', async () => fixture(async (host, root) => {
  let state = await host.request('folder.create', { name: 'Original', parentId: null });
  const parent = state.folders[0];
  state = await host.request('folder.create', { name: 'Nested', parentId: parent.id });
  const nested = state.folders.find(f => f.name === 'Nested');
  state = await host.request('folder.create', { name: 'Empty', parentId: nested.id });
  const documents = [];
  for (const language of ['javascript', 'python', 'csharp']) {
    const created = await host.request('script.create', { name: language, language, folderId: nested.id });
    const saved = await save(host, created.document, `// ${language} বাংলা 🌞`);
    state = saved.workspace; documents.push(saved.document);
  }
  state = await removeScript(host, state, documents[1], true);
  const before = await readFile(path.join(root, 'workspace.json'));
  const originalState = state;
  await assert.rejects(removeFolder(host, state, parent.id), { code: 'upgrade_required' });
  assert.deepEqual(await readFile(path.join(root, 'workspace.json')), before);
  state = await removeFolder(host, state, parent.id, true);
  assert.equal(state.schemaVersion, 3);
  assert.deepEqual(await readFile(path.join(root, `workspace.v2.${hash(before)}.json`)), before);
  assert.deepEqual(state.folders, []); assert.deepEqual(state.scripts, []); assert.deepEqual(state.deletedScripts, []);
  const tree = state.deletedFolderTrees[0];
  assert.equal(tree.rootId, parent.id);
  assert.deepEqual(tree.folders, originalState.folders);
  assert.deepEqual(tree.scripts, originalState.scripts);
  assert.deepEqual(tree.deletedScripts, originalState.deletedScripts);
  for (const doc of documents) {
    const stored = [...tree.scripts, ...tree.deletedScripts].find(s => s.id === doc.id);
    assert.equal(await readFile(source(root, stored), 'utf8'), doc.content);
    await assert.rejects(host.request('script.read', { id: doc.id }), { code: 'not_found' });
  }
  await host.request('workspace.close');
  state = await host.request('workspace.open', { path: root, create: false });
  assert.deepEqual(state.deletedFolderTrees, [tree]);
  state = await host.request('folder.create', { name: 'Archive', parentId: null });
  const archive = state.folders[0];
  // All ordinary v3 script mutations preserve the separate folder trash.
  const outside = await create(host);
  state = await removeScript(host, outside.workspace, outside.document);
  assert.equal(state.schemaVersion, 3); assert.deepEqual(state.deletedFolderTrees, [tree]);
  state = await restoreFolder(host, state, parent.id, 'Restored', archive.id);
  assert.equal(state.deletedFolderTrees.length, 0);
  assert.deepEqual(state.folders.find(f => f.id === parent.id), { ...parent, name: 'Restored', parentId: archive.id });
  assert.deepEqual(state.folders.find(f => f.id === nested.id), nested);
  assert.deepEqual(state.scripts, tree.scripts);
  assert.ok(state.deletedScripts.some(s => s.id === documents[1].id), 'Independently deleted script must stay deleted');
  await assert.rejects(host.request('script.read', { id: documents[1].id }), { code: 'not_found' });
  assert.equal((await host.request('script.read', { id: documents[0].id })).content, documents[0].content);
  state = await restoreScript(host, state, state.deletedScripts.find(s => s.id === documents[1].id));
  assert.equal(state.schemaVersion, 3);
}));

test('folder delete/restore reject stale metadata, external/missing/linked source and destinations without partial writes', async () => fixture(async (host, root) => {
  let state = await host.request('folder.create', { name: 'Original', parentId: null });
  const folder = state.folders[0];
  const created = await host.request('script.create', { name: 'Hello', language: 'javascript', folderId: folder.id });
  state = created.workspace;
  const file = path.join(root, 'workspace.json');
  const before = await readFile(file);
  await assert.rejects(removeFolder(host, { ...state, revision: 0 }, folder.id, true), { code: 'conflict' });
  await assert.rejects(removeFolder(host, state, randomUUID(), true), { code: 'not_found' });
  const sourceFile = source(root, state.scripts[0]);
  await writeFile(sourceFile, 'external');
  await assert.rejects(removeFolder(host, state, folder.id, true), { code: 'conflict' });
  assert.deepEqual(await readFile(file), before);
  assert.equal((await readdir(root)).some(f => f.startsWith('workspace.v1.')), false);
  await writeFile(sourceFile, '');
  state = await removeFolder(host, state, folder.id, true);
  const removed = await readFile(file);
  await assert.rejects(restoreFolder(host, { ...state, revision: 0 }, folder.id, 'Restored'), { code: 'conflict' });
  await assert.rejects(restoreFolder(host, state, folder.id, 'Restored', folder.id));
  await assert.rejects(restoreFolder(host, state, folder.id, 'Restored', randomUUID()));
  await rm(sourceFile);
  await assert.rejects(restoreFolder(host, state, folder.id, 'Restored'), { code: 'io_error' });
  await writeFile(sourceFile, '');
  const sourceDirectory = path.dirname(sourceFile), moved = sourceDirectory + '.retained';
  await rename(sourceDirectory, moved);
  await symlink(moved, sourceDirectory, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(restoreFolder(host, state, folder.id, 'Restored'), { code: 'invalid_workspace' });
  await rm(sourceDirectory, { recursive: true }); await rename(moved, sourceDirectory);
  assert.deepEqual(await readFile(file), removed);
  state = await host.request('folder.create', { name: 'ORIGINAL', parentId: null });
  const collision = await readFile(file);
  await assert.rejects(restoreFolder(host, state, folder.id, 'Original'), { code: 'invalid_request' });
  assert.deepEqual(await readFile(file), collision);
  const external = JSON.parse(collision); external.name = 'External workspace';
  await writeFile(file, JSON.stringify(external));
  await assert.rejects(restoreFolder(host, state, folder.id, 'Renamed'), { code: 'conflict' });
  state = await host.request('workspace.open', { path: root, create: false });
  state = await restoreFolder(host, state, folder.id, 'Renamed');
  assert.equal(state.deletedFolderTrees.length, 0);
  assert.equal((await host.request('script.read', { id: created.document.id })).content, '');
}));

test('deleted folder can be restored after its original parent is deleted separately; v1 upgrade checkpoints recover safely', async () => fixture(async (host, root) => {
  let state = await host.request('folder.create', { name: 'Parent', parentId: null });
  const parentId = state.folders[0].id;
  state = await host.request('folder.create', { name: 'Child', parentId: parentId });
  const childId = state.folders.find(f => f.name === 'Child').id;
  const file = path.join(root, 'workspace.json');
  const before = await readFile(file);
  // A retained checkpoint and partial temp are an interrupted pre-commit state.
  const backup = path.join(root, `workspace.v1.${hash(before)}.json`);
  await writeFile(backup, before);
  await writeFile(path.join(root, 'workspace.json.folder-interrupted.tmp'), '{partial');
  await host.request('workspace.close');
  state = await host.request('workspace.open', { path: root, create: false });
  assert.equal(state.schemaVersion, 1); assert.equal(state.folders.length, 2);
  state = await removeFolder(host, state, childId, true);
  assert.deepEqual(await readFile(backup), before);
  state = await removeFolder(host, state, parentId);
  await host.request('workspace.close');
  state = await host.request('workspace.open', { path: root, create: false });
  assert.equal(state.deletedFolderTrees.length, 2);
  state = await restoreFolder(host, state, childId, 'Independent child');
  assert.deepEqual(state.folders, [{ id: childId, name: 'Independent child', parentId: null }]);
  assert.equal(state.deletedFolderTrees[0].rootId, parentId);
  state = await restoreFolder(host, state, parentId, 'Parent');
  assert.equal(state.folders.length, 2);
}));

test('v3 rejects cross-tree identities, disconnected trees and invalid source references; total limits include deleted trees', async () => fixture(async (host, root) => {
  let state = await host.request('folder.create', { name: 'Original', parentId: null });
  const folder = state.folders[0];
  state = await removeFolder(host, state, folder.id, true);
  const file = path.join(root, 'workspace.json');
  const original = JSON.parse(await readFile(file, 'utf8'));
  const tree = original.deletedFolderTrees[0];
  await host.request('workspace.close');
  const invalidCases = [
    { ...original, deletedFolderTrees: null },
    { ...original, schemaVersion: 2 },
    { ...original, deletedFolderTrees: [{ ...tree, futureMetadata: 'preserve' }] },
    { ...original, folders: [folder] },
    { ...original, deletedFolderTrees: [tree, tree] },
    { ...original, deletedFolderTrees: [{ ...tree, rootId: randomUUID() }] },
    { ...original, deletedFolderTrees: [{ ...tree, folders: [...tree.folders, { id: randomUUID(), name: 'Disconnected', parentId: null }] }] },
    { ...original, deletedFolderTrees: [{ ...tree, scripts: [{ id: randomUUID(), name: 'Outside', language: 'python', folderId: null, sourceHash: 'a'.repeat(64) }] }] }
  ];
  for (const metadata of invalidCases) {
    const bytes = JSON.stringify(metadata); await writeFile(file, bytes);
    await assert.rejects(host.request('workspace.open', { path: root, create: false }));
    assert.equal(await readFile(file, 'utf8'), bytes);
  }
  const folders = Array.from({ length: 200 }, (_, i) => ({ id: i === 0 ? folder.id : randomUUID(), name: `Folder ${i}`, parentId: i === 0 ? null : folder.id }));
  const scripts = Array.from({ length: 1000 }, (_, i) => ({ id: randomUUID(), name: `Script ${i}`, language: 'javascript', folderId: folder.id, sourceHash: 'a'.repeat(64) }));
  const full = { ...original, deletedFolderTrees: [{ rootId: folder.id, folders, scripts, deletedScripts: [] }] };
  await writeFile(file, JSON.stringify(full));
  state = await host.request('workspace.open', { path: root, create: false });
  const before = await readFile(file);
  await assert.rejects(host.request('folder.create', { name: 'Too many', parentId: null }), { code: 'limit_exceeded' });
  await assert.rejects(create(host), { code: 'limit_exceeded' });
  assert.deepEqual(await readFile(file), before);
}));

test('abrupt death around folder upgrade leaves either complete active or complete deleted subtree with source intact', async () => fixture(async (host, root) => {
  let state = await host.request('folder.create', { name: 'Original', parentId: null });
  const id = state.folders[0].id;
  for (let i = 0; i < 4; i++) {
    const created = await host.request('script.create', { name: `Script ${i}`, language: 'javascript', folderId: id });
    state = (await save(host, created.document, 'retained source 🌞')).workspace;
  }
  await host.request('workspace.close');
  const { executable, args, env } = launch();
  const writer = spawn(executable, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = once(writer, 'close'); writer.stderr.resume();
  let watcher, deadline, observed = false;
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
    const { watch } = await import('node:fs');
    watcher = watch(root, (_event, filename) => {
      if (filename?.toString().startsWith('workspace.v1.')) { observed = true; writer.kill('SIGKILL'); }
    });
    deadline = setTimeout(() => writer.kill('SIGKILL'), 5000);
    writer.stdin.write(encodeFrame({ version: 1, id: randomUUID(), method: 'folder.delete', params: { id, expectedRevision: state.revision, allowUpgrade: true } }));
    await closed; watcher.close(); clearTimeout(deadline);
    assert.equal(observed, true, 'Test must observe upgrade backup activity before terminating');
    const recovered = await host.request('workspace.open', { path: root, create: false });
    if (recovered.schemaVersion === 1) {
      assert.deepEqual(recovered.folders, state.folders); assert.deepEqual(recovered.scripts, state.scripts);
      assert.deepEqual(recovered.deletedFolderTrees, []);
    } else {
      assert.equal(recovered.schemaVersion, 3); assert.deepEqual(recovered.folders, []); assert.deepEqual(recovered.scripts, []);
      assert.equal(recovered.deletedFolderTrees.length, 1);
      assert.deepEqual(recovered.deletedFolderTrees[0].folders, state.folders);
      assert.deepEqual(recovered.deletedFolderTrees[0].scripts, state.scripts);
    }
    for (const script of state.scripts) assert.equal(await readFile(source(root, script), 'utf8'), 'retained source 🌞');
  } finally { watcher?.close(); clearTimeout(deadline); writer.kill(); await closed; }
}));

const classifyScript = (host, state, id, tags, favourite, allowUpgrade = false) => host.request('script.classify', {
  id, tags, favourite, expectedRevision: state.revision, allowUpgrade
});

test('tags/favourites migrate every script partition explicitly from v1/v2/v3 with exact checkpoints and no source writes', async () => {
  for (const schema of [1, 2, 3]) await fixture(async (host, root) => {
    const active = await create(host);
    let state = active.workspace;
    if (schema >= 2) {
      const deleted = await host.request('script.create', { name: 'Deleted', language: 'python', folderId: null });
      state = await removeScript(host, deleted.workspace, deleted.document, true);
    }
    if (schema === 3) {
      state = await host.request('folder.create', { name: 'Trash tree', parentId: null });
      const folderId = state.folders[0].id;
      const inside = await host.request('script.create', { name: 'Inside', language: 'csharp', folderId });
      const alreadyDeleted = await host.request('script.create', { name: 'Already deleted', language: 'python', folderId });
      state = await removeScript(host, alreadyDeleted.workspace, alreadyDeleted.document);
      state = await removeFolder(host, state, folderId, true);
      assert.equal(state.deletedFolderTrees[0].scripts[0].id, inside.document.id);
    }
    assert.equal(state.schemaVersion, schema);
    const file = path.join(root, 'workspace.json'), before = await readFile(file);
    const sourceBefore = await readFile(source(root, state.scripts[0]));
    await assert.rejects(classifyScript(host, state, active.document.id, ['Utilities', 'বাংলা'], true), { code: 'upgrade_required' });
    assert.deepEqual(await readFile(file), before);
    state = await classifyScript(host, state, active.document.id, ['Utilities', 'বাংলা'], true, true);
    assert.equal(state.schemaVersion, 4);
    assert.deepEqual(await readFile(path.join(root, `workspace.v${schema}.${hash(before)}.json`)), before);
    assert.deepEqual(await readFile(source(root, state.scripts[0])), sourceBefore);
    assert.deepEqual(state.scripts[0].classification, { tags: ['Utilities', 'বাংলা'], favourite: true });
    const others = [...state.deletedScripts, ...state.deletedFolderTrees.flatMap(t => [...t.scripts, ...t.deletedScripts])];
    for (const script of others) assert.deepEqual(script.classification, { tags: [], favourite: false });
    await host.request('workspace.close');
    state = await host.request('workspace.open', { path: root, create: false });
    assert.deepEqual((await host.request('script.read', { id: active.document.id })).classification, state.scripts[0].classification);
  });
});

test('classification survives content saves, independent script/folder copies and script/folder recycle/restore without downgrading v4', async () => fixture(async (host, root) => {
  let state = await host.request('folder.create', { name: 'Original', parentId: null });
  const folderId = state.folders[0].id;
  const initial = await host.request('script.create', { name: 'Labelled', language: 'javascript', folderId });
  state = await classifyScript(host, initial.workspace, initial.document.id, ['shared', 'work'], true, true);
  const expected = state.scripts[0].classification;
  const saved = await save(host, initial.document, 'source preserved', { name: 'Renamed', language: 'python' });
  assert.deepEqual(saved.document.classification, expected);
  const copy = await duplicate(host, saved.document, 'Copy');
  assert.deepEqual(copy.document.classification, expected);
  state = await classifyScript(host, copy.workspace, copy.document.id, ['independent'], false);
  assert.deepEqual(state.scripts.find(s => s.id === initial.document.id).classification, expected);
  const folderCopy = await duplicateFolder(host, state, folderId, 'Folder copy');
  const copiedLabelled = folderCopy.workspace.scripts.find(s => s.folderId === folderCopy.folderId && s.name === 'Renamed');
  assert.deepEqual(copiedLabelled.classification, expected);
  state = await removeScript(host, folderCopy.workspace, saved.document);
  assert.equal(state.schemaVersion, 4); assert.deepEqual(state.deletedScripts[0].classification, expected);
  state = await removeFolder(host, state, folderId);
  assert.equal(state.schemaVersion, 4);
  assert.deepEqual(state.deletedFolderTrees[0].deletedScripts[0].classification, expected);
  await host.request('workspace.close');
  state = await host.request('workspace.open', { path: root, create: false });
  state = await restoreFolder(host, state, folderId, 'Restored');
  assert.equal(state.schemaVersion, 4);
  state = await restoreScript(host, state, state.deletedScripts[0]);
  assert.deepEqual(state.scripts.find(s => s.id === saved.document.id).classification, expected);
  const newScript = await host.request('script.create', { name: 'Default labels', language: 'csharp', folderId: null });
  assert.deepEqual(newScript.document.classification, { tags: [], favourite: false });
  assert.equal(await readFile(source(root, state.scripts.find(s => s.id === saved.document.id)), 'utf8'), 'source preserved');
}));

test('classification rejects invalid tags, stale metadata, backup conflict and exhausted revisions without changing source/manifest', async () => fixture(async (host, root) => {
  const initial = await create(host);
  const file = path.join(root, 'workspace.json'), before = await readFile(file);
  for (const tags of [['a', 'A'], [''], [' padded'], ['a,b'], ['x'.repeat(41)], Array.from({ length: 17 }, (_, i) => `tag${i}`)]) {
    await assert.rejects(classifyScript(host, initial.workspace, initial.document.id, tags, true, true));
    assert.deepEqual(await readFile(file), before);
  }
  await assert.rejects(classifyScript(host, { ...initial.workspace, revision: 0 }, initial.document.id, ['valid'], true, true), { code: 'conflict' });
  const backup = path.join(root, `workspace.v1.${hash(before)}.json`);
  await writeFile(backup, 'unrelated');
  await assert.rejects(classifyScript(host, initial.workspace, initial.document.id, ['valid'], true, true), { code: 'conflict' });
  assert.deepEqual(await readFile(file), before); assert.equal(await readFile(backup, 'utf8'), 'unrelated');
  // A flushed checkpoint and partial temp from an interrupted upgrade are safe to reopen.
  await writeFile(backup, before); await writeFile(path.join(root, 'workspace.json.tags.tmp'), '{partial');
  await host.request('workspace.close');
  let state = await host.request('workspace.open', { path: root, create: false });
  const sourceFile = source(root, state.scripts[0]); await writeFile(sourceFile, 'external source');
  state = await classifyScript(host, state, initial.document.id, ['valid'], true, true);
  assert.equal(await readFile(sourceFile, 'utf8'), 'external source', 'Metadata classification must never overwrite external source');
  const metadata = JSON.parse(await readFile(file, 'utf8')); metadata.name = 'External metadata';
  await writeFile(file, JSON.stringify(metadata));
  await assert.rejects(classifyScript(host, state, initial.document.id, [], false), { code: 'conflict' });
  metadata.revision = Number.MAX_SAFE_INTEGER; await writeFile(file, JSON.stringify(metadata));
  state = await host.request('workspace.open', { path: root, create: false });
  const exhausted = await readFile(file);
  await assert.rejects(classifyScript(host, state, initial.document.id, [], false), { code: 'invalid_workspace' });
  assert.deepEqual(await readFile(file), exhausted);
}));

test('v4 fails closed on missing/unknown classifications including recycle partitions; old schema cannot silently drop classification fields', async () => fixture(async (host, root) => {
  const initial = await create(host);
  let state = await classifyScript(host, initial.workspace, initial.document.id, ['tag'], true, true);
  const file = path.join(root, 'workspace.json'), original = JSON.parse(await readFile(file, 'utf8'));
  await host.request('workspace.close');
  const script = original.scripts[0];
  const cases = [
    { ...original, schemaVersion: 3 },
    { ...original, scripts: [{ ...script, classification: null }] },
    { ...original, scripts: [{ ...script, classification: { tags: ['tag'] } }] },
    { ...original, scripts: [{ ...script, classification: { tags: ['tag'], favourite: true, future: 'keep' } }] },
    { ...original, scripts: [], deletedScripts: [{ ...script, classification: null }] },
    { ...original, schemaVersion: 3, scripts: [{ ...script, classification: null }] }
  ];
  const missing = structuredClone(original); delete missing.scripts[0].classification; cases.push(missing);
  for (const metadata of cases) {
    const bytes = JSON.stringify(metadata); await writeFile(file, bytes);
    await assert.rejects(host.request('workspace.open', { path: root, create: false }));
    assert.equal(await readFile(file, 'utf8'), bytes);
  }
}));
