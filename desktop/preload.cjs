const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('astelvo', Object.freeze({
  hostInfo: () => ipcRenderer.invoke('astelvo:host-info')
}));
