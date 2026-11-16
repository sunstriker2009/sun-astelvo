import assert from 'node:assert/strict';
import path from 'node:path';
import { rmSync } from 'node:fs';
import { registerHooks } from 'node:module';

// Electron finishes importing its ESM entry before releasing native app startup.
// Model that ordering while evaluating the actual production entry module.
const source = `
  import { EventEmitter } from 'node:events';
  import { mkdtempSync } from 'node:fs';
  import { tmpdir } from 'node:os';
  import path from 'node:path';
  export const profileRoot = mkdtempSync(path.join(tmpdir(), 'workbench-startup-'));
  import { pathToFileURL } from 'node:url';
  export let windowCreated = false;
  export let pageLoaded = false;
  export let lastWindow;
  let ready = false;
  let release;
  const readiness = new Promise(resolve => { release = resolve; });
  export const app = Object.assign(new EventEmitter(), {
    commandLine: { hasSwitch: () => false },
    whenReady: () => readiness,
    getPath(name) { if (name !== 'appData') throw new Error('Unexpected path'); return profileRoot; },
    setPath(name, value) { if (name !== 'userData') throw new Error('Unexpected path'); this.profilePath = value; },
    setName(value) { this.productName = value; }, setAppUserModelId() {}, quit() {},
    exit(code) { throw new Error('Unexpected startup exit ' + code); },
    releaseReady() { ready = true; release(); }
  });
  export const session = { defaultSession: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } };
  export const ipcMain = Object.assign(new EventEmitter(), { handle() {} });
  export const dialog = { showMessageBoxSync() { return 1; }, async showOpenDialog() { return { canceled: true, filePaths: [] }; } };
  export class BrowserWindow extends EventEmitter {
    constructor() {
      super(); lastWindow = this; this.destroyed = false; this.requests = [];
      if (!ready) throw new Error('Window created before app readiness');
      windowCreated = true;
      this.webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler() {}, mainFrame: {url: ''}, send: (channel, id) => this.requests.push({channel, id}) });
    }
    async loadFile(file) { this.webContents.mainFrame.url = pathToFileURL(file).href; pageLoaded = true; }
    isDestroyed() { return this.destroyed; }
    close() {
      const event = { prevented: false, preventDefault() { this.prevented = true; } };
      this.emit('close', event);
      if (!event.prevented) { this.destroyed = true; this.emit('closed'); }
    }
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
assert.equal(electron.app.productName, 'WORKBENCH by Sun');
assert.equal(electron.app.profilePath, path.join(electron.profileRoot, 'ASTELVO by Sun'));
assert.equal(electron.windowCreated, false);
electron.app.releaseReady();
await new Promise(resolve => setImmediate(resolve));
assert.equal(electron.windowCreated, true);
assert.equal(electron.pageLoaded, true);
const window = electron.lastWindow;
const event = {sender: window.webContents, senderFrame: window.webContents.mainFrame};
window.close();
assert.equal(window.isDestroyed(), false);
assert.equal(window.requests.length, 1);
assert.equal(window.requests[0].channel, 'astelvo:prepare-close');
window.close(); assert.equal(window.requests.length, 1, 'Repeated closes share one preparation');
electron.ipcMain.emit('astelvo:prepared-close', event, 'wrong-id', true);
assert.equal(window.isDestroyed(), false);
electron.ipcMain.emit('astelvo:prepared-close', {...event, sender: {}}, window.requests[0].id, true);
assert.equal(window.isDestroyed(), false, 'Untrusted acknowledgement is ignored');
electron.ipcMain.emit('astelvo:prepared-close', event, window.requests[0].id, false);
assert.equal(window.isDestroyed(), false, 'Failed flush keeps the window open');
window.close(); assert.equal(window.requests.length, 2);
electron.ipcMain.emit('astelvo:prepared-close', event, window.requests[0].id, true);
assert.equal(window.isDestroyed(), false, 'Superseded acknowledgement cannot close a later attempt');
electron.ipcMain.emit('astelvo:prepared-close', event, window.requests[1].id, true);
assert.equal(window.isDestroyed(), true);
rmSync(electron.profileRoot, { recursive: true, force: true });
console.log('Entry import finished before readiness; window/page startup followed readiness.');
