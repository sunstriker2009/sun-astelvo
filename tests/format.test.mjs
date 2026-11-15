import test from 'node:test';
import assert from 'node:assert/strict';
import { formatJavascript, handleFormatRequest } from '../ui/javascript-formatter.ts';
import { FormatClient } from '../ui/format-client.ts';
import { maxFormatBytes } from '../ui/format-contract.ts';

test('bundled JavaScript formatting is deterministic and maps the primary cursor without executing source', async () => {
  const code = 'globalThis.astelvoFormatExecuted=true;const result={name:"SUN",values:[1,2,3]};';
  const result = await formatJavascript(code, code.indexOf('result'));
  assert.equal(result.formatted, 'globalThis.astelvoFormatExecuted = true;\nconst result = { name: "SUN", values: [1, 2, 3] };\n');
  assert.ok(result.formatted.slice(result.cursorOffset).startsWith('result'));
  assert.equal(globalThis.astelvoFormatExecuted, undefined);
  assert.deepEqual(await formatJavascript(result.formatted, result.cursorOffset), result);
});

test('formatting retains BOM, shebang, Unicode, comments, string/template content and CRLF convention', async () => {
  const input = '\ufeff#!/usr/bin/env node\r\n// বাংলা 🌞\r\nconst greeting={text:"hello",raw:`<DIV> ${1+2}</DIV>`};\r\n';
  const result = await formatJavascript(input, input.indexOf('greeting'));
  assert.ok(result.formatted.startsWith('\ufeff#!/usr/bin/env node\r\n// বাংলা 🌞\r\n'));
  assert.ok(result.formatted.includes('`<DIV> ${1 + 2}</DIV>`'), 'Only JavaScript expression is formatted; no HTML plugin is loaded');
  assert.ok(!result.formatted.replaceAll('\r\n', '').includes('\n'));
  assert.ok(result.formatted.slice(result.cursorOffset).startsWith('greeting'));
});

test('formatter rejects syntax, invalid cursor/UTF-8 and byte limits including oversized formatted output', async () => {
  await assert.rejects(formatJavascript('const = ;', 0), /Unexpected token/);
  for (const [content, cursor] of [['x', -1], ['x', 2], ['x', 0.5], ['\ud800', 0], ['é'.repeat(maxFormatBytes), 0]])
    await assert.rejects(formatJavascript(content, cursor), /valid cursor/);
  const maximum = '//' + 'a'.repeat(maxFormatBytes - 3) + '\n';
  assert.equal((await formatJavascript(maximum, 0)).formatted, maximum);
  await assert.rejects(formatJavascript('//' + 'a'.repeat(maxFormatBytes - 2), 0), /Formatted output exceeds/);
});

test('formatter worker accepts only exact bounded requests and returns bounded syntax diagnostics', async () => {
  const request = {id: 1, content: 'let x=1', cursorOffset: 0};
  assert.equal((await handleFormatRequest(request)).formatted, 'let x = 1;\n');
  for (const bad of [null, [], {...request, path: '/not-authorized'}, {...request, id: '1'}, {...request, id: 0}, {...request, cursorOffset: 100}])
    assert.equal((await handleFormatRequest(bad)).ok, false);
  const error = await handleFormatRequest({...request, content: 'const = ;'});
  assert.equal(error.id, 1); assert.equal(error.ok, false); assert.ok(error.message.length <= 400); assert.ok(!error.message.includes('\n'));
});

class FakeWorker {
  onmessage = null; onerror = null; onmessageerror = null;
  terminated = 0; messages = [];
  postMessage(value) { this.messages.push(value); }
  terminate() { this.terminated++; }
  reply(value) { this.onmessage?.({data: value}); }
}
const factory = () => { const workers = []; return {workers, create: () => { const worker = new FakeWorker(); workers.push(worker); return worker; }}; };

test('format client correlates results, prevents overlap, terminates workers and discards late cancelled replies', async () => {
  const f = factory(), client = new FormatClient(f.create);
  const first = client.format('x', 0), cancelledWorker = f.workers[0], late = cancelledWorker.onmessage;
  await assert.rejects(client.format('y', 0), /already in progress/);
  assert.equal(client.cancel(), true); assert.equal(client.cancel(), false); await assert.rejects(first, {code: 'cancelled'}); assert.equal(cancelledWorker.terminated, 1);
  const second = client.format('y', 0), worker = f.workers[1];
  late({data: {id: 1, ok: true, formatted: 'stale;\n', cursorOffset: 0}});
  worker.reply({id: worker.messages[0].id, ok: true, formatted: 'y;\n', cursorOffset: 1});
  assert.deepEqual(await second, {formatted: 'y;\n', cursorOffset: 1}); assert.equal(worker.terminated, 1);
  assert.equal(worker.onmessage, null); assert.equal(client.cancel(), false, 'Completed formatting cannot be reported as cancelled');
});

test('format client rejects malformed/error/oversized responses and disposes workers on timeout/startup failure', async () => {
  for (const reply of [{id: 99, ok: true, formatted: 'x', cursorOffset: 0}, {id: 1, ok: true, formatted: 'x', cursorOffset: 2},
    {id: 1, ok: true, formatted: 'x', cursorOffset: 0, extra: true}, {id: 1, ok: true, formatted: 'é'.repeat(maxFormatBytes), cursorOffset: 0},
    {id: 1, ok: false, message: 'Syntax failure'}, {id: 1, ok: false, message: '', extra: true}]) {
    const f = factory(), client = new FormatClient(f.create), result = client.format('x', 0);
    f.workers[0].reply(reply); await assert.rejects(result); assert.equal(f.workers[0].terminated, 1);
  }
  const timed = factory(); await assert.rejects(new FormatClient(timed.create, 25).format('x', 0), /timed out/); assert.equal(timed.workers[0].terminated, 1);
  for (const event of ['onerror', 'onmessageerror']) {
    const f = factory(), client = new FormatClient(f.create), result = client.format('x', 0);
    f.workers[0][event](); await assert.rejects(result); assert.equal(f.workers[0].terminated, 1);
  }
  const failed = new FakeWorker(); failed.postMessage = () => { throw new Error('Unavailable'); };
  await assert.rejects(new FormatClient(() => failed).format('x', 0), /could not start/); assert.equal(failed.terminated, 1);
  await assert.rejects(new FormatClient(() => { throw new Error('Missing worker'); }).format('x', 0), /Missing worker/);
});
