const petImg = document.getElementById('pet-img');
const dialogBox = document.getElementById('dialog-box');
const dialogName = document.getElementById('dialog-name');
const dialogText = document.getElementById('dialog-text');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
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
const EMOTIONS = ['happy', 'sad', 'angry', 'shy', 'surprised', 'thinking', 'sleepy', 'neutral', 'confused', 'serious'];
const DEFAULT_EMOTION = 'neutral';

// ========== Pet Name from config ==========
(async () => {
  const cfg = await window.mio.getConfig();
  dialogName.textContent = cfg.pet?.name || 'Pet';
})();

// ========== Click-through Mode with Interaction Zone ==========
let interactPadding = 10; // px padding around pet image
let headpatZone = 30; // top % of pet image = head area
let isMouseInteractive = false;

// Load interaction config
(async () => {
  const cfg = await window.mio.getConfig();
  interactPadding = cfg.interaction?.padding ?? 10;
  headpatZone = cfg.interaction?.headpatZone ?? 30;
  applyLayout(cfg);
})();

function applyLayout(cfg) {
  const layout = cfg.layout?.dialogPosition || 'below';
  const offset = cfg.layout?.petOffset || 0;
  const scale = cfg.layout?.petScale || 100;

  // Dialog position
  const container = document.getElementById('pet-container');
  container.classList.remove('layout-above');
  if (layout === 'above') {
    container.classList.add('layout-above');
  }

  // Character offset & scale
  petImg.style.transform = '';
  petImg.style.marginBottom = offset < 0 ? '0' : offset + 'px';
  petImg.style.marginTop = offset < 0 ? Math.abs(offset) + 'px' : '0';
  if (scale !== 100) {
    petImg.style.maxWidth = (280 * scale / 100) + 'px';
    petImg.style.maxHeight = (480 * scale / 100) + 'px';
  } else {
    petImg.style.maxWidth = '280px';
    petImg.style.maxHeight = '480px';
  }
}

function isInInteractiveZone(e) {
  // Always interactive when panels are open
  if (chatOpen || document.getElementById('settings-panel').classList.contains('show') 
      || document.getElementById('history-overlay').classList.contains('show')) {
    return true;
  }
  // Check if mouse is over pet image (with padding)
  const rect = petImg.getBoundingClientRect();
  const x = e.clientX, y = e.clientY;
  if (x >= rect.left - interactPadding && x <= rect.right + interactPadding &&
      y >= rect.top - interactPadding && y <= rect.bottom + interactPadding) {
    return true;
  }
  // Check if over dialog box
  const dRect = dialogBox.getBoundingClientRect();
  if (dialogBox.classList.contains('show') &&
      x >= dRect.left && x <= dRect.right && y >= dRect.top && y <= dRect.bottom) {
    return true;
  }
  return false;
}

// Mouse proximity opacity fade
let currentOpacity = 1;
function updateProximityOpacity(e) {
  if (chatOpen || isMiniMode) return; // Don't fade when chatting or mini
  const rect = petImg.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dist = Math.sqrt((e.clientX - cx) ** 2 + (e.clientY - cy) ** 2);
  const fadeStart = 150; // start fading at this distance
  const fadeEnd = 50;    // minimum opacity at this distance
  let opacity;
  if (dist > fadeStart) {
    opacity = 1;
  } else if (dist < fadeEnd) {
    opacity = 0.3;
  } else {
    opacity = 0.3 + 0.7 * ((dist - fadeEnd) / (fadeStart - fadeEnd));
  }
  if (Math.abs(opacity - currentOpacity) > 0.02) {
    currentOpacity = opacity;
    window.mio.setOpacity(opacity);
  }
}

document.addEventListener('mousemove', (e) => {
  const shouldBeInteractive = isInInteractiveZone(e);
  if (shouldBeInteractive !== isMouseInteractive) {
    isMouseInteractive = shouldBeInteractive;
    window.mio.setIgnoreMouse(!shouldBeInteractive);
  }
  updateProximityOpacity(e);
});

document.addEventListener('mouseleave', () => {
  if (isMouseInteractive) {
    isMouseInteractive = false;
    window.mio.setIgnoreMouse(true);
  }
  // Restore full opacity when mouse leaves
  if (currentOpacity < 1) {
    currentOpacity = 1;
    window.mio.setOpacity(1);
  }
});

// ========== Head Pat ==========
let headpatCooldown = false;

function isInHeadZone(e) {
  const rect = petImg.getBoundingClientRect();
  const relY = (e.clientY - rect.top) / rect.height;
  return relY >= 0 && relY <= headpatZone / 100;
}

async function triggerHeadpat() {
  if (headpatCooldown || isSending) return;
  headpatCooldown = true;
  setTimeout(() => { headpatCooldown = false; }, 3000); // 3s cooldown

  // Show heart particles
  showHeadpatEffect();

  // Send to API
  isSending = true;
  const cfg = await window.mio.getConfig();
  const hint = '[Context: This message is from the desktop pet app. Do NOT use [sticker:] tags.\nStart reply with one emotion tag: [happy] [sad] [angry] [shy] [surprised] [thinking] [sleepy] [neutral] [confused] [serious].\nKeep reply concise, plain text only.]\n';
  const prompt = hint + '（爸爸摸了摸你的頭）請用可愛的語氣回應被摸頭的感覺，簡短一句話就好';

  try {
    const reply = await window.mio.chat(prompt, chatHistory);
    const { emotion, cleanText } = parseEmotion(reply);
    const displayText = cleanReply(cleanText);
    lastReply = displayText;

    dialogName.textContent = cfg.pet?.name || 'Pet';
    if (!chatOpen) {
      chatOpen = true;
      dialogBox.classList.add('show');
    }
    typewrite(displayText);
    setEmotion(emotion);

    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 30) chatHistory = chatHistory.slice(-30);
  } catch (e) {
    dialogName.textContent = cfg.pet?.name || 'Pet';
    typewrite('Mmm~');
    setEmotion('shy');
  }
  isSending = false;
}

function showHeadpatEffect() {
  const rect = petImg.getBoundingClientRect();
  for (let i = 0; i < 5; i++) {
    const heart = document.createElement('div');
    heart.textContent = '\u2764';
    heart.style.cssText = `
      position: fixed; pointer-events: none; z-index: 999;
      font-size: ${14 + Math.random() * 10}px; color: #ff6b9d;
      left: ${rect.left + rect.width * (0.2 + Math.random() * 0.6)}px;
      top: ${rect.top + rect.height * 0.15}px;
      opacity: 1; transition: all 1s ease-out;
    `;
    document.body.appendChild(heart);
    setTimeout(() => {
      heart.style.top = (rect.top - 30 - Math.random() * 40) + 'px';
      heart.style.opacity = '0';
      heart.style.transform = `translateX(${(Math.random() - 0.5) * 40}px)`;
    }, 50);
    setTimeout(() => heart.remove(), 1100);
  }
}

// ========== Mini Mode ==========
let isMiniMode = false;

window.mio.onMiniModeChanged((mini) => {
  isMiniMode = mini;
  const container = document.getElementById('pet-container');
  if (mini) {
    container.classList.add('mini-mode');
    dialogBox.classList.remove('show');
    chatOpen = false;
  } else {
    container.classList.remove('mini-mode');
  }
});

// ========== Click vs Drag ==========
let mouseDownTime = 0;
let mouseDownPos = { x: 0, y: 0 };
let lastClickTime = 0;

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
      const now = Date.now();
      // Double click detection → toggle mini mode
      if (now - lastClickTime < 400) {
        window.mio.toggleMini();
        lastClickTime = 0;
        return;
      }
      lastClickTime = now;

      // Single click after delay (to distinguish from double click)
      setTimeout(() => {
        if (lastClickTime === 0) return; // was consumed by double click
        if (isMiniMode) {
          // In mini mode, single click expands back
          window.mio.toggleMini();
          return;
        }
        // Check if click is in head zone → headpat
        if (isInHeadZone(ev)) {
          triggerHeadpat();
        } else {
          chatOpen = !chatOpen;
          dialogBox.classList.toggle('show', chatOpen);
          if (chatOpen) {
            setTimeout(() => msgInput.focus(), 100);
            // Restore opacity when chatting
            if (currentOpacity < 1) {
              currentOpacity = 1;
              window.mio.setOpacity(1);
            }
          }
        }
      }, 420);
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
// ========== New Chat ==========
newChatBtn.addEventListener('click', async () => {
  chatHistory = [];
  lastReply = '';
  const cfg = await window.mio.getConfig();
  dialogName.textContent = cfg.pet?.name || 'Pet';
  typewrite('新對話開始囉！有什麼想聊的嗎？');
  setEmotion('happy');
});

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
  document.getElementById('cfg-api-format').value = cfg.api?.apiFormat || 'anthropic';
  document.getElementById('cfg-endpoint').value = cfg.api?.endpoint || '/v1/chat/completions';
  document.getElementById('cfg-key').value = cfg.api?.apiKey || '';
  document.getElementById('cfg-model').value = cfg.api?.model || '';
  document.getElementById('cfg-user').value = cfg.api?.user || '';
  document.getElementById('cfg-name').value = cfg.pet?.name || '';
  document.getElementById('cfg-prompt').value = cfg.pet?.systemPrompt || '';
  document.getElementById('cfg-screen-enabled').checked = cfg.screenWatch?.enabled || false;
  document.getElementById('cfg-screen-interval').value = cfg.screenWatch?.intervalMin || 5;
  document.getElementById('cfg-interact-padding').value = cfg.interaction?.padding ?? 10;
  document.getElementById('cfg-headpat-zone').value = cfg.interaction?.headpatZone ?? 30;
  document.getElementById('cfg-layout').value = cfg.layout?.dialogPosition || 'below';
  document.getElementById('cfg-pet-offset').value = cfg.layout?.petOffset || 0;
  document.getElementById('cfg-pet-scale').value = cfg.layout?.petScale || 100;

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
      apiFormat: document.getElementById('cfg-api-format').value,
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
    interaction: {
      padding: parseInt(document.getElementById('cfg-interact-padding').value) || 10,
      headpatZone: parseInt(document.getElementById('cfg-headpat-zone').value) || 30,
    },
    layout: {
      dialogPosition: document.getElementById('cfg-layout').value || 'below',
      petOffset: parseInt(document.getElementById('cfg-pet-offset').value) || 0,
      petScale: parseInt(document.getElementById('cfg-pet-scale').value) || 100,
    },
  };
  await window.mio.saveConfig(newConfig);
  dialogName.textContent = newConfig.pet.name || 'Pet';
  
  // Update interaction zone runtime values
  interactPadding = newConfig.interaction.padding;
  headpatZone = newConfig.interaction.headpatZone;
  
  // Apply layout changes
  applyLayout(newConfig);
  
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
    console.log('Sending screenshot to vision API...');
    const screenDesc = await window.mio.chatWithImage('describe screen', screenshot);
    console.log('Vision description received:', screenDesc);
    if (!screenDesc) return;
    
    // Step 3: Send description to gateway (has memory + personality)
    console.log('Sending description to gateway...');
    const hint = '[Context: This message is from the desktop pet app. Do NOT use [sticker:] tags.\nStart reply with one emotion tag: [happy] [sad] [angry] [shy] [surprised] [thinking] [sleepy] [neutral] [confused] [serious].\nKeep reply concise, plain text only.]\n';
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
    
    // Save both sides to chatHistory so user messages remember context
    chatHistory.push({ role: 'user', content: `（看了一眼螢幕）${screenDesc}` });
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
