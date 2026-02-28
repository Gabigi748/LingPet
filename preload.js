const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mio', {
  onOpenSettings: (cb) => ipcRenderer.on('open-settings', cb),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  chat: (message, history) => ipcRenderer.invoke('chat', message, history),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
});
