const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
let availableEmotions = ['neutral'];

function scanEmotions() {
  if (!fs.existsSync(assetsDir)) return;
  const files = fs.readdirSync(assetsDir).filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
  const names = files
    .map(f => f.replace(/\.[^.]+$/, ''))
    .filter(n => n !== 'default' && n !== 'mio_backup');
  if (names.length > 0) {
    availableEmotions = names;
  }
  console.log('[Emotions] Available:', availableEmotions.join(', '));
}

function getAvailableEmotions() {
  return availableEmotions;
}

function getEmotionInstruction() {
  const emotionList = availableEmotions.map(e => `[${e}]`).join(' ');
  return `\n\nIMPORTANT RULES for this reply:\n1. Do NOT use [sticker:] tags (like [sticker:heart_eyes_cat])\n2. Start every reply with EXACTLY ONE emotion tag from this list ONLY: ${emotionList}\n3. Do NOT use any emotion names not in the list above.\n4. Example: "[${availableEmotions[0]}] 好開心呀！"\n5. Keep replies concise, plain text only.`;
}

function listEmotionFiles() {
  if (!fs.existsSync(assetsDir)) return [];
  return fs.readdirSync(assetsDir)
    .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
    .map(f => ({ name: f.replace(/\.[^.]+$/, ''), file: f }));
}

function getAssetPath(filename) {
  return path.join(assetsDir, filename);
}

module.exports = { scanEmotions, getAvailableEmotions, getEmotionInstruction, listEmotionFiles, getAssetPath };
