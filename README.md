# Screen Narrator

An Electron desktop app that uses OpenAI's vision models to watch your screen, describe what it sees, and speak the description aloud. Includes a legacy queue-watcher mode for extracting queue numbers from on-screen text.

## Features

- **AI-Powered Screen Narration**: Captures your screen and describes it using GPT-4o
- **Text-to-Speech**: Speaks descriptions aloud using your system's TTS
- **Conversation History**: Maintains context across recent captures for continuity
- **Session Export**: Save descriptions as text or descriptions and screenshots as a ZIP
- **macOS and Windows Support**: Runs on macOS and Windows (Linux partially supported)
- **Setup Wizard**: Enter your OpenAI API key through a simple UI on first launch
- **Legacy Queue Watcher**: Optional mode to monitor a queue number and play alerts at thresholds

## Setup Instructions

### 1. Prerequisites

- **Node.js** (v18 or higher)
- **OpenAI API Key** with vision model access (e.g. `gpt-4o`)

### 2. Installation

```bash
git clone https://github.com/LeifChristian/screen-reader-and-capture.git
cd screen-reader-and-capture
git checkout reader
npm install
```

### 3. Start the Application

```bash
npm start
```

On first launch, a setup window will ask for your OpenAI API key. The key is stored locally in `.runtime-config.json`.

On macOS, you can also launch the bundled app:

```bash
open ScreenReader.app
```

## How It Works

1. **Screenshot Capture**: Takes a screenshot of your screen every 60 seconds
2. **AI Processing**: Sends the image to OpenAI Vision API (GPT-4o)
3. **Description**: Receives a natural-language description of what's on screen
4. **Text-to-Speech**: Speaks the description aloud
5. **Logging**: Saves descriptions and screenshots to a per-session folder

## Dashboard

The main dashboard shows:

- Session ID and capture count
- Latest screenshot
- Description history (newest first)
- Export options (text or text and screenshots)

## Configuration

### Capture Interval

Edit `INTERVAL_MS` in `src/services/narrator.js`:

```javascript
const DEFAULT_INTERVAL_MS = 60 * 1000; // 60 seconds
```

### Voice / TTS

On Windows, the app uses `Microsoft Zira Desktop`. On macOS/Linux it uses the default system voice. Edit `speakText()` in `src/services/tts.js` to change the voice or speed.

## Legacy Queue Watcher

The original queue-watcher functionality is still available in `capture.js`. It monitors your screen for a queue number and plays `sound.wav` when the number hits configured thresholds.

To use it, wire up `capture.js` in your own main process or modify `src/main/index.js` to start the queue watcher instead of the narrator.

### Alert Thresholds

Edit the `ALERT_NUMBERS` array in `capture.js`:

```javascript
const ALERT_NUMBERS = [10, 4, 3];
```

### Check Interval

Edit `INTERVAL_MS` in `capture.js`:

```javascript
const INTERVAL_MS = 30 * 1000; // 30 seconds
```

## Files Generated

- `sessions/<session-id>/screenshots/` - Captured screenshots
- `sessions/<session-id>/descriptions.txt` - Text log of all descriptions
- `sessions/<session-id>/session.log` - Application log
- `.runtime-config.json` - Locally stored OpenAI API key
- `queue_log.db` - SQLite database for queue watcher mode
- `queue-watcher.log` - Queue watcher log

## Troubleshooting

### Window doesn't appear

- On macOS, use `open ScreenReader.app` instead of `npm start` for proper GUI activation
- Check the Dock for an Electron icon and click it
- Ensure screen recording permissions are granted in **System Settings -> Privacy & Security -> Screen Recording**

### No descriptions

- Verify your OpenAI API key is valid and has credits
- Check `sessions/<session-id>/session.log` for API errors
- Ensure you have internet access

### TTS not working

- On macOS, the `say` command should work out of the box
- On Windows, ensure a compatible voice is installed
- Check the session log for TTS errors
