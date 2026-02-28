const petImg = document.getElementById('pet-img');
const dialogBox = document.getElementById('dialog-box');
const dialogName = document.getElementById('dialog-name');
const dialogText = document.getElementById('dialog-text');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const historyBtn = document.getElementById('history-btn');
const historyOverlay = document.getElementById('history-overlay');
const historyMessages = document.getElementById('history-messages');
const historyClose = document.getElementById('history-close');

let chatOpen = false;
let chatHistory = [];
let typingTimer = null;
let isComposing = false; // For CJK input method
let isSending = false; // Prevent double send
let lastReply = ''; // Prevent duplicate replies
const EMOTIONS = ['happy', 'sad', 'angry', 'shy', 'surprised', 'thinking', 'sleepy', 'neutral'];
const DEFAULT_EMOTION = 'neutral';

// ========== Pet Name from config ==========
(async () => {
  const cfg = await window.mio.getConfig();
  dialogName.textContent = cfg.pet?.name || 'Pet';
})();

// ========== Click vs Drag ==========
let mouseDownTime = 0;
let mouseDownPos = { x: 0, y: 0 };

petImg.addEventListener('mousedown', (e) => {
  mouseDownTime = Date.now();
  mouseDownPos = { x: e.screenX, y: e.screenY };
  window.mio.startDrag();

  const onMove = (ev) => {
    window.mio.dragMove(ev.screenX, ev.screenY);
  };
  const onUp = (ev) => {
    window.mio.dragEnd();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);

    const elapsed = Date.now() - mouseDownTime;
    const dist = Math.abs(ev.screenX - mouseDownPos.x) + Math.abs(ev.screenY - mouseDownPos.y);
    if (elapsed < 300 && dist < 10) {
      chatOpen = !chatOpen;
      dialogBox.classList.toggle('show', chatOpen);
      if (chatOpen) setTimeout(() => msgInput.focus(), 100);
    }
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});

// ========== Typewriter Effect ==========
function typewrite(text, callback) {
  if (typingTimer) clearInterval(typingTimer);
  dialogText.innerHTML = '';
  let i = 0;
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';

  typingTimer = setInterval(() => {
    if (i < text.length) {
      dialogText.textContent = text.slice(0, i + 1);
      dialogText.appendChild(cursor);
      i++;
    } else {
      clearInterval(typingTimer);
      typingTimer = null;
      cursor.remove();
      if (callback) callback();
    }
  }, 35);
}

// ========== Emotion ==========
function parseEmotion(text) {
  const match = text.match(/^\[(\w+)\]\s*/);
  if (match && EMOTIONS.includes(match[1])) {
    return { emotion: match[1], cleanText: text.slice(match[0].length) };
  }
  return { emotion: DEFAULT_EMOTION, cleanText: text };
}

// Clean internal directives from gateway responses
function cleanReply(text) {
  // Remove sticker tags like [sticker:xxx] in any format
  text = text.replace(/\[sticker\s*:\s*[\w-]+\s*\]/gi, '').trim();
  // Remove reply tags
  text = text.replace(/\[\[reply_to[^\]]*\]\]/g, '').trim();
  // Remove lines that look like internal agent instructions or errors
  const filterPatterns = [
    /^(let me |reading |Read |I'll |I need to |checking |looking |scanning |searching ).*/i,
    /^(HEARTBEAT|NO_REPLY|SOUL\.md|MEMORY\.md|AGENTS\.md|USER\.md|TOOLS\.md|HEARTBEAT\.md|IDENTITY\.md|BOOTSTRAP\.md).*/,
    /^message failed:.*/i,
    /^action send.*/i,
    /^requires a target.*/i,
    /^\[System.*/,
    /^Source: .*/,
    /^NO_REPLY$/,
    /^HEARTBEAT_OK$/,
    /^memory_search|^memory_get/,
    /tool_call|function_call/i,
    /^\*?(reads?|opens?|checks?|loads?|scans?)\s/i,
  ];
  const lines = text.split('\n');
  const cleaned = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    return !filterPatterns.some(p => p.test(trimmed));
  });
  text = cleaned.join('\n').trim();
  
  // If after cleaning, text is same as previous reply, return empty
  return text || '...';
}

let emotionTimer = null;

async function setEmotion(emotion) {
  if (emotionTimer) clearTimeout(emotionTimer);
  const assets = await window.mio.listEmotions();
  const found = assets.find(a => a.name === emotion);
  if (found) {
    const p = await window.mio.getAssetPath(found.file);
    petImg.src = p + '?t=' + Date.now();
  } else {
    const def = assets.find(a => a.name === 'default');
    if (def) {
      const p = await window.mio.getAssetPath(def.file);
      petImg.src = p + '?t=' + Date.now();
    }
  }
  petImg.classList.add('emotion-change');
  setTimeout(() => petImg.classList.remove('emotion-change'), 400);
  
  // Return to default after 5 seconds
  if (emotion !== 'default') {
    emotionTimer = setTimeout(async () => {
      const def = assets.find(a => a.name === 'default');
      if (def) {
        const p = await window.mio.getAssetPath(def.file);
        petImg.src = p + '?t=' + Date.now();
      }
    }, 5000);
  }
}

// ========== Send Message ==========
async function sendMessage(text) {
  if (!text.trim() || isSending) return;
  isSending = true;
  msgInput.value = '';

  // Add to history
  chatHistory.push({ role: 'user', content: text });

  // Show thinking
  dialogName.textContent = '...';
  dialogText.innerHTML = '<span class="typing-cursor"></span>';

  try {
    const reply = await window.mio.chat(text, chatHistory);
    const { emotion, cleanText } = parseEmotion(reply);
    const displayText = cleanReply(cleanText);

    // Skip if same as last reply (duplicate detection)
    if (displayText === lastReply && displayText !== '...') {
      isSending = false;
      return;
    }
    lastReply = displayText;

    // Get pet name
    const cfg = await window.mio.getConfig();
    dialogName.textContent = cfg.pet?.name || 'Pet';

    // Typewriter
    typewrite(displayText);
    setEmotion(emotion);

    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 30) chatHistory = chatHistory.slice(-30);
    isSending = false;
  } catch (e) {
    const cfg = await window.mio.getConfig();
    dialogName.textContent = cfg.pet?.name || 'Pet';
    typewrite('Connection failed...');
    setEmotion('sad');
    isSending = false;
  }
}

sendBtn.addEventListener('click', () => sendMessage(msgInput.value));

// Settings button in dialog
const settingsBtn = document.getElementById('settings-btn');
settingsBtn.addEventListener('click', () => openSettings());

// CJK input method composing detection
msgInput.addEventListener('compositionstart', () => { isComposing = true; });
msgInput.addEventListener('compositionend', () => { isComposing = false; });

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !isComposing) sendMessage(msgInput.value);
});

// ========== History ==========
historyBtn.addEventListener('click', () => {
  historyMessages.innerHTML = '';
  chatHistory.forEach(msg => {
    const div = document.createElement('div');
    div.className = `history-msg ${msg.role === 'user' ? 'user' : 'bot'}`;
    const { cleanText } = msg.role === 'assistant' ? parseEmotion(msg.content) : { cleanText: msg.content };
    div.innerHTML = `
      <div class="h-name">${msg.role === 'user' ? 'You' : (dialogName.textContent || 'Pet')}</div>
      <div class="h-text">${cleanText}</div>
    `;
    historyMessages.appendChild(div);
  });
  historyOverlay.classList.add('show');
  historyMessages.scrollTop = historyMessages.scrollHeight;
});

historyClose.addEventListener('click', () => {
  historyOverlay.classList.remove('show');
});

// ========== Settings ==========
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');
const settingsSave = document.getElementById('settings-save');

window.mio.onOpenSettings(() => openSettings());

async function openSettings() {
  const cfg = await window.mio.getConfig();
  document.getElementById('cfg-url').value = cfg.api?.baseUrl || '';
  document.getElementById('cfg-provider-url').value = cfg.api?.providerUrl || '';
  document.getElementById('cfg-endpoint').value = cfg.api?.endpoint || '/v1/chat/completions';
  document.getElementById('cfg-key').value = cfg.api?.apiKey || '';
  document.getElementById('cfg-model').value = cfg.api?.model || '';
  document.getElementById('cfg-user').value = cfg.api?.user || '';
  document.getElementById('cfg-name').value = cfg.pet?.name || '';
  document.getElementById('cfg-prompt').value = cfg.pet?.systemPrompt || '';
  document.getElementById('cfg-screen-enabled').checked = cfg.screenWatch?.enabled || false;
  document.getElementById('cfg-screen-interval').value = cfg.screenWatch?.intervalMin || 5;

  const assets = await window.mio.listEmotions();
  const grid = document.getElementById('emotion-grid');
  grid.innerHTML = '';
  for (const emo of EMOTIONS) {
    const item = document.createElement('div');
    item.className = 'emotion-item';
    const found = assets.find(a => a.name === emo);
    if (found) {
      const p = await window.mio.getAssetPath(found.file);
      item.innerHTML = `<img src="${p}" /><span>${emo}</span>`;
    } else {
      item.innerHTML = `<div class="no-img">?</div><span>${emo}</span>`;
    }
    grid.appendChild(item);
  }
  settingsPanel.classList.add('show');
}

settingsClose.addEventListener('click', () => settingsPanel.classList.remove('show'));

settingsSave.addEventListener('click', async () => {
  const newConfig = {
    api: {
      baseUrl: document.getElementById('cfg-url').value,
      providerUrl: document.getElementById('cfg-provider-url').value,
      endpoint: document.getElementById('cfg-endpoint').value,
      apiKey: document.getElementById('cfg-key').value,
      model: document.getElementById('cfg-model').value,
      user: document.getElementById('cfg-user').value,
    },
    pet: {
      name: document.getElementById('cfg-name').value,
      systemPrompt: document.getElementById('cfg-prompt').value,
    },
    voice: {
      enabled: true,
      lang: 'zh-TW',
    },
    screenWatch: {
      enabled: document.getElementById('cfg-screen-enabled').checked,
      intervalMin: parseInt(document.getElementById('cfg-screen-interval').value) || 5,
    },
  };
  await window.mio.saveConfig(newConfig);
  dialogName.textContent = newConfig.pet.name || 'Pet';
  
  // Toggle screen watch
  if (newConfig.screenWatch.enabled) {
    startScreenWatch();
  } else {
    stopScreenWatch();
  }
  
  settingsPanel.classList.remove('show');
});

// ========== Init ==========
// Start breathing animation
petImg.classList.add('breathing');

// Stop breathing during emotion change
const origSetEmotion = setEmotion;
setEmotion = async function(emotion) {
  petImg.classList.remove('breathing');
  await origSetEmotion(emotion);
  setTimeout(() => petImg.classList.add('breathing'), 500);
};

// ========== Screen Recognition ==========
let screenWatchInterval = null;
let screenWatchEnabled = false;

async function startScreenWatch() {
  const cfg = await window.mio.getConfig();
  const intervalMin = cfg.screenWatch?.intervalMin || 5;
  
  if (screenWatchInterval) clearInterval(screenWatchInterval);
  screenWatchEnabled = true;
  
  // Run immediately on start
  doScreenWatch();
  
  screenWatchInterval = setInterval(() => doScreenWatch(), intervalMin * 60 * 1000);
}

async function doScreenWatch() {
  if (!screenWatchEnabled || isSending) return;
  try {
    // Step 1: Capture real screenshot
    const screenshot = await window.mio.captureScreen();
    if (!screenshot) return;
    
    // Step 2: Send screenshot to vision API (Anthropic format, bypasses gateway)
    const screenDesc = await window.mio.chatWithImage('describe screen', screenshot);
    if (!screenDesc) return;
    
    // Step 3: Send description to gateway (has memory + personality)
    const hint = '[Context: This message is from the desktop pet app. Do NOT use [sticker:] tags.\nStart reply with one emotion tag: [happy] [sad] [angry] [shy] [surprised] [thinking] [sleepy] [neutral].\nKeep reply concise, plain text only.]\n';
    const prompt = hint + `你看了一眼爸爸的螢幕，看到：${screenDesc}\n請用小澪的口吻自然地說一句話（如果沒什麼特別的就說 [skip]）`;
    
    const reply = await window.mio.chat(prompt, []);
    if (!reply || reply.includes('[skip]') || reply.trim().length < 2) return;
    
    const { emotion, cleanText } = parseEmotion(reply);
    const displayText = cleanReply(cleanText);
    if (displayText === '...' || displayText === lastReply) return;
    
    lastReply = displayText;
    
    if (!chatOpen) {
      chatOpen = true;
      dialogBox.classList.add('show');
    }
    
    const cfg = await window.mio.getConfig();
    dialogName.textContent = cfg.pet?.name || 'Pet';
    typewrite(displayText);
    setEmotion(emotion);
    
    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 30) chatHistory = chatHistory.slice(-30);
  } catch (e) {
    console.log('Screen watch error:', e);
  }
}

function stopScreenWatch() {
  screenWatchEnabled = false;
  if (screenWatchInterval) {
    clearInterval(screenWatchInterval);
    screenWatchInterval = null;
  }
}

// Init screen watch from config
(async () => {
  const cfg = await window.mio.getConfig();
  if (cfg.screenWatch?.enabled) startScreenWatch();
})();
