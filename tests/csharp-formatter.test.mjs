import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CsharpFormatter } from '../desktop/csharp-formatter.mjs';
const input = {content: 'class A{}', cursorOffset: 0};
const result = {formatted: 'class A { }', cursorOffset: 0};
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
test('native formatting waits for verified exit; cancellation during cleanup suppresses the result', async () => {
  const exit = deferred(); let stopped = 0;
  const manager = new CsharpFormatter(() => ({}), () => ({request: async () => result, terminate: () => { stopped++; return exit.promise; }}));
  const pending = manager.format(input); const rejected = assert.rejects(pending, {code: 'cancelled'});
  await Promise.resolve();
  await assert.rejects(manager.format(input), {code:'busy'});
  const cancel = manager.cancel(); exit.resolve(); await cancel; await rejected;
  assert.equal(stopped, 1); assert.equal(await manager.cancel(), false);
});
test('native formatting preserves errors, validates input, and blocks reuse if cleanup is unverified', async () => {
  let created = 0;
  const manager = new CsharpFormatter(() => ({}), () => {created++; return {request: async () => result, terminate: async () => {throw Object.assign(new Error('cleanup failed'),{code:'cleanup_failed'});}};});
  await assert.rejects(manager.format({...input, path:'untrusted'})); assert.equal(created,0);
  for (const bad of [{content:'\ud800',cursorOffset:0},{...input,cursorOffset:-1},{...input,cursorOffset:100}]) await assert.rejects(manager.format(bad));
  assert.equal(created,0);
  await assert.rejects(manager.format(input), {code:'cleanup_failed'});
  await assert.rejects(manager.format(input), {code:'busy'});
  const syntax = new CsharpFormatter(() => ({}), () => ({request: async () => {throw Object.assign(new Error('syntax'),{code:'syntax_error'});}, terminate:async()=>{}}));
  await assert.rejects(syntax.format(input), {code:'syntax_error'});
  assert.equal(await syntax.cancel(),false);
});
test('real owned process is reaped on deadline and cancellation and allows a fresh job', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'astelvo-format-process-'));
  const pidPath = path.join(root,'pid');
  const manager = new CsharpFormatter(() => ({executable:process.execPath,args:['tests/fake-format-host.mjs'],env:{...process.env, ASTELVO_TEST_PID_FILE:pidPath}}), undefined, 1200);
  const gone = async () => {const pid=Number(await readFile(pidPath,'utf8')); assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});};
  try {
    await assert.rejects(manager.format(input), {code:'timed_out'}); await gone();
    const pending=manager.format(input); const rejected=assert.rejects(pending,{code:'cancelled'});
    // Wait for this job's actual startup, rather than merely a timer firing.
    const previous=await readFile(pidPath,'utf8');
    for(let attempt=0;attempt<100;attempt++) {if(await readFile(pidPath,'utf8')!==previous)break; await new Promise(r=>setTimeout(r,10));}
    assert.notEqual(await readFile(pidPath,'utf8'),previous);
    assert.equal(await manager.cancel(),true); await rejected; await gone();
    assert.equal(await manager.cancel(),false);
  } finally {await manager.cancel().catch(()=>{});await rm(root,{recursive:true,force:true});}
});
