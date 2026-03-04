const { app, BrowserWindow, Tray, Menu, screen, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');

const fs = require('fs');

let mainWindow = null;
let tray = null;
const positionFile = path.join(__dirname, '.window-position.json');

// Save/load window position
function saveWindowPosition(x, y) {
  try { fs.writeFileSync(positionFile, JSON.stringify({ x, y })); } catch {}
}
function loadWindowPosition() {
  try { return JSON.parse(fs.readFileSync(positionFile, 'utf8')); } catch { return null; }
}

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  // Default: click-through mode (mouse passes to windows below)
  // Renderer toggles this on hover over interactive elements
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  ipcMain.on('set-ignore-mouse', (_, ignore) => {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  });

  // Window drag handler
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
    // Save window position
    const [x, y] = mainWindow.getPosition();
    saveWindowPosition(x, y);
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

  // Screenshot capture - get window titles for screen awareness
  ipcMain.handle('capture-screen', async () => {
    console.log('[ScreenWatch] Capturing screen...');
    
    // Hide window before capture so pet doesn't appear in screenshot
    if (mainWindow) mainWindow.hide();
    await new Promise(r => setTimeout(r, 150)); // wait for hide to apply
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 },
    });
    
    // Restore window
    if (mainWindow) mainWindow.showInactive();
    
    if (sources.length > 0) {
      const dataUrl = sources[0].thumbnail.toDataURL();
      console.log('[ScreenWatch] Screenshot captured, size:', dataUrl.length);
      return dataUrl;
    }
    console.log('[ScreenWatch] No screen source found');
    return null;
  });

  // Chat with image (for screen recognition)
  ipcMain.handle('chat-with-image', async (_, message, imageDataUrl) => {
    return callAPIWithImage(message, imageDataUrl);
  });
}

function callAPI(message, history = []) {
  return new Promise((resolve, reject) => {
    const isGateway = (config.api?.endpoint || '').includes('gateway');

    let body;
    if (isGateway) {
      // Gateway mode: send full history so the model remembers context
      const emotionInstruction = '\n\nIMPORTANT RULES for this reply:\n1. Do NOT use [sticker:] tags (like [sticker:heart_eyes_cat])\n2. Start every reply with EXACTLY ONE emotion tag from this list ONLY: [happy] [sad] [angry] [shy] [surprised] [thinking] [sleepy] [neutral] [confused] [serious]\n3. Do NOT use any other emotion names like [question_anime], [pitiful_cat], [shocked_cat], etc.\n4. Example: "[happy] 好開心呀！"\n5. Keep replies concise, plain text only.';
      body = JSON.stringify({
        model: config.api?.model || 'gpt-4',
        messages: [
          { role: 'system', content: (config.pet?.systemPrompt || 'You are a helpful desktop pet.') + emotionInstruction },
          ...history,
          { role: 'user', content: message },
        ],
        max_tokens: 1024,
      });
    } else {
      // Direct API mode: send full history
      const emotionInstruction = '\n\nIMPORTANT: Start every reply with an emotion tag in brackets. Available emotions ONLY: [happy] [sad] [angry] [shy] [surprised] [thinking] [sleepy] [neutral] [confused] [serious]. Do NOT use other names like [question_anime], [pitiful_cat], [shocked_cat]. Example: "[happy] 好開心呀！". Always include exactly one tag from the list at the very start.';
      body = JSON.stringify({
        model: config.api?.model || 'gpt-4',
        messages: [
          { role: 'system', content: (config.pet?.systemPrompt || 'You are a helpful desktop pet.') + emotionInstruction },
          ...history,
          { role: 'user', content: message },
        ],
        max_tokens: 1024,
      });
    }

    const endpoint = config.api?.endpoint || '/v1/chat/completions';
    const url = new URL((config.api?.baseUrl || 'http://localhost:3000') + endpoint);
    const mod = url.protocol === 'https:' ? https : http;

    const headers = {
      'Content-Type': 'application/json',
    };
    // Only add Authorization if apiKey is set
    if (config.api?.apiKey) {
      headers['Authorization'] = `Bearer ${config.api.apiKey}`;
    }
    // Add user header for OpenClaw gateway session routing
    if (config.api?.user) {
      headers['X-User'] = config.api.user;
    }

    const req = mod.request(url, {
      method: 'POST',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          let reply = json.choices?.[0]?.message?.content || '（小澪沒聽懂...）';
          // Remove [sticker:xxx] tags for desktop pet
          reply = reply.replace(/\[sticker:[^\]]+\]/g, '').trim();
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

// Call API with image - bypasses gateway, calls provider directly
function callAPIWithImage(message, imageDataUrl) {
  return new Promise((resolve, reject) => {
    const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const mediaType = imageDataUrl.match(/^data:(image\/\w+);/)?.[1] || 'image/png';

    const providerBase = config.api?.providerUrl || config.api?.baseUrl || 'https://www.fucheers.top';
    const apiFormat = config.api?.apiFormat || 'anthropic';
    const isAnthropic = apiFormat === 'anthropic';

    const targetUrl = providerBase + (isAnthropic ? '/v1/messages' : '/v1/chat/completions');
    console.log('[ScreenWatch] Calling vision API:', targetUrl, '(format:', apiFormat + ')');
    console.log('[ScreenWatch] Using model:', config.api?.model || 'claude-opus-4-6');
    console.log('[ScreenWatch] API key set:', !!(config.api?.apiKey));

    const descPrompt = 'Describe what you see on this screen in 1-2 sentences in Traditional Chinese. Be brief and factual.';
    const model = config.api?.model || 'claude-opus-4-6';

    let body;
    if (isAnthropic) {
      body = JSON.stringify({
        model,
        system: descPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: descPrompt }
          ],
        }],
        max_tokens: 150,
      });
    } else {
      // OpenAI format
      body = JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
            { type: 'text', text: descPrompt }
          ],
        }],
        max_tokens: 150,
      });
    }

    const url = new URL(targetUrl);
    const mod = url.protocol === 'https:' ? https : http;

    const headers = { 'Content-Type': 'application/json' };
    if (isAnthropic) headers['anthropic-version'] = '2023-06-01';
    if (config.api?.apiKey) {
      headers['x-api-key'] = config.api.apiKey;
      headers['Authorization'] = `Bearer ${config.api.apiKey}`;
    }

    const req = mod.request(url, { method: 'POST', headers }, (res) => {
      let data = '';
      console.log('[ScreenWatch] Vision API response status:', res.statusCode);
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('[ScreenWatch] Vision API raw response:', data.substring(0, 200));
        try {
          const json = JSON.parse(data);
          let text = null;
          if (isAnthropic) {
            // Anthropic: find text block (skip thinking blocks)
            const textBlock = json.content?.find(b => b.type === 'text');
            text = textBlock?.text || null;
          } else {
            // OpenAI: choices[0].message.content
            text = json.choices?.[0]?.message?.content || null;
          }
          resolve(text);
        } catch { resolve(null); }
      });
    });
    req.on('error', (e) => {
      console.log('[ScreenWatch] Vision API error:', e.message);
      resolve(null);
    });
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
