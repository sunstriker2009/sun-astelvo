import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import os from 'node:os';
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
  const exit = once(child, 'close'); child.stdin.end(Buffer.from([0,0,16,1]));
  const [code] = await exit; assert.equal(code, 2); assert.equal(count, 0);
});
