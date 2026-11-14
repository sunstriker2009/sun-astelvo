import { app, BrowserWindow, ipcMain, session } from 'electron';
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
  ipcMain.handle('astelvo:host-info', async event => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== trustedUrl) throw new Error('Untrusted sender');
    try {
      if (smoke) report('requesting host information');
      if (!host) {
        const launch = hostLaunch({ appRoot: root, resourcesPath: process.resourcesPath, isPackaged: app.isPackaged });
        host = new HostClient(launch.executable, launch.args);
      }
      return { ok: true, info: await host.info() };
    } catch { return { ok: false, message: app.isPackaged ? 'Bundled host unavailable. Extract the complete portable folder and restart ASTELVO.' : 'Host unavailable. Build the .NET host, then restart ASTELVO.' }; }
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (!quitting && host) {
      event.preventDefault(); quitting = true;
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
