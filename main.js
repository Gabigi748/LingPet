const { app, BrowserWindow, Tray, Menu, screen, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');

const fs = require('fs');

let mainWindow = null;
let tray = null;

// Load config from config.json
function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  const examplePath = path.join(__dirname, 'config.example.json');
  if (!fs.existsSync(configPath)) {
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, configPath);
    } else {
      return { api: {}, pet: {}, voice: {} };
    }
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

let config = loadConfig();

function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: config.pet?.width || 400,
    height: config.pet?.height || 600,
    x: screenW - (config.pet?.width || 400) - 20,
    y: screenH - (config.pet?.height || 600) - 20,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.setIgnoreMouseEvents(false);

  ipcMain.on('set-ignore-mouse', (_, ignore) => {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  });

  // Chat API handler
  ipcMain.handle('chat', async (_, message, history) => {
    return callAPI(message, history);
  });

  // Config handlers
  ipcMain.handle('get-config', () => config);
  ipcMain.handle('save-config', (_, newConfig) => {
    config = newConfig;
    const configPath = path.join(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  });

  // Emotion artwork handlers
  ipcMain.handle('list-emotions', () => {
    const dir = path.join(__dirname, 'assets');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
      .map(f => ({ name: f.replace(/\.[^.]+$/, ''), file: f }));
  });

  ipcMain.handle('get-asset-path', (_, filename) => {
    return path.join(__dirname, 'assets', filename);
  });
}

function callAPI(message, history = []) {
  return new Promise((resolve, reject) => {
    const emotionInstruction = '\n\nIMPORTANT: Start every reply with an emotion tag in brackets. Available emotions: [happy] [sad] [angry] [shy] [surprised] [thinking] [sleepy] [neutral]. Example: "[happy] 好開心呀！". Always include exactly one tag at the very start.';

    const messages = [
      { role: 'system', content: (config.pet?.systemPrompt || 'You are a helpful desktop pet.') + emotionInstruction },
      ...history,
      { role: 'user', content: message },
    ];

    const body = JSON.stringify({
      model: config.api?.model || 'gpt-4',
      messages,
      max_tokens: 1024,
    });

    const url = new URL((config.api?.baseUrl || 'http://localhost:3000') + '/v1/chat/completions');
    const mod = url.protocol === 'https:' ? https : http;

    const req = mod.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api?.apiKey || ''}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const reply = json.choices?.[0]?.message?.content || '（小澪沒聽懂...）';
          resolve(reply);
        } catch (e) {
          reject('回覆解析失敗');
        }
      });
    });

    req.on('error', (e) => reject(e.message));
    req.write(body);
    req.end();
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'default.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: '顯示小澪', click: () => mainWindow.show() },
    { label: '設定', click: () => mainWindow.webContents.send('open-settings') },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setToolTip('小澪桌寵');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', (e) => e.preventDefault());
