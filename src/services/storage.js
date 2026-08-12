import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { formatTimestamp } from '../lib/utils.js';

export class SessionStorage {
  constructor(rootDir) {
    this.sessionId = uuidv4();
    this.rootDir = rootDir;
    this.sessionDir = path.join(rootDir, 'sessions', this.sessionId);
    this.screenshotsDir = path.join(this.sessionDir, 'screenshots');
    this.logPath = path.join(this.sessionDir, 'session.log');
    this.descriptionsPath = path.join(this.sessionDir, 'descriptions.txt');
    this.captureCount = 0;

    this.#ensureDirectories();
    this.#initializeDescriptionsFile();
  }

  #ensureDirectories() {
    fs.mkdirSync(this.screenshotsDir, { recursive: true });
  }

  #initializeDescriptionsFile() {
    const header = `Screen Narrator Session - ${new Date().toISOString()}\n${'='.repeat(50)}\n\n`;
    fs.writeFileSync(this.descriptionsPath, header);
  }

  saveScreenshot(imageBuffer) {
    this.captureCount += 1;
    const timestamp = formatTimestamp();
    const filename = `capture_${String(this.captureCount).padStart(3, '0')}_${timestamp}.png`;
    const filePath = path.join(this.screenshotsDir, filename);
    fs.writeFileSync(filePath, imageBuffer);
    return { filePath, filename, captureNumber: this.captureCount };
  }

  appendDescription(captureNumber, timestamp, description) {
    const entry = `Capture ${captureNumber} - ${new Date(timestamp).toLocaleString()}\n${'-'.repeat(50)}\n${description}\n\n`;
    fs.appendFileSync(this.descriptionsPath, entry);
  }

  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      captureCount: this.captureCount,
      sessionDir: this.sessionDir,
      screenshotsDir: this.screenshotsDir,
      descriptionsPath: this.descriptionsPath,
      logPath: this.logPath
    };
  }

  cleanup() {
    try {
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Failed to cleanup session: ${error.message}`);
    }
  }
}
