const { app } = require('electron');
const { loadConfig } = require('./modules/config');
const { scanEmotions } = require('./modules/emotions');
const { createWindow } = require('./modules/window');
const { createTray } = require('./modules/tray');

// Initialize
loadConfig();
scanEmotions();

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', (e) => e.preventDefault());
