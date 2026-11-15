import assert from 'node:assert/strict';

export async function verifyDesktop(window, { packaged }) {
  const preferences = window.webContents.getLastWebPreferences();
  assert.equal(preferences.sandbox, true);
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.nodeIntegration, false);
  assert.equal(preferences.webSecurity, true);
  const result = await window.webContents.executeJavaScript(`(async () => {
    const deadline = Date.now() + 10000;
    while (!document.querySelector('.monaco-editor .view-lines')) {
      if (Date.now() > deadline) throw new Error('Monaco did not mount');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return {
      nodeDisabled: typeof window.require === 'undefined' && typeof window.process === 'undefined',
      bridge: Object.keys(window.astelvo),
      workspaceMethods: Object.keys(window.astelvo.workspace),
      host: await window.astelvo.hostInfo()
    };
  })()`);
  assert.equal(result.nodeDisabled, true);
  assert.deepEqual(result.bridge.sort(), ['cancelCsharpFormat', 'confirmClassificationUpgrade', 'confirmCollectionsUpgrade', 'confirmDeleteCollection', 'confirmDeleteFolder', 'confirmDeleteScript', 'confirmDiscard', 'confirmDiscardRecovery', 'formatCsharp', 'hostInfo', 'onPrepareClose', 'workspace']);
  assert.deepEqual(result.workspaceMethods.sort(), ['classifyScript', 'clearRecovery', 'close', 'create', 'createCollection', 'createFolder', 'createScript', 'deleteCollection', 'deleteFolder', 'deleteScript', 'duplicateFolder', 'duplicateScript', 'exportArchive', 'importScripts', 'moveFolder', 'open', 'readRecovery', 'readScript', 'renameFolder', 'restoreArchive', 'restoreFolder', 'restoreScript', 'saveScript', 'searchSource', 'updateCollection', 'writeRecovery']);
  assert.equal(result.host.ok, true, result.host.message);
  assert.equal(result.host.info.product, 'ASTELVO');
  assert.equal(result.host.info.protocol, 1);
  console.log(`Desktop smoke passed (${packaged ? 'packaged' : 'development'}): Monaco, renderer isolation, real host IPC.`);
}
