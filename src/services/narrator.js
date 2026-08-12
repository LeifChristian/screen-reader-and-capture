import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_INTERVAL_MS, DEFAULT_MODEL, MAX_HISTORY_ENTRIES, MAX_TOKENS } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { SessionStorage } from './storage.js';
import { ScreenshotService } from './screenshot.js';
import { OpenAIService } from './openai.js';
import { TextToSpeechService } from './tts.js';
import { SessionExporter } from './exporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');

export class ScreenNarrator {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS;
    this.isRunning = false;
    this.intervalId = null;

    this.storage = new SessionStorage(ROOT_DIR);
    this.logger = createLogger(this.storage.logPath);
    this.screenshot = new ScreenshotService();
    this.openai = new OpenAIService({ model: DEFAULT_MODEL, maxTokens: MAX_TOKENS, logger: this.logger });
    this.tts = new TextToSpeechService({ logger: this.logger });
    this.exporter = new SessionExporter({ logger: this.logger });

    this.conversationHistory = [];
  }

  start() {
    if (this.isRunning) {
      this.logger.info('Narrator already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting Screen Narrator...');
    this.logger.info(`Session ID: ${this.storage.sessionId}`);
    this.logger.info(`Captures will be saved to: ${this.storage.screenshotsDir}`);

    this.#captureAndNarrate();
    this.intervalId = setInterval(() => this.#captureAndNarrate(), this.intervalMs);

    this.logger.info(`Screen narrator active - capturing every ${this.intervalMs / 1000} seconds`);
  }

  stop() {
    if (!this.isRunning) return;

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    this.logger.info('Screen narrator stopped');
  }

  async #captureAndNarrate() {
    try {
      const imageBuffer = await this.screenshot.capture();
      const base64Image = imageBuffer.toString('base64');

      const history = this.conversationHistory.slice(-MAX_HISTORY_ENTRIES);
      const description = await this.openai.describeScreen(base64Image, history);

      if (!description) {
        this.logger.warn('No description received, skipping capture');
        return;
      }

      const { filename, captureNumber } = this.storage.saveScreenshot(imageBuffer);
      const timestamp = new Date().toISOString();

      const entry = {
        captureNumber,
        timestamp,
        filename,
        description,
        path: path.join(this.storage.screenshotsDir, filename)
      };

      this.conversationHistory.push(entry);
      this.storage.appendDescription(captureNumber, timestamp, description);

      this.logger.info(`Capture ${captureNumber}: ${description}`);

      try {
        await this.tts.speak(description);
      } catch (error) {
        this.logger.error(`TTS failed: ${error.message}`);
      }

      this.#emit('new-capture', entry);
    } catch (error) {
      this.logger.error(`Capture and narration failed: ${error.message}`);
    }
  }

  #emit(eventName, data) {
    if (global.mainWindow && !global.mainWindow.isDestroyed()) {
      global.mainWindow.webContents.send(eventName, data);
    }
  }

  getSessionData() {
    return {
      sessionId: this.storage.sessionId,
      captureCount: this.storage.captureCount,
      conversationHistory: this.conversationHistory,
      isRunning: this.isRunning,
      sessionDir: this.storage.sessionDir
    };
  }

  async exportSession(includeScreenshots, exportPath) {
    return this.exporter.export(this.storage.getSessionInfo(), includeScreenshots, exportPath);
  }

  cleanup() {
    this.storage.cleanup?.();
  }
}
