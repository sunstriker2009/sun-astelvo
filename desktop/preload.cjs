const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('astelvo', Object.freeze({
  hostInfo: () => ipcRenderer.invoke('astelvo:host-info'),
  confirmDiscard: () => ipcRenderer.invoke('astelvo:confirm-discard'),
  workspace: Object.freeze({
    create: () => ipcRenderer.invoke('astelvo:choose-workspace', true),
    open: () => ipcRenderer.invoke('astelvo:choose-workspace', false),
    close: () => ipcRenderer.invoke('astelvo:workspace-command', 'workspace.close', {}),
    createFolder: input => ipcRenderer.invoke('astelvo:workspace-command', 'folder.create', input),
    renameFolder: input => ipcRenderer.invoke('astelvo:workspace-command', 'folder.rename', input),
    moveFolder: input => ipcRenderer.invoke('astelvo:workspace-command', 'folder.move', input),
    duplicateFolder: input => ipcRenderer.invoke('astelvo:workspace-command', 'folder.duplicate', input),
    createScript: input => ipcRenderer.invoke('astelvo:workspace-command', 'script.create', input),
    readScript: id => ipcRenderer.invoke('astelvo:workspace-command', 'script.read', { id }),
    duplicateScript: input => ipcRenderer.invoke('astelvo:workspace-command', 'script.duplicate', input),
    saveScript: input => ipcRenderer.invoke('astelvo:workspace-command', 'script.save', input)
  })
}));
