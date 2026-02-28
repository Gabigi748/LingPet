# LingPet for Claw 🐾

A cross-platform AI desktop pet powered by [OpenClaw](https://github.com/openclaw/openclaw).

Give your AI assistant a face — drop in your own artwork, connect to your OpenClaw instance, and chat with your pet right on your desktop.

## Features

- **Transparent desktop pet** — always-on-top, draggable, lives on your desktop
- **Chat with your AI** — click the pet to open a chat bubble, powered by any OpenAI-compatible API
- **Voice input** — speak to your pet using Web Speech API (supports multiple languages)
- **Customizable personality** — set your own system prompt to define your pet's character
- **Custom artwork** — use any PNG/image as your pet's appearance
- **Settings UI** — configure everything in-app, no code editing needed
- **Cross-platform** — works on macOS and Windows

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/user/lingpetforclaw.git
cd lingpetforclaw
npm install
```

### 2. Configure

Copy the example config:

```bash
cp config.example.json config.json
```

Edit `config.json` with your settings:

```json
{
  "api": {
    "baseUrl": "http://localhost:3000",
    "apiKey": "your-api-key",
    "model": "your-model-name"
  },
  "pet": {
    "name": "My Pet",
    "systemPrompt": "You are a cute desktop pet. Be helpful and friendly."
  },
  "voice": {
    "enabled": true,
    "lang": "zh-TW"
  }
}
```

Or configure everything through the in-app Settings panel (right-click tray icon → Settings).

### 3. Add Your Artwork

Place your pet image in the `assets/` folder as `default.png`.

Use a transparent PNG for best results.

### 4. Run

```bash
npm start
```

## Connecting to OpenClaw

LingPet works with any OpenAI-compatible chat completions API.

If you're running [OpenClaw](https://github.com/openclaw/openclaw):

1. Your OpenClaw gateway exposes a chat completions endpoint
2. Set `baseUrl` to your gateway URL
3. Set `apiKey` to your gateway token
4. Set `model` to your configured model name

## Usage

| Action | What happens |
|--------|-------------|
| **Click** the pet | Toggle chat bubble |
| **Drag** the pet | Move it around your desktop |
| **🎤 button** | Start voice input |
| **Type + Enter** | Send a text message |
| **Tray icon → Settings** | Open settings panel |
| **Tray icon → Quit** | Close the app |

## Project Structure

```
lingpetforclaw/
├── assets/
│   └── default.png        # Your pet artwork (add your own!)
├── main.js                # Electron main process + API calls
├── preload.js             # Context bridge (secure IPC)
├── index.html             # UI layout
├── renderer.js            # Frontend logic (chat + voice)
├── config.json            # Your config (gitignored)
├── config.example.json    # Example config template
└── package.json
```

## Emotion System

LingPet automatically detects emotions in AI responses and switches artwork accordingly.

### Supported Emotions

| Emotion | Filename | When it triggers |
|---------|----------|-----------------|
| happy | `happy.png` | Cheerful, excited responses |
| sad | `sad.png` | Disappointed, upset responses |
| angry | `angry.png` | Frustrated, annoyed responses |
| shy | `shy.png` | Embarrassed, bashful responses |
| surprised | `surprised.png` | Shocked, amazed responses |
| thinking | `thinking.png` | Pondering, analyzing responses |
| sleepy | `sleepy.png` | Tired, idle responses |
| neutral | `neutral.png` | Default, calm responses |

### How It Works

1. Place your emotion artwork in the `assets/` folder (e.g., `assets/happy.png`)
2. The AI is instructed to tag each reply with an emotion like `[happy]`
3. LingPet parses the tag and switches to the matching artwork
4. If no matching artwork exists, it falls back to `default.png`

Check the emotion artwork status in Settings → Emotion Artwork section.

## Roadmap

- [ ] Emotion system — switch artwork based on AI response mood
- [ ] Multiple expressions — upload different images for different emotions
- [ ] Idle animations — breathing effect, random movements
- [ ] Notification push — weather, reminders, etc.
- [ ] Live2D support — animated pet models
- [ ] Auto-start on boot

## License

MIT
