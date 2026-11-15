const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('astelvo', Object.freeze({
  hostInfo: () => ipcRenderer.invoke('astelvo:host-info'),
  confirmClassificationUpgrade: () => ipcRenderer.invoke('astelvo:confirm-classification-upgrade'),
  confirmDiscard: () => ipcRenderer.invoke('astelvo:confirm-discard'),
  confirmDeleteFolder: upgrade => ipcRenderer.invoke('astelvo:confirm-delete-folder', upgrade),
  confirmDeleteScript: upgrade => ipcRenderer.invoke('astelvo:confirm-delete-script', upgrade),
  workspace: Object.freeze({
    create: () => ipcRenderer.invoke('astelvo:choose-workspace', true),
    open: () => ipcRenderer.invoke('astelvo:choose-workspace', false),
    close: () => ipcRenderer.invoke('astelvo:workspace-command', 'workspace.close', {}),
    createFolder: input => ipcRenderer.invoke('astelvo:workspace-command', 'folder.create', input),
    renameFolder: input => ipcRenderer.invoke('astelvo:workspace-command', 'folder.rename', input),
    moveFolder: input => ipcRenderer.invoke('astelvo:workspace-command', 'folder.move', input),
    duplicateFolder: input => ipcRenderer.invoke('astelvo:workspace-command', 'folder.duplicate', input),
    deleteFolder: input => ipcRenderer.invoke('astelvo:workspace-command', 'folder.delete', input),
    restoreFolder: input => ipcRenderer.invoke('astelvo:workspace-command', 'folder.restore', input),
    classifyScript: input => ipcRenderer.invoke('astelvo:workspace-command', 'script.classify', input),
    createScript: input => ipcRenderer.invoke('astelvo:workspace-command', 'script.create', input),
    readScript: id => ipcRenderer.invoke('astelvo:workspace-command', 'script.read', { id }),
    duplicateScript: input => ipcRenderer.invoke('astelvo:workspace-command', 'script.duplicate', input),
    deleteScript: input => ipcRenderer.invoke('astelvo:workspace-command', 'script.delete', input),
    restoreScript: input => ipcRenderer.invoke('astelvo:workspace-command', 'script.restore', input),
    saveScript: input => ipcRenderer.invoke('astelvo:workspace-command', 'script.save', input)
  })
}));
