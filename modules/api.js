const https = require('https');
const http = require('http');
const { getConfig } = require('./config');
const { getEmotionInstruction } = require('./emotions');

function callAPI(message, history = []) {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const emotionInstruction = getEmotionInstruction();
    let body = JSON.stringify({
      model: config.api?.model || 'gpt-4',
      messages: [
        { role: 'system', content: (config.pet?.systemPrompt || 'You are a helpful desktop pet.') + emotionInstruction },
        ...history,
        { role: 'user', content: message },
      ],
      max_tokens: 1024,
    });

    const endpoint = config.api?.endpoint || '/v1/chat/completions';
    const url = new URL((config.api?.baseUrl || 'http://localhost:3000') + endpoint);
    const mod = url.protocol === 'https:' ? https : http;

    const headers = { 'Content-Type': 'application/json' };
    if (config.api?.apiKey) {
      headers['Authorization'] = `Bearer ${config.api.apiKey}`;
    }
    if (config.api?.user) {
      headers['X-User'] = config.api.user;
    }

    const req = mod.request(url, { method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          let reply = json.choices?.[0]?.message?.content || '（小澪沒聽懂...）';
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

function callAPIWithImage(message, imageDataUrl) {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const mediaType = imageDataUrl.match(/^data:(image\/\w+);/)?.[1] || 'image/png';

    const providerBase = config.api?.providerUrl || config.api?.baseUrl || 'https://www.fucheers.top';
    const apiFormat = config.api?.apiFormat || 'anthropic';
    const isAnthropic = apiFormat === 'anthropic';

    const targetUrl = providerBase + (isAnthropic ? '/v1/messages' : '/v1/chat/completions');
    console.log('[ScreenWatch] Calling vision API:', targetUrl, '(format:', apiFormat + ')');

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
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          let text = null;
          if (isAnthropic) {
            const textBlock = json.content?.find(b => b.type === 'text');
            text = textBlock?.text || null;
          } else {
            text = json.choices?.[0]?.message?.content || null;
          }
          resolve(text);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

module.exports = { callAPI, callAPIWithImage };
