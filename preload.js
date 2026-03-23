const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mio', {
  onOpenSettings: (cb) => ipcRenderer.on('open-settings', cb),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  chat: (message, history) => ipcRenderer.invoke('chat', message, history),
  chatWithImage: (message, imageDataUrl) => ipcRenderer.invoke('chat-with-image', message, imageDataUrl),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  listEmotions: () => ipcRenderer.invoke('list-emotions'),
  getAssetPath: (filename) => ipcRenderer.invoke('get-asset-path', filename),
  startDrag: () => ipcRenderer.send('start-drag'),
  dragMove: (x, y) => ipcRenderer.send('drag-move', x, y),
  dragEnd: () => ipcRenderer.send('drag-end'),
  setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
  toggleMini: () => ipcRenderer.send('toggle-mini'),
  onMiniModeChanged: (cb) => ipcRenderer.on('mini-mode-changed', (_, isMini) => cb(isMini)),
});
