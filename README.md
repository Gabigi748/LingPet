# LingPet for Claw 🐾

A cross-platform AI desktop pet powered by [OpenClaw](https://github.com/openclaw/openclaw).

Give your AI assistant a face — drop in your own artwork, connect to your OpenClaw instance, and chat with your pet right on your desktop.

## Features

- **Transparent desktop pet** — always-on-top, draggable, lives on your desktop
- **Galgame-style chat UI** — semi-transparent dialog box overlays the pet naturally
- **Chat with your AI** — click the pet to open a chat bubble, powered by OpenClaw Gateway
- **Emotion system** — pet artwork changes based on AI response mood (10 emotions), auto-resets after 5 seconds
- **Screen Watch** — pet periodically screenshots your screen and comments on what you're doing
- **Head Pat** — click the top area of the pet to pat its head and get a cute reaction!
- **Click-through mode** — mouse passes through to windows below by default; only the pet and dialog are interactive
- **Custom artwork** — use any PNG/image as your pet's appearance, plus emotion variants
- **Breathing animation** — subtle idle animation when the pet is resting
- **Settings UI** — configure everything in-app via the ⚙ gear button, no code editing needed
- **Window position memory** — pet remembers where you placed it between sessions
- **Cross-platform** — works on macOS and Windows

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Gabigi748/LingPet.git
cd LingPet
npm install
```

### 2. Configure

Copy the example config:

```bash
cp config.example.json config.json
```

Edit `config.json` with your settings, or use the in-app Settings panel (click the ⚙ button in the chat dialog).

### 3. Add Your Artwork

Place your pet image in the `assets/` folder as `default.png`.

Use a transparent PNG for best results.

### 4. Run

```bash
npm start
```

## Connecting to OpenClaw

LingPet is designed to connect to your OpenClaw Gateway for full memory, personality, and session sharing.

### OpenClaw Gateway (Recommended)

```json
{
  "api": {
    "baseUrl": "http://your-server-ip",
    "endpoint": "/api/gateway/chat",
    "apiKey": "",
    "model": "your-model-name",
    "user": "your-session-user"
  }
}
```

This way your desktop pet shares the same session as your other OpenClaw interfaces (QQ bot, PWA, etc.), with full memory and personality preserved across all platforms.

## Usage

| Action | What happens |
|--------|-------------|
| **Click** the pet (body) | Toggle chat bubble |
| **Click** the pet's head (top ~30%) | Head pat — pet reacts! |
| **Drag** the pet | Move it around your desktop |
| **Type + Enter** | Send a text message |
| **⚙ button** in dialog | Open settings panel |
| **Tray icon → Quit** | Close the app |

## Emotion System

LingPet automatically detects emotion tags in AI responses and switches artwork accordingly. Emotions auto-reset to `default` after 5 seconds.

The app injects emotion instructions into every API call, so any AI model connected through OpenClaw will use these tags automatically — no extra setup needed.

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
| confused | `confused.png` | Puzzled, unsure responses |
| serious | `serious.png` | Focused, serious responses |

Place emotion artwork in the `assets/` folder. Missing emotions fall back to `default.png`.

## Click-Through & Interaction Zone

By default, mouse clicks pass through the pet window to whatever is beneath it. Only the pet image and dialog box capture mouse events.

You can fine-tune this in **Settings**:
- **Interaction Padding** — extra px around the pet image that is clickable (default: 10px)
- **Head Zone** — top % of the pet image that triggers head pat instead of chat (default: 30%)

## Screen Watch

LingPet can periodically take a screenshot of your screen and comment on what you're doing.

**How it works:**
1. Takes a screenshot (pet window is hidden during capture)
2. Sends the screenshot to your vision-capable AI provider (supports Anthropic and OpenAI formats)
3. Gets a text description of the screen
4. Sends the description to OpenClaw Gateway for a personality-aware response
5. Pet pops up and comments naturally

**Setup in Settings:**
- **Provider URL** — vision API base URL (e.g. `https://www.fucheers.top` or `https://api.openai.com`)
- **Vision API Format** — choose `Anthropic (/v1/messages)` or `OpenAI (/v1/chat/completions)`
- **API Key** — your vision provider API key
- **Screen Watch** — toggle on/off
- **Interval** — how often to check (in minutes)

> Note: The vision step calls the provider directly (not through OpenClaw Gateway) since Gateway does not support image inputs. The final response still goes through Gateway for full personality and memory.

## Project Structure

```
LingPet/
├── assets/
│   ├── default.png        # Main pet artwork
│   ├── happy.png          # Optional emotion variants
│   ├── sad.png
│   ├── confused.png
│   ├── serious.png
│   └── ...
├── main.js                # Electron main process + API calls
├── preload.js             # Context bridge (secure IPC)
├── index.html             # UI layout + styles
├── renderer.js            # Frontend logic (chat, emotions, screen watch)
├── config.json            # Your config (gitignored)
├── config.example.json    # Example config template
└── package.json
```

## Roadmap

- [x] Emotion system — 10 emotions, switch artwork based on AI response mood
- [x] Screen Watch — pet comments on what you're doing
- [x] Head Pat — click the head area for a cute reaction
- [x] Click-through mode — configurable interaction zone
- [x] Breathing idle animation
- [x] Window position memory
- [x] Semi-transparent overlaid dialog box
- [ ] Auto-start on boot
- [ ] Live2D support — animated pet models

## License

MIT
