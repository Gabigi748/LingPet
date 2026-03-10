# LingPet for Claw 🐾

A cross-platform AI desktop pet powered by [OpenClaw](https://github.com/openclaw/openclaw).

Give your AI assistant a face — drop in your own artwork, connect to your OpenClaw instance, and chat with your pet right on your desktop.

## Features

- **Transparent desktop pet** — always-on-top, draggable, lives on your desktop
- **Galgame-style chat UI** — semi-transparent dialog box with configurable position
- **Chat with your AI** — click the pet to open a chat bubble, powered by OpenClaw Gateway
- **Dynamic emotion system** — automatically scans `assets/` folder on startup; any artwork you add becomes an available emotion
- **Screen Watch** — pet periodically screenshots your screen and comments on what you're doing
- **Head Pat** — click the top area of the pet to pat its head and get a cute reaction!
- **Layout settings** — adjust dialog position (above/below), character offset, and scale
- **Click-through mode** — mouse passes through to windows below by default; only the pet and dialog are interactive
- **Custom artwork** — use any PNG/image as your pet's appearance, plus emotion variants
- **Floating animation** — gentle up-and-down floating idle animation
- **New Chat button** — 🔄 reset conversation history anytime to start fresh
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
| **🔄 button** in dialog | Start a new chat (clears history) |
| **📜 button** in dialog | View chat history |
| **⚙ button** in dialog | Open settings panel |
| **Tray icon → Quit** | Close the app |

## Emotion System

LingPet **dynamically scans** the `assets/` folder on startup and builds the available emotion list from the image files it finds. This means:

- **Add a new emotion:** just drop `excited.png` into `assets/` → restart → the AI can now use `[excited]`
- **Remove an emotion:** delete the file → restart → the AI won't use it anymore
- **No hardcoded list** — whatever artwork exists in `assets/` is what's available

The app injects the detected emotion list into every API call, so the AI model will only use emotions that have corresponding artwork.

### Example Setup

| Filename | Emotion tag AI will use |
|----------|------------------------|
| `default.png` | Fallback artwork (always needed) |
| `happy.png` | `[happy]` |
| `sad.png` | `[sad]` |
| `angry.png` | `[angry]` |
| `shy.png` | `[shy]` |
| `thinking.png` | `[thinking]` |
| `sleepy.png` | `[sleepy]` |
| `confused.png` | `[confused]` |
| *any_name.png* | `[any_name]` |

Place emotion artwork in the `assets/` folder. Missing emotions fall back to `default.png`. Files named `default` and `mio_backup` are excluded from the emotion list.

## Layout Settings

If your artwork is small and the dialog box covers the character, you can adjust the layout in **Settings → Layout**:

| Setting | Description |
|---------|-------------|
| **Dialog Position** | `Below character` (default) or `Above character` — moves the chat box above the pet |
| **Character Vertical Offset** | Shift the character up (negative) or down (positive) in pixels |
| **Character Scale** | Resize the character from 30% to 200% |

Changes apply immediately on save — no restart needed.

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
- **Provider URL** — vision API base URL (e.g. `https://api.anthropic.com` or `https://api.openai.com`)
- **Vision API Format** — choose `Anthropic (/v1/messages)` or `OpenAI (/v1/chat/completions)`
- **API Key** — your vision provider API key
- **Screen Watch** — toggle on/off
- **Interval** — how often to check (in minutes)

> Note: The vision step calls the provider directly (not through OpenClaw Gateway) since Gateway does not support image inputs. The final response still goes through Gateway for full personality and memory.

## Configuration

All settings are stored in `config.json` and can be edited via the in-app Settings panel.

```json
{
  "api": {
    "baseUrl": "http://your-server",
    "endpoint": "/api/gateway/chat",
    "apiKey": "",
    "model": "your-model",
    "user": "your-session-user",
    "providerUrl": "https://api.anthropic.com",
    "apiFormat": "anthropic"
  },
  "pet": {
    "name": "My Pet",
    "systemPrompt": "You are a cute desktop pet..."
  },
  "screenWatch": {
    "enabled": false,
    "intervalMin": 5
  },
  "interaction": {
    "padding": 10,
    "headpatZone": 30
  },
  "layout": {
    "dialogPosition": "below",
    "petOffset": 0,
    "petScale": 100
  }
}
```

## Project Structure

```
LingPet/
├── assets/
│   ├── default.png        # Main pet artwork (required)
│   ├── happy.png          # Emotion variants (auto-detected)
│   ├── sad.png
│   ├── shy.png
│   └── ...                # Add any emotion artwork here
├── main.js                # Electron main process + API calls + emotion scanning
├── preload.js             # Context bridge (secure IPC)
├── index.html             # UI layout + styles
├── renderer.js            # Frontend logic (chat, emotions, layout, screen watch)
├── config.json            # Your config (gitignored)
├── config.example.json    # Example config template
└── package.json
```

## Roadmap

- [x] Dynamic emotion system — auto-scan artwork, no hardcoded list
- [x] Layout settings — dialog position, character offset & scale
- [x] Screen Watch — pet comments on what you're doing
- [x] Head Pat — click the head area for a cute reaction
- [x] Click-through mode — configurable interaction zone
- [x] Floating idle animation
- [x] Window position memory
- [x] Semi-transparent overlaid dialog box
- [x] Chat history viewer
- [ ] Auto-start on boot
- [ ] Live2D support — animated pet models

## License

MIT
