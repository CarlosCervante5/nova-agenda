const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posDesktop', {
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
  },
  setup: {
    complete: () => ipcRenderer.invoke('setup:complete'),
    restart: () => ipcRenderer.invoke('setup:restart'),
  },
  printer: {
    list: () => ipcRenderer.invoke('printer:list'),
    test: (name) => ipcRenderer.invoke('printer:test', name),
    installXprinter: () => ipcRenderer.invoke('printer:installXprinter'),
    printReceipt: (data) => ipcRenderer.invoke('printer:printReceipt', data),
  },
  openExternal: (url) => ipcRenderer.invoke('openExternal', url),
  platform: process.platform,
});
