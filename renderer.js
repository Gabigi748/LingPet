const petImg = document.getElementById('pet-img');
const chatBubble = document.getElementById('chat-bubble');
const inputBar = document.getElementById('input-bar');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');

let chatOpen = false;
let chatHistory = [];
let isRecording = false;
let recognition = null;
let emotionMap = {}; // emotion name -> asset file path
const EMOTIONS = ['happy', 'sad', 'angry', 'shy', 'surprised', 'thinking', 'sleepy', 'neutral'];
const DEFAULT_EMOTION = 'neutral';

// Parse emotion tag from AI reply
function parseEmotion(text) {
  const match = text.match(/^\[(\w+)\]\s*/);
  if (match && EMOTIONS.includes(match[1])) {
    return { emotion: match[1], cleanText: text.slice(match[0].length) };
  }
  return { emotion: DEFAULT_EMOTION, cleanText: text };
}

// Switch pet artwork based on emotion
async function setEmotion(emotion) {
  const assets = await window.mio.listEmotions();
  const found = assets.find(a => a.name === emotion);
  if (found) {
    const assetPath = await window.mio.getAssetPath(found.file);
    petImg.src = assetPath + '?t=' + Date.now();
  } else {
    // Fall back to default
    const def = assets.find(a => a.name === 'default');
    if (def) {
      const assetPath = await window.mio.getAssetPath(def.file);
      petImg.src = assetPath + '?t=' + Date.now();
    }
  }
  petImg.classList.add('emotion-change');
  setTimeout(() => petImg.classList.remove('emotion-change'), 400);
}

// Toggle chat on click
petImg.addEventListener('click', (e) => {
  e.stopPropagation();
  chatOpen = !chatOpen;
  chatBubble.classList.toggle('show', chatOpen);
  inputBar.classList.toggle('show', chatOpen);
  if (chatOpen) msgInput.focus();
});

// Send message
async function sendMessage(text) {
  if (!text.trim()) return;
  addMessage(text, 'user');
  msgInput.value = '';

  const thinkingEl = addMessage('思考中...', 'thinking');

  try {
    const reply = await window.mio.chat(text, chatHistory);
    thinkingEl.remove();
    const { emotion, cleanText } = parseEmotion(reply);
    addMessage(cleanText, 'bot');
    setEmotion(emotion);
    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
  } catch (e) {
    thinkingEl.remove();
    addMessage('連線失敗...', 'bot');
    setEmotion('sad');
  }
}

function addMessage(text, type) {
  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;
  div.textContent = text;
  chatBubble.appendChild(div);
  chatBubble.scrollTop = chatBubble.scrollHeight;
  return div;
}

// Send button
sendBtn.addEventListener('click', () => sendMessage(msgInput.value));

// Enter key
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage(msgInput.value);
});

// Voice input (Web Speech API)
function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceBtn.title = '此裝置不支援語音輸入';
    voiceBtn.style.opacity = '0.4';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'zh-TW';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = (e) => {
    let transcript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    msgInput.value = transcript;
    if (e.results[e.results.length - 1].isFinal) {
      stopRecording();
      sendMessage(transcript);
    }
  };

  recognition.onerror = () => stopRecording();
  recognition.onend = () => stopRecording();
}

function startRecording() {
  if (!recognition) return;
  isRecording = true;
  voiceBtn.classList.add('recording');
  voiceBtn.textContent = '⏹';
  recognition.start();
}

function stopRecording() {
  isRecording = false;
  voiceBtn.classList.remove('recording');
  voiceBtn.textContent = '🎤';
  try { recognition?.stop(); } catch {}
}

voiceBtn.addEventListener('click', () => {
  if (isRecording) stopRecording();
  else startRecording();
});

// Settings listener
window.mio.onOpenSettings(() => {
  openSettings();
});

// Settings panel
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');
const settingsSave = document.getElementById('settings-save');

async function openSettings() {
  const cfg = await window.mio.getConfig();
  document.getElementById('cfg-url').value = cfg.api?.baseUrl || '';
  document.getElementById('cfg-endpoint').value = cfg.api?.endpoint || '/v1/chat/completions';
  document.getElementById('cfg-key').value = cfg.api?.apiKey || '';
  document.getElementById('cfg-model').value = cfg.api?.model || '';
  document.getElementById('cfg-user').value = cfg.api?.user || '';
  document.getElementById('cfg-name').value = cfg.pet?.name || '';
  document.getElementById('cfg-prompt').value = cfg.pet?.systemPrompt || '';
  document.getElementById('cfg-lang').value = cfg.voice?.lang || 'zh-TW';

  // Load emotion artwork grid
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

settingsClose.addEventListener('click', () => {
  settingsPanel.classList.remove('show');
});

settingsSave.addEventListener('click', async () => {
  const newConfig = {
    api: {
      baseUrl: document.getElementById('cfg-url').value,
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
      lang: document.getElementById('cfg-lang').value,
    },
  };
  await window.mio.saveConfig(newConfig);
  settingsPanel.classList.remove('show');
});

// Init
initVoice();
