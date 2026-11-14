import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Electron finishes importing its ESM entry before releasing native app startup.
// Model that ordering while evaluating the actual production entry module.
const source = `
  import { EventEmitter } from 'node:events';
  export let windowCreated = false;
  export let pageLoaded = false;
  let ready = false;
  let release;
  const readiness = new Promise(resolve => { release = resolve; });
  export const app = Object.assign(new EventEmitter(), {
    commandLine: { hasSwitch: () => false },
    whenReady: () => readiness,
    setName() {}, setAppUserModelId() {}, quit() {},
    exit(code) { throw new Error('Unexpected startup exit ' + code); },
    releaseReady() { ready = true; release(); }
  });
  export const session = { defaultSession: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } };
  export const ipcMain = { handle() {} };
  export class BrowserWindow {
    constructor() {
      if (!ready) throw new Error('Window created before app readiness');
      windowCreated = true;
      this.webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler() {} });
    }
    async loadFile() { pageLoaded = true; }
  }
`;
registerHooks({
  resolve(specifier, context, next) {
    return specifier === 'electron' ? { url: 'astelvo-test:electron', shortCircuit: true } : next(specifier, context);
  },
  load(url, context, next) {
    return url === 'astelvo-test:electron' ? { format: 'module', source, shortCircuit: true } : next(url, context);
  }
});
const electron = await import('electron');
await import('../desktop/main.mjs');
assert.equal(electron.windowCreated, false);
electron.app.releaseReady();
await new Promise(resolve => setImmediate(resolve));
assert.equal(electron.windowCreated, true);
assert.equal(electron.pageLoaded, true);
console.log('Entry import finished before readiness; window/page startup followed readiness.');
