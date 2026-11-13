import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { HostClient } from '../desktop/host-client.mjs';
const dll = 'src/Sun.Workspace.Host/bin/Release/net10.0/Sun.Workspace.Host.dll';
test('real host correlates concurrent requests and exits when input closes', async () => {
  const client = new HostClient(process.env.ASTELVO_DOTNET ?? 'dotnet', [dll]);
  try { const results = await Promise.all([client.info(), client.info()]); for (const result of results) assert.equal(result.protocol, 1); }
  finally { await client.close(); }
  await assert.rejects(client.info(), /disconnected/);
});
test('real host rejects oversized input without writing a response', async () => {
  const child = spawn(process.env.ASTELVO_DOTNET ?? 'dotnet', [dll], { stdio: ['pipe','pipe','pipe'] });
  let count = 0; child.stdout.on('data', chunk => count += chunk.length); child.stderr.resume();
  const exit = once(child, 'close'); child.stdin.end(Buffer.from([0,0,16,1]));
  const [code] = await exit; assert.equal(code, 2); assert.equal(count, 0);
});
