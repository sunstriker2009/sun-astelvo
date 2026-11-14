import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HostClient } from './host-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = path.join(root, 'dist/index.html');
const trustedUrl = pathToFileURL(page).href;
let host;
let quitting = false;

await app.whenReady();
session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
session.defaultSession.setPermissionCheckHandler(() => false);
const window = new BrowserWindow({
  width: 1280, height: 820, minWidth: 900, minHeight: 600,
  title: 'ASTELVO by Sun', backgroundColor: '#0B1020',
  webPreferences: { preload: path.join(root, 'desktop/preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true }
});
window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
window.webContents.on('will-navigate', event => event.preventDefault());
window.webContents.on('will-attach-webview', event => event.preventDefault());
ipcMain.handle('astelvo:host-info', async event => {
  if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== trustedUrl) throw new Error('Untrusted sender');
  try {
    if (!host) host = new HostClient('dotnet', [path.join(root, 'src/Sun.Workspace.Host/bin/Release/net10.0/Sun.Workspace.Host.dll')]);
    return { ok: true, info: await host.info() };
  } catch { return { ok: false, message: 'Host unavailable. Build the .NET host, then restart ASTELVO.' }; }
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (!quitting && host) {
    event.preventDefault(); quitting = true;
    void host.close().finally(() => app.quit());
  }
});
await window.loadFile(page);
