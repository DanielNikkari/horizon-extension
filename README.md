# Horizon

A Chrome extension that explains anything on the web — instantly, in your language, at your level.

Highlight text on any webpage and Horizon automatically generates a clear explanation using AI, adapts the depth to your expertise level, and suggests 3 follow-up questions to keep you learning.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-6366f1)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Select → Explain** — highlight text, wait 800ms, explanation appears automatically in the side panel
- **Expertise levels** — Beginner / Intermediate / Advanced / Expert: vocabulary, depth, and analogies adapt to your level
- **Language-aware** — detects the language of the selected text and responds in the same language
- **Streaming output** — explanation streams in word by word as it's generated
- **Follow-up questions** — 3 suggested questions tailored to your expertise level after each explanation
- **Dual AI backend** — connect to Anthropic Claude (remote) or Ollama (local/private)
- **On/Off toggle** — disable the extension without uninstalling it
- **Configurable debounce** — adjust how long after releasing the selection the explanation triggers (200ms–2000ms)

---

## How It Works

```
User selects text
       ↓
Content script detects selection (live updates in panel)
       ↓
800ms after release → triggers explanation
       ↓
Background service worker calls AI API (streaming)
       ↓
Side panel renders explanation in real time
       ↓
Follow-up questions generated and shown as clickable chips
```

---

## Installation

### Load unpacked (development)

1. Clone this repo:
   ```bash
   git clone https://github.com/DanielNikkari/horizon-extension.git
   ```
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `horizon-extension/` directory
5. Pin the Horizon icon in your toolbar

### Configure

Click the Horizon icon in the toolbar to open Settings:

| Setting | Description |
|---|---|
| Enable/Disable | Toggle the extension on or off |
| Expertise Level | Beginner / Intermediate / Advanced / Expert |
| AI Mode | Remote (Claude API) or Local (Ollama) |
| API Key | Your Anthropic API key (remote mode) |
| Model | Claude model name (default: `claude-opus-4-5`) |
| Ollama Host | Ollama server URL (default: `http://localhost:11434`) |
| Local Model | Ollama model name (default: `llama3.2`) |
| Debounce Delay | Time after text release before triggering (200–2000ms) |

---

## AI Backends

### Remote — Anthropic Claude

1. Get an API key at [console.anthropic.com](https://console.anthropic.com)
2. In Settings, select **Remote (Claude API)** and paste your key
3. Optionally change the model (e.g. `claude-opus-4-5`, `claude-sonnet-4-5`)

### Local — Ollama

1. Install [Ollama](https://ollama.com) and pull a model:
   ```bash
   ollama pull llama3.2
   ```
2. In Settings, select **Local (Ollama)** and enter the model name
3. Use **Test Connection** to verify Ollama is reachable

---

## Project Structure

```
horizon-extension/
├── manifest.json          # Extension config (Manifest V3)
├── background.js          # Service worker: message routing, API streaming
├── content-script.js      # Selection detection and debounce logic
├── panel/
│   ├── panel.html         # Side panel UI
│   ├── panel.js           # Streaming rendering, follow-up chips
│   └── panel.css          # Side panel styles
├── popup/
│   ├── popup.html         # Settings popup
│   ├── popup.js           # Settings logic
│   └── popup.css          # Popup styles
├── utils/
│   ├── storage.js         # chrome.storage.sync wrappers
│   ├── api.js             # Anthropic + Ollama streaming clients
│   └── prompts.js         # Expertise-level prompt templates
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Expertise Levels

| Level | Description |
|---|---|
| **Beginner** | Simple language, everyday analogies, no jargon — 6th grade reading level |
| **Intermediate** | Clear language with brief domain terminology, real-world context |
| **Advanced** | Technical terminology, mechanisms, nuances, edge cases |
| **Expert** | Peer-level precision, specialized vocabulary, subtleties and open questions |

---

## License

MIT
