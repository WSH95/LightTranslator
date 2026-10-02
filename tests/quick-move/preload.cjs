const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nativeResize', dimensions => ipcRenderer.invoke('qa-resize-window', dimensions));
