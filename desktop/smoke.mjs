import assert from 'node:assert/strict';
import { app, BrowserWindow } from 'electron';
const deadline = setTimeout(() => { console.error('Desktop smoke timed out; graphical environment or startup unavailable.'); app.exit(1); }, 15000);
try {
  await import('./main.mjs');
  const window = BrowserWindow.getAllWindows()[0];
  const result = await window.webContents.executeJavaScript(`(async () => {
    const deadline = Date.now() + 10000;
    while (!document.querySelector('.monaco-editor')) {
      if (Date.now() > deadline) throw new Error('Monaco did not mount');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return { nodeDisabled: typeof window.require === 'undefined', host: await window.astelvo.hostInfo() };
  })()`);
  assert.equal(result.nodeDisabled, true);
  assert.equal(result.host.ok, true);
  assert.equal(result.host.info.product, 'ASTELVO');
  console.log('Desktop smoke passed: Monaco mounted, renderer Node disabled, real host IPC passed.');
} catch (error) { console.error(error); process.exitCode = 1; }
finally { clearTimeout(deadline); app.quit(); }
