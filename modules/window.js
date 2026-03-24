const { BrowserWindow, screen, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const { getConfig, saveConfig } = require('./config');
const { listEmotionFiles, getAssetPath } = require('./emotions');
const { callAPI, callAPIWithImage } = require('./api');

let mainWindow = null;
const positionFile = path.join(__dirname, '..', '.window-position.json');

function saveWindowPosition(x, y) {
  try { fs.writeFileSync(positionFile, JSON.stringify({ x, y })); } catch {}
}

function loadWindowPosition() {
  try { return JSON.parse(fs.readFileSync(positionFile, 'utf8')); } catch { return null; }
}

function getWindow() {
  return mainWindow;
}

function createWindow() {
  const config = getConfig();
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const savedPos = loadWindowPosition();
  const defaultX = screenW - (config.pet?.width || 400) - 20;
  const defaultY = screenH - (config.pet?.height || 600) - 20;

  mainWindow = new BrowserWindow({
    width: config.pet?.width || 400,
    height: config.pet?.height || 600,
    x: savedPos?.x ?? defaultX,
    y: savedPos?.y ?? defaultY,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  setupIPC();
  return mainWindow;
}

function setupIPC() {
  // Mouse pass-through toggle
  ipcMain.on('set-ignore-mouse', (_, ignore) => {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  });

  // Window drag
  let dragOffset = null;
  ipcMain.on('start-drag', () => {
    const [wx, wy] = mainWindow.getPosition();
    const cursor = require('electron').screen.getCursorScreenPoint();
    dragOffset = { x: cursor.x - wx, y: cursor.y - wy };
  });

  ipcMain.on('drag-move', (_, x, y) => {
    if (dragOffset) {
      mainWindow.setPosition(x - dragOffset.x, y - dragOffset.y);
    }
  });

  ipcMain.on('drag-end', () => {
    dragOffset = null;
    const [x, y] = mainWindow.getPosition();
    saveWindowPosition(x, y);
  });

  // Chat
  ipcMain.handle('chat', async (_, message, history) => {
    return callAPI(message, history);
  });

  ipcMain.handle('chat-with-image', async (_, message, imageDataUrl) => {
    return callAPIWithImage(message, imageDataUrl);
  });

  // Config
  ipcMain.handle('get-config', () => getConfig());
  ipcMain.handle('save-config', (_, newConfig) => saveConfig(newConfig));

  // Emotions
  ipcMain.handle('list-emotions', () => listEmotionFiles());
  ipcMain.handle('get-asset-path', (_, filename) => getAssetPath(filename));

  // Screenshot
  ipcMain.handle('capture-screen', async () => {
    console.log('[ScreenWatch] Capturing screen...');
    if (mainWindow) mainWindow.hide();
    await new Promise(r => setTimeout(r, 150));

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 },
    });

    if (mainWindow) mainWindow.showInactive();

    if (sources.length > 0) {
      const dataUrl = sources[0].thumbnail.toDataURL();
      console.log('[ScreenWatch] Screenshot captured, size:', dataUrl.length);
      return dataUrl;
    }
    return null;
  });
}

module.exports = { createWindow, getWindow };
