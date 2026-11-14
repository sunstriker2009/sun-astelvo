import { app, BrowserWindow, ipcMain, session, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HostClient } from './host-client.mjs';
import { hostLaunch } from './launch-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = path.join(root, 'dist/index.html');
const trustedUrl = pathToFileURL(page).href;
let host;
let quitting = false;
const smoke = app.commandLine.hasSwitch('astelvo-smoke');
let phase = 'entry loaded; waiting for app readiness';
function report(next) { phase = next; if (smoke) console.log(`[desktop-smoke] ${phase}`); }
report(phase);
const deadline = smoke ? setTimeout(() => {
  console.error(`Desktop smoke timed out at: ${phase}`);
  app.exit(1);
}, 20000) : undefined;
app.setName('ASTELVO by Sun');
if (process.platform === 'win32') app.setAppUserModelId('Sun.ASTELVO');

async function startDesktop() {
  report('app ready; creating window');
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const window = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    title: 'ASTELVO by Sun', backgroundColor: '#0B1020',
    icon: path.join(root, 'dist/icon.png'),
    webPreferences: { preload: path.join(root, 'desktop/preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true }
  });
  if (smoke) {
    window.webContents.on('preload-error', (_event, _file, error) => console.error('[desktop-smoke] preload failed:', error.message));
    window.webContents.on('did-fail-load', (_event, code, description) => console.error(`[desktop-smoke] renderer load failed: ${code} ${description}`));
    window.webContents.on('render-process-gone', (_event, details) => report(`renderer exited: ${details.reason} (${details.exitCode})`));
  }
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  function trusted(event) {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame?.url !== trustedUrl) throw new Error('Untrusted sender');
  }
  function getHost() {
    if (!host) {
      const launch = hostLaunch({ appRoot: root, resourcesPath: process.resourcesPath, isPackaged: app.isPackaged });
      host = new HostClient(launch.executable, launch.args);
    }
    return host;
  }
  async function command(method, params) {
    try { return { ok: true, value: await getHost().request(method, params) }; }
    catch (error) { return { ok: false, code: error.code ?? 'host_error', message: error.message }; }
  }
  function discard() {
    return dialog.showMessageBoxSync(window, { type: 'question', title: 'Unsaved script', message: 'Discard unsaved script changes?', detail: 'Choose Cancel to return to the editor and save or copy your changes.', buttons: ['Discard changes', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true }) === 0;
  }
  window.webContents.on('will-prevent-unload', event => { if (discard()) event.preventDefault(); });
  ipcMain.handle('astelvo:confirm-discard', event => { trusted(event); return discard(); });
  let choosing = false;
  ipcMain.handle('astelvo:choose-workspace', async (event, create) => {
    trusted(event);
    if (typeof create !== 'boolean' || choosing) return { ok: false, code: 'invalid_request', message: 'A folder selection is already in progress.' };
    choosing = true;
    try {
      const selection = await dialog.showOpenDialog(window, { title: create ? 'Create workspace in an empty folder' : 'Open ASTELVO workspace', properties: ['openDirectory', 'createDirectory'] });
      if (selection.canceled || selection.filePaths.length !== 1) return { ok: false, code: 'cancelled', message: 'Selection cancelled.' };
      return await command('workspace.open', { path: selection.filePaths[0], create });
    } finally { choosing = false; }
  });
  ipcMain.handle('astelvo:workspace-command', async (event, method, params) => {
    trusted(event);
    // Paths and executables cannot be supplied through this renderer channel.
    if (!['workspace.close', 'folder.create', 'folder.rename', 'script.create', 'script.read', 'script.save'].includes(method))
      return { ok: false, code: 'invalid_request', message: 'Unsupported workspace operation.' };
    return command(method, params);
  });
  ipcMain.handle('astelvo:host-info', async event => {
    trusted(event);
    try {
      if (smoke) report('requesting host information');
      return { ok: true, info: await getHost().info() };
    } catch { return { ok: false, message: app.isPackaged ? 'Bundled host unavailable. Extract the complete portable folder and restart ASTELVO.' : 'Host unavailable. Build the .NET host, then restart ASTELVO.' }; }
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (!quitting && host) {
      event.preventDefault();
      // Closing the window runs its unsaved-buffer guard before releasing the
      // workspace lease. A cancelled quit must leave the host usable.
      if (!window.isDestroyed()) { window.close(); return; }
      quitting = true;
      void host.close().finally(() => app.quit());
    }
  });
  try {
    report('loading renderer page');
    await window.loadFile(page);
    report('renderer page loaded');
    if (smoke) {
      const { verifyDesktop } = await import('./smoke-check.mjs');
      report('checking Monaco, renderer isolation and host IPC');
      await verifyDesktop(window, { packaged: app.isPackaged });
      report('checks passed; stopping host');
      if (host) await host.close();
      clearTimeout(deadline);
      app.exit(0);
    }
  } catch (error) {
    await failStartup(error);
  }
}

async function failStartup(error) {
  console.error(`Desktop startup failed at: ${phase}`, error);
  if (host) await host.close();
  clearTimeout(deadline);
  app.exit(1);
}

// Finish evaluating this ESM entry so Electron can release its ready event.
// Top-level awaiting readiness creates an import/readiness cycle.
void app.whenReady().then(startDesktop).catch(failStartup);
