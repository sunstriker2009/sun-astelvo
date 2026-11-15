import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import os from 'node:os';
import { MAX_FRAME } from '../desktop/protocol.mjs';
import { HostClient } from '../desktop/host-client.mjs';
const dll = 'src/Sun.Workspace.Host/bin/Release/net10.0/Sun.Workspace.Host.dll';
const executable = process.env.ASTELVO_HOST_EXECUTABLE ?? process.env.ASTELVO_DOTNET ?? 'dotnet';
const args = process.env.ASTELVO_HOST_EXECUTABLE ? [] : [dll];
const env = { ...process.env };
if (process.env.ASTELVO_HOST_EXECUTABLE) {
  for (const key of Object.keys(env)) if (key.toUpperCase() === 'PATH') delete env[key];
  env.PATH = '';
  env.DOTNET_ROOT = path.join(os.tmpdir(), 'astelvo-no-installed-runtime');
}
test('real host correlates concurrent requests and exits when input closes', async () => {
  const client = new HostClient(executable, args, { env });
  try { const results = await Promise.all([client.info(), client.info()]); for (const result of results) assert.equal(result.protocol, 1); }
  finally { await client.close(); }
  await assert.rejects(client.info(), /disconnected/);
});
test('real host rejects oversized input without writing a response', async () => {
  const child = spawn(executable, args, { env, stdio: ['pipe','pipe','pipe'] });
  let count = 0; child.stdout.on('data', chunk => count += chunk.length); child.stderr.resume();
  const exit = once(child, 'close'); const header = Buffer.alloc(4); header.writeUInt32BE(MAX_FRAME + 1); child.stdin.end(header);
  const [code] = await exit; assert.equal(code, 2); assert.equal(count, 0);
});

// The formatter uses the very same deployed executable, but no workspace session.
import { CsharpFormatter } from '../desktop/csharp-formatter.mjs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
const formatter = () => new CsharpFormatter(() => ({executable, args, env}));
test('bundled Roslyn formats without running source, preserves trivia and maps cursor deterministically', async () => {
  const manager = formatter();
  const source = '\ufeffusing System;\r\n// বাংলা 🌞\r\nthrow new Exception("must never run");\r\nvar values=new[]{1,2};\r\n';
  const result = await manager.format({content:source,cursorOffset:source.indexOf('values')});
  assert.ok(result.formatted.startsWith('\ufeffusing System;\r\n// বাংলা 🌞\r\n'));
  assert.ok(result.formatted.includes('var values = new[] { 1, 2 };'));
  assert.ok(result.formatted.slice(result.cursorOffset).startsWith('values'));
  assert.ok(!result.formatted.replaceAll('\r\n','').includes('\n'));
  assert.deepEqual(await manager.format({content:result.formatted,cursorOffset:result.cursorOffset}),result);
});
test('formatter rejects syntax and byte limits and never acquires the workspace lease', async () => {
  const manager=formatter();
  await assert.rejects(manager.format({content:'class {',cursorOffset:0}),{code:'syntax_error'});
  await assert.rejects(manager.format({content:'é'.repeat(256*1024),cursorOffset:0}));
  // Whitespace expansion beyond the portable source bound must not escape it.
  const tail='\nclass A{int x=1;}';
  const large='//'+'a'.repeat(256*1024-2-tail.length)+tail;
  await assert.rejects(manager.format({content:large,cursorOffset:0}),{code:'limit_exceeded'});
  const root=await mkdtemp(path.join(os.tmpdir(),'astelvo-format-isolation-'));
  const client=new HostClient(executable,[...args,'--format-csharp'],{env});
  try {
    await assert.rejects(client.request('workspace.open',{path:root,create:true}),{code:'invalid_request'});
    assert.deepEqual(await readdir(root),[]);
  } finally {await client.terminate();await rm(root,{recursive:true,force:true});}
  const workspace = new HostClient(executable,args,{env});
  try {await assert.rejects(workspace.request('format.csharp',{content:'class A{}',cursorOffset:0}));assert.equal((await workspace.info()).protocol,1);}
  finally {await workspace.close();}
});
