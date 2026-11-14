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
  async function select(label, text) {
    await js(`(() => {
      const field = Array.from(document.querySelectorAll('label')).find(l => l.textContent.startsWith(${JSON.stringify(label)})).querySelector('select');
      field.value = Array.from(field.options).find(o => o.textContent === ${JSON.stringify(text)}).value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
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
    assert.equal(await js("Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Duplicate script').disabled"), true, 'Duplication must require a saved buffer');
    assert.equal(await js("Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Duplicate folder').disabled"), true, 'Folder duplication must require saved open edits');
    // Move a parent while its script buffer is dirty. No editor discard or
    // source write is needed for a logical folder move.
    const beforeMove = JSON.parse(await readFile(path.join(root, 'workspace.json'), 'utf8'));
    await click('All scripts');
    await js("Array.from(document.querySelectorAll('summary')).find(s => s.textContent === 'New folder').click()");
    await input('New folder', 'Archive'); await click('Add folder');
    await js("Array.from(document.querySelectorAll('summary')).find(s => s.textContent === 'New folder').click()");
    await click('Utilities');
    await js("Array.from(document.querySelectorAll('summary')).find(s => s.textContent === 'Move selected folder').click()");
    assert.equal(await js("Array.from(Array.from(document.querySelectorAll('label')).find(l => l.textContent.startsWith('Destination folder')).querySelector('select').options).some(o => o.textContent === 'Utilities')"), false, 'Move targets must exclude the selected folder');
    await select('Destination folder', 'Archive');
    const movePrompts = prompts;
    await click('Move folder');
    await wait("!!Array.from(document.querySelectorAll('.folder')).find(b => b.textContent === 'Archive / Utilities')", 'folder moved');
    assert.equal(prompts, movePrompts, 'Moving a folder must not prompt to discard the script buffer');
    assert.equal(await js("!!document.querySelector('.unsaved')"), true, 'Folder move must preserve dirty buffer');
    assert.equal(await js("document.querySelector('.view-lines').textContent.replaceAll(String.fromCharCode(160), ' ').includes('unsaved edit')"), true);
    const afterMove = JSON.parse(await readFile(path.join(root, 'workspace.json'), 'utf8'));
    assert.deepEqual(afterMove.scripts, beforeMove.scripts, 'Folder move must not save or relocate script sources');
    await select('Destination folder', 'Workspace root'); await click('Move folder');
    await wait("!!Array.from(document.querySelectorAll('.folder')).find(b => b.textContent === 'Utilities')", 'folder returned to root');
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
    assert.equal(await js("Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Duplicate script').disabled"), true, 'Duplication must require adoption of external edits');
    // Reloaded external bytes are already on disk; adopting them into a new
    // revision must be possible without first modifying the editor again.
    await click('Save');
    await wait("document.querySelector('[role=status]').textContent === 'Saved.'", 'external revision adoption');
    await input('Script name', 'Renamed greeting'); await click('Save');
    await wait("!!Array.from(document.querySelectorAll('.script')).find(b => b.textContent.includes('Renamed greeting'))", 'script rename');
    await js("Array.from(document.querySelectorAll('summary')).find(s => s.textContent === 'Duplicate current script').click()");
    const beforeCopy = await readFile(path.join(root, 'workspace.json'), 'utf8');
    await input('Copy name', 'Renamed greeting'); await click('Duplicate script');
    await wait("!!document.querySelector('.error')", 'duplicate name conflict');
    assert.equal(await readFile(path.join(root, 'workspace.json'), 'utf8'), beforeCopy, 'Failed duplicate must not rewrite metadata');
    assert.equal(await js("document.querySelector('[aria-label=\"Script name\"]').value"), 'Renamed greeting');
    await input('Copy name', 'Greeting copy'); await select('Copy destination', 'Workspace root'); await click('Duplicate script');
    await wait("document.querySelector('[aria-label=\"Script name\"]').value === 'Greeting copy'", 'duplicate opened');
    assert.equal(await js("document.querySelector('.view-lines').textContent.replaceAll(String.fromCharCode(160), ' ').includes('external accepted')"), true);
    const copied = JSON.parse(await readFile(path.join(root, 'workspace.json'), 'utf8'));
    const copy = copied.scripts.find(s => s.name === 'Greeting copy');
    assert.notEqual(copy.id, source.id);
    assert.equal(copy.folderId, null);
    assert.deepEqual(copied.scripts.find(s => s.id === source.id), JSON.parse(beforeCopy).scripts.find(s => s.id === source.id));
    await click('Close workspace');
    await wait("document.querySelector('.workspace-title').textContent === 'No workspace open'", 'close duplicated workspace');
    await click('Open workspace');
    await wait("!!Array.from(document.querySelectorAll('.script')).find(b => b.textContent.includes('Greeting copy'))", 'reopen copy list');
    await js("Array.from(document.querySelectorAll('.script')).find(b => b.textContent.includes('Greeting copy')).click()");
    await wait("document.querySelector('[aria-label=\"Script name\"]').value === 'Greeting copy'", 'reopen copied script');
    assert.equal((await js(`window.astelvo.workspace.readScript(${JSON.stringify(copy.id)})`)).value.content, 'console.log("external accepted");');
    await click('Utilities');
    await js("Array.from(document.querySelectorAll('summary')).find(s => s.textContent === 'Duplicate selected folder').click()");
    const beforeFolderCopy = await readFile(path.join(root, 'workspace.json'), 'utf8');
    await input('Folder copy name', 'Utilities'); await click('Duplicate folder');
    await wait("!!document.querySelector('.error')", 'folder copy name conflict');
    assert.equal(await readFile(path.join(root, 'workspace.json'), 'utf8'), beforeFolderCopy);
    await input('Folder copy name', 'Utilities copy'); await select('Folder copy destination', 'Archive'); await click('Duplicate folder');
    await wait("!!Array.from(document.querySelectorAll('.folder')).find(b => b.textContent === 'Archive / Utilities copy' && b.getAttribute('aria-pressed') === 'true')", 'folder copy selected');
    assert.equal(await js("document.querySelector('[aria-label=\"Script name\"]').value"), 'Greeting copy', 'Folder copy must retain the current editor');
    const afterFolderCopy = JSON.parse(await readFile(path.join(root, 'workspace.json'), 'utf8'));
    const copiedFolder = afterFolderCopy.folders.find(f => f.name === 'Utilities copy');
    const copiedScript = afterFolderCopy.scripts.find(s => s.folderId === copiedFolder.id);
    assert.notEqual(copiedScript.id, source.id);
    assert.deepEqual(afterFolderCopy.scripts.filter(s => s.id !== copiedScript.id), JSON.parse(beforeFolderCopy).scripts);
    await click('Close workspace');
    await wait("document.querySelector('.workspace-title').textContent === 'No workspace open'", 'close folder copied workspace');
    await click('Open workspace');
    await click('Archive / Utilities copy');
    await js("Array.from(document.querySelectorAll('.script')).find(b => b.textContent.includes('Renamed greeting')).click()");
    await wait("document.querySelector('[aria-label=\"Script name\"]').value === 'Renamed greeting'", 'open folder copied script');
    assert.equal((await js(`window.astelvo.workspace.readScript(${JSON.stringify(copiedScript.id)})`)).value.content, 'console.log("external accepted");');
    await mkdir('artifacts/diagnostics', { recursive: true });
    await writeFile('artifacts/diagnostics/workspace-editor.png', (await window.webContents.capturePage()).toPNG());
    await click('Close workspace');
    await wait("document.querySelector('.workspace-title').textContent === 'No workspace open'", 'lease release');
    await rm(root, { recursive: true, force: true });
    clearTimeout(deadline);
    console.log('Workspace editor smoke passed: folder move/copy and script duplicate conflicts/reopen, keyboard save, external adoption, dirty duplication guards and cancelled-quit preservation.');
    app.quit();
  } catch (error) {
    console.error(`Workspace editor smoke failed at ${stage}:`, error);
    try { if (!window.isDestroyed()) await js('window.astelvo.workspace.close()'); } catch { }
    await rm(root, { recursive: true, force: true }).catch(() => {});
    clearTimeout(deadline); app.exit(1);
  }
}).catch(error => { console.error(error); clearTimeout(deadline); app.exit(1); });
