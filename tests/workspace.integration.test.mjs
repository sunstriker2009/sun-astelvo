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
