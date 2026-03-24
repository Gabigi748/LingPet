const { ipcMain } = require('electron');
const { getWindow } = require('./window');
const { callAPI } = require('./api');
const { getConfig } = require('./config');

let lastActivity = Date.now();
let proactiveTimer = null;
let greetedToday = false;
let lastGreetDate = null;

// Track user activity (called from renderer via IPC)
function resetActivity() {
  lastActivity = Date.now();
}

// Get current hour in user's perspective (default: system local time)
function getCurrentHour() {
  return new Date().getHours();
}

// Determine greeting type based on time
function getTimeGreeting() {
  const hour = getCurrentHour();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'latenight';
}

// Generate proactive message via API
async function generateProactiveMessage(trigger) {
  const config = getConfig();
  const petName = config.pet?.name || 'Pet';

  const prompts = {
    idle: `You are ${petName}. The user has been idle for a while. Say something short and cute to check on them. Keep it under 20 characters. Use the language matching your system prompt.`,
    morning: `You are ${petName}. It's morning! Give a short, cheerful good morning greeting. Keep it under 30 characters. Use the language matching your system prompt.`,
    afternoon: `You are ${petName}. It's afternoon! Say "下午好呀" and add something short and encouraging. Keep it under 25 characters. Use Traditional Chinese.`,
    evening: `You are ${petName}. It's evening! Say "晚上好呀" and add something warm and relaxing. Keep it under 25 characters. Use Traditional Chinese.`,
    latenight: `You are ${petName}. It's very late at night! Gently remind the user to go to sleep. Keep it under 25 characters. Use the language matching your system prompt.`,
    work_long: `You are ${petName}. The user has been working for over 2 hours straight! Remind them to take a break. Keep it under 25 characters. Use the language matching your system prompt.`,
  };

  const prompt = prompts[trigger] || prompts.idle;

  try {
    const reply = await callAPI(prompt, []);
    // Clean up: remove emotion tags, keep just the text
    return reply.replace(/^\[[^\]]+\]\s*/, '').trim();
  } catch (e) {
    console.log('[Proactive] API call failed:', e);
    // Fallback messages
    const fallbacks = {
      idle: '在嗎？',
      morning: '早安！',
      afternoon: '下午好呀',
      evening: '晚上好呀',
      latenight: '該睡覺了喔！',
      work_long: '休息一下吧～',
    };
    return fallbacks[trigger] || '...';
  }
}

// Send a proactive message to renderer
async function sendProactiveMessage(trigger) {
  const win = getWindow();
  if (!win || win.isDestroyed()) return;

  const message = await generateProactiveMessage(trigger);
  console.log(`[Proactive] Trigger: ${trigger}, Message: ${message}`);
  win.webContents.send('proactive-message', { trigger, message });
}

// Main proactive check loop
function checkProactive() {
  const now = Date.now();
  const config = getConfig();
  const proactiveConfig = config.proactive || {};

  // Feature disabled check
  if (proactiveConfig.enabled === false) return;

  // Quiet hours check
  const hour = getCurrentHour();
  const quietStart = proactiveConfig.quietStart ?? 23;
  const quietEnd = proactiveConfig.quietEnd ?? 7;
  const isQuiet = (quietStart > quietEnd)
    ? (hour >= quietStart || hour < quietEnd)
    : (hour >= quietStart && hour < quietEnd);

  // Late night warning (only once, between 23-1)
  if (hour >= 23 || hour < 1) {
    if (!isQuiet || proactiveConfig.lateNightWarning !== false) {
      const today = new Date().toDateString();
      if (lastGreetDate !== today + '-latenight') {
        lastGreetDate = today + '-latenight';
        sendProactiveMessage('latenight');
        return;
      }
    }
  }

  if (isQuiet) return; // Don't do anything else during quiet hours

  // Time-based greeting (once per day)
  const today = new Date().toDateString();
  if (!greetedToday || lastGreetDate !== today) {
    greetedToday = true;
    lastGreetDate = today;
    const greeting = getTimeGreeting();
    if (greeting !== 'latenight') {
      sendProactiveMessage(greeting);
      return;
    }
  }

  // Idle check
  const idleThreshold = (proactiveConfig.idleMinutes || 30) * 60 * 1000;
  const idleTime = now - lastActivity;
  if (idleTime > idleThreshold) {
    sendProactiveMessage('idle');
    lastActivity = now; // Reset so we don't spam
    return;
  }

  // Long work session check (2 hours)
  const workThreshold = (proactiveConfig.workMinutes || 120) * 60 * 1000;
  if (idleTime < 5 * 60 * 1000 && (now - lastActivity) > 0) {
    // User is active — check if they've been active too long
    // This is a simplified check; a real implementation would track session start
  }
}

function start() {
  // Set up IPC for activity tracking
  ipcMain.on('user-activity', () => {
    resetActivity();
  });

  // Check every 5 minutes
  const checkInterval = 5 * 60 * 1000;
  proactiveTimer = setInterval(checkProactive, checkInterval);

  // First check after 1 minute (give app time to load)
  setTimeout(checkProactive, 60 * 1000);

  console.log('[Proactive] Engine started');
}

function stop() {
  if (proactiveTimer) {
    clearInterval(proactiveTimer);
    proactiveTimer = null;
  }
}

module.exports = { start, stop, resetActivity };
