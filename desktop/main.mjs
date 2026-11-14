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
const deadline = smoke ? setTimeout(() => {
  console.error('Desktop smoke timed out; graphical environment or startup unavailable.');
  app.exit(1);
}, 20000) : undefined;
app.setName('ASTELVO by Sun');
if (process.platform === 'win32') app.setAppUserModelId('Sun.ASTELVO');

await app.whenReady();
session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
session.defaultSession.setPermissionCheckHandler(() => false);
const window = new BrowserWindow({
  width: 1280, height: 820, minWidth: 900, minHeight: 600,
  title: 'ASTELVO by Sun', backgroundColor: '#0B1020',
  icon: path.join(root, 'dist/icon.png'),
  webPreferences: { preload: path.join(root, 'desktop/preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true }
});
window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
window.webContents.on('will-navigate', event => event.preventDefault());
window.webContents.on('will-attach-webview', event => event.preventDefault());
ipcMain.handle('astelvo:host-info', async event => {
  if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== trustedUrl) throw new Error('Untrusted sender');
  try {
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
  await window.loadFile(page);
  if (smoke) {
    const { verifyDesktop } = await import('./smoke-check.mjs');
    await verifyDesktop(window, { packaged: app.isPackaged });
    if (host) await host.close();
    clearTimeout(deadline);
    app.exit(0);
  }
} catch (error) {
  console.error('Desktop startup failed.', error);
  if (host) await host.close();
  clearTimeout(deadline);
  app.exit(1);
}
