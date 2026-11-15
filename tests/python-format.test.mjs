import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm, access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {initializePython, formatPython, handlePythonRequest, pythonCursor} from '../ui/python-formatter.ts';
import {FormatClient} from '../ui/format-client.ts';
import {maxFormatBytes} from '../ui/format-contract.ts';
import {Workspace} from '@astral-sh/ruff-wasm-web';
const init = async () => initializePython(new Uint8Array(await readFile(new URL('../node_modules/@astral-sh/ruff-wasm-web/ruff_wasm_bg.wasm', import.meta.url))));

test('Python formatter fails closed before initialization and recovers after invalid WASM bytes', async () => {
  assert.throws(() => formatPython('x=1', 0), /unavailable/);
  assert.throws(() => initializePython(new Uint8Array([0,1,2])));
  await init(); assert.equal(Workspace.version(), '0.17.5');
  assert.equal(formatPython("values={'x':[1,2]}\n", 0).formatted, 'values = {"x": [1, 2]}\n');
});

test('pinned Ruff output is deterministic, preserves envelope/text and never executes Python source', async () => {
  await init();
  const area = await mkdtemp(path.join(os.tmpdir(), 'astelvo-format-python-'));
  try {
    const marker = path.join(area, 'must-not-execute');
    const source = `__import__('pathlib').Path(${JSON.stringify(marker)}).write_text('executed')\nvalues={'name':'বাংলা 🌞','items':[1,2]}\n`;
    const result = formatPython(source, source.indexOf('values'));
    assert.ok(result.formatted.includes('values = {"name": "বাংলা 🌞", "items": [1, 2]}'));
    await assert.rejects(access(marker), {code: 'ENOENT'});
    assert.deepEqual(formatPython(result.formatted, result.cursorOffset), result);
    const envelope = '\ufeff#!/usr/bin/env python3\r\n# বাংলা 🌞\r\nvalue={"text":"héllo"}\r\n';
    const formatted = formatPython(envelope, 0).formatted;
    assert.ok(formatted.startsWith('\ufeff#!/usr/bin/env python3\r\n# বাংলা 🌞\r\n'));
    assert.ok(!formatted.replaceAll('\r\n', '').includes('\n'));
    assert.ok(formatted.includes('"héllo"'));
  } finally { await rm(area, {recursive: true, force: true}); }
});

test('Python syntax, cursor/Unicode and input/output limits reject without partial results', async () => {
  await init();
  assert.throws(() => formatPython('def broken(:\n    pass\n', 0));
  for (const [content, offset] of [['x', -1], ['x', 2], ['\ud800', 0], ['é'.repeat(maxFormatBytes), 0]])
    assert.throws(() => formatPython(content, offset), /valid cursor/);
  const maximum = '# ' + 'a'.repeat(maxFormatBytes - 3) + '\n';
  assert.equal(formatPython(maximum, 0).formatted, maximum);
  assert.throws(() => formatPython('#' + 'a'.repeat(maxFormatBytes - 1), 0), /Formatted output exceeds/);
});

test('Python worker validates requests before initialization and bounds initialization/syntax failures', async () => {
  let initialized = 0;
  for (const bad of [null, [], {id: 1, content: 'x', cursorOffset: 0, path: '/not-authorized'}, {id: 1, content: 'x', cursorOffset: 2}]) {
    assert.equal((await handlePythonRequest(bad, () => {initialized++;})).ok, false);
  }
  assert.equal(initialized, 0);
  const failed = await handlePythonRequest({id: 1, content: 'x', cursorOffset: 0}, () => {throw new Error('WASM unavailable\nprivate detail');});
  assert.deepEqual(failed, {id: 1, ok: false, message: 'WASM unavailable'});
  await init();
  const syntax = await handlePythonRequest({id: 2, content: 'def (: ', cursorOffset: 0}, () => {});
  assert.equal(syntax.id, 2); assert.equal(syntax.ok, false); assert.ok(syntax.message.length > 0 && syntax.message.length <= 400); assert.ok(!syntax.message.includes('\n'));
});

test('Python cursor retains unchanged prefix/suffix and clamps changed line/column positions', () => {
  assert.equal(pythonCursor('x=1\n# tail', 'x = 1\n# tail', 0), 0);
  assert.equal(pythonCursor('x=1\n# tail', 'x = 1\n# tail', 8), 10);
  const before = 'def f(): return {"x":1}\n', after = 'def f():\n    return {"x": 1}\n';
  for (let i = 0; i <= before.length; i++) {
    const offset = pythonCursor(before, after, i);
    assert.ok(Number.isInteger(offset) && offset >= 0 && offset <= after.length);
  }
});

test('format client selects the Python worker, preserves language diagnostics and cancels/times out either language', async () => {
  class Worker {
    onmessage = null; onerror = null; onmessageerror = null; stopped = 0;
    postMessage(value) {this.request = value;}
    terminate() {this.stopped++;}
  }
  const workers = [], languages = [];
  const client = new FormatClient(language => {languages.push(language); const worker = new Worker(); workers.push(worker); return worker;}, 25);
  const pending = client.format('x=1', 0, 'python');
  workers[0].onerror(); await assert.rejects(pending, /Python formatter unavailable/); assert.equal(workers[0].stopped, 1);
  const cancelled = client.format('x=1', 0, 'python'); client.cancel(); await assert.rejects(cancelled, {code: 'cancelled'}); assert.equal(workers[1].stopped, 1);
  const timeout = client.format('x=1', 0, 'python'); await assert.rejects(timeout, /timed out/); assert.equal(workers[2].stopped, 1);
  const js = client.format('x=1', 0); workers[3].onmessage({data: {id: workers[3].request.id, ok: true, formatted: 'x = 1;\n', cursorOffset: 0}}); await js;
  assert.deepEqual(languages, ['python', 'python', 'python', 'javascript']);
  await assert.rejects(client.format('x', 0, 'csharp'), /unavailable/);
});
