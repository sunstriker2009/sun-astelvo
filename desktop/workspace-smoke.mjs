// Development acceptance entry only; excluded from portable production assets.
// Native dialogs are replaced here solely to select an isolated temporary folder.
import assert from 'node:assert/strict';
import { app, BrowserWindow, dialog } from 'electron';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(os.tmpdir(), 'astelvo-editor-smoke-'));
let allowDiscard = false;
let prompts = 0;
let stage = 'startup';
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] });
dialog.showMessageBoxSync = () => { prompts++; return allowDiscard ? 0 : 1; };
const deadline = setTimeout(() => { console.error(`Workspace smoke timed out: ${stage}`); app.exit(1); }, 30000);
await import('./main.mjs');

// Never hold ESM entry evaluation open while waiting for Electron readiness.
void app.whenReady().then(async () => {
  const window = BrowserWindow.getAllWindows()[0];
  const js = code => window.webContents.executeJavaScript(code);
  async function wait(expression, label) {
    stage = label;
    const end = Date.now() + 5000;
    while (!await js(expression)) {
      if (Date.now() > end) throw new Error(`Timed out: ${label}; ${await js("JSON.stringify({error:document.querySelector('.error')?.textContent, status:document.querySelector('footer')?.textContent, active:document.activeElement?.className, editor:document.querySelector('.view-lines')?.textContent})")}`);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  async function click(label) {
    await wait(`Array.from(document.querySelectorAll('button')).some(b => b.textContent === ${JSON.stringify(label)} && !b.disabled)`, 'button ' + label);
    await js(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === ${JSON.stringify(label)}).click()`);
  }
  async function input(label, value) {
    await js(`(() => {
      const field = Array.from(document.querySelectorAll('label')).find(l => l.textContent.startsWith(${JSON.stringify(label)})).querySelector('input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)});
      field.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
  }
  try {
    await wait("!!document.querySelector('.monaco-editor')", 'Monaco mount');
    await click('New workspace');
    await wait("document.querySelector('.workspace-title').textContent !== 'No workspace open'", 'workspace create');
    await js("Array.from(document.querySelectorAll('summary')).find(s => s.textContent === 'New folder').click()");
    await input('New folder', 'Utilities'); await click('Add folder');
    await js("Array.from(document.querySelectorAll('summary')).find(s => s.textContent === 'New folder').click()");
    await click('Utilities');
    await js("Array.from(document.querySelectorAll('summary')).find(s => s.textContent === 'New script').click()");
    await input('New script name', 'Greeting'); await click('Create script');
    await wait("document.querySelector('[aria-label=\"Script name\"]').value === 'Greeting'", 'new script');
    await js("Array.from(document.querySelectorAll('summary')).find(s => s.textContent === 'New script').click()");
    window.focus(); window.webContents.focus();
    await js("document.querySelector('.monaco-editor .native-edit-context, .monaco-editor textarea.inputarea').focus()");
    await window.webContents.insertText('console.log("workspace smoke");');
    await wait("!!document.querySelector('.unsaved')", 'typed script');
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'S', modifiers: [process.platform === 'darwin' ? 'meta' : 'control'] });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'S', modifiers: [process.platform === 'darwin' ? 'meta' : 'control'] });
    await wait("!document.querySelector('.unsaved')", 'first save');

    window.focus(); window.webContents.focus();
    await js("document.querySelector('.monaco-editor .native-edit-context, .monaco-editor textarea.inputarea').focus()");
    await window.webContents.insertText('// unsaved edit');
    await wait("!!document.querySelector('.unsaved')", 'dirty buffer');
    const before = prompts;
    app.quit();
    const until = Date.now() + 3000;
    while (prompts === before && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 25));
    assert.ok(prompts > before, 'Quit must ask before discarding edits');
    assert.equal(window.isDestroyed(), false, 'Cancelled quit must keep the window');
    assert.equal((await js('window.astelvo.hostInfo()')).ok, true, 'Cancelled quit must keep host usable');
    assert.equal(await js("!!document.querySelector('.unsaved')"), true);

    allowDiscard = true;
    await click('Reload');
    await wait("!document.querySelector('.unsaved')", 'reload saved revision');
    await click('Close workspace');
    await wait("document.querySelector('.workspace-title').textContent === 'No workspace open'", 'close workspace');
    await click('Open workspace');
    await wait("!!Array.from(document.querySelectorAll('.script')).find(b => b.textContent.includes('Greeting'))", 'reopened script list');
    await js("Array.from(document.querySelectorAll('.script')).find(b => b.textContent.includes('Greeting')).click()");
    await wait("document.querySelector('.view-lines').textContent.replaceAll(String.fromCharCode(160), ' ').includes('workspace smoke')", 'saved content reopen');
    assert.equal(await js("document.querySelector('.view-lines').textContent.replaceAll(String.fromCharCode(160), ' ').includes('unsaved edit')"), false);
    const metadata = JSON.parse(await readFile(path.join(root, 'workspace.json'), 'utf8'));
    const source = metadata.scripts[0];
    await writeFile(path.join(root, 'scripts', source.id, source.sourceHash + '.js'), 'console.log("external accepted");');
    await click('Reload');
    await wait("document.querySelector('[role=status]').textContent.includes('External edits loaded')", 'external reload');
    // Reloaded external bytes are already on disk; adopting them into a new
    // revision must be possible without first modifying the editor again.
    await click('Save');
    await wait("document.querySelector('[role=status]').textContent === 'Saved.'", 'external revision adoption');
    await input('Script name', 'Renamed greeting'); await click('Save');
    await wait("!!Array.from(document.querySelectorAll('.script')).find(b => b.textContent.includes('Renamed greeting'))", 'script rename');
    await mkdir('artifacts/diagnostics', { recursive: true });
    await writeFile('artifacts/diagnostics/workspace-editor.png', (await window.webContents.capturePage()).toPNG());
    await click('Close workspace');
    await wait("document.querySelector('.workspace-title').textContent === 'No workspace open'", 'lease release');
    await rm(root, { recursive: true, force: true });
    clearTimeout(deadline);
    console.log('Workspace editor smoke passed: create, folder, keyboard save/reopen, external revision adoption, rename and cancelled-quit preservation.');
    app.quit();
  } catch (error) {
    console.error(`Workspace editor smoke failed at ${stage}:`, error);
    try { if (!window.isDestroyed()) await js('window.astelvo.workspace.close()'); } catch { }
    await rm(root, { recursive: true, force: true }).catch(() => {});
    clearTimeout(deadline); app.exit(1);
  }
}).catch(error => { console.error(error); clearTimeout(deadline); app.exit(1); });
