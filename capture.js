import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import winston from 'winston';
import sqlite3 from 'sqlite3';
import screenshot from 'screenshot-desktop';

dotenv.config();

const SCREENSHOT_PATH = path.join(process.cwd(), 'screenshot.png');
const SOUND_PATH = path.join(process.cwd(), 'sound.wav');
const DB_PATH = path.join(process.cwd(), 'queue_log.db');
const INTERVAL_MS = 30 * 1000; // 30 seconds for testing, adjust as needed
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Notification thresholds
const ALERT_NUMBERS = [10, 4, 3];
let lastAlertNumber = null;

// Setup logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'queue-watcher.log' }),
    new winston.transports.Console()
  ]
});

// Setup database
const db = new sqlite3.Database(DB_PATH);

// Initialize database
function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS queue_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      queue_number INTEGER,
      screenshot_path TEXT,
      alert_triggered BOOLEAN DEFAULT 0
    )`);
  });
}

// Play sound notification
function playSound() {
  return new Promise((resolve) => {
    const platform = process.platform;
    let command;

    if (platform === 'win32') {
      // Windows - Use PowerShell to play sound
      command = `powershell -command "& {Add-Type -TypeDefinition 'using System; using System.Media; public class Sound { public static void Play(string path) { using (var player = new SoundPlayer(path)) { player.PlaySync(); } } }'; [Sound]::Play('${SOUND_PATH.replace(/\\/g, '\\\\')}')}"`;
    } else if (platform === 'darwin') {
      // macOS
      command = `afplay "${SOUND_PATH}"`;
    } else {
      // Linux
      command = `aplay "${SOUND_PATH}"`;
    }

    exec(command, (error) => {
      if (error) {
        logger.error(`Sound playback error: ${error.message}`);
      } else {
        logger.info('Sound notification played successfully');
      }
      resolve();
    });
  });
}

// Take screenshot using screenshot-desktop library
async function takeScreenshot() {
  try {
    const img = await screenshot({ format: 'png' });
    fs.writeFileSync(SCREENSHOT_PATH, img);
    logger.info('Screenshot captured successfully');
    return true;
  } catch (error) {
    logger.error(`Screenshot failed: ${error.message}`);
    return false;
  }
}

// Extract queue number from image using OpenAI Vision API
async function getQueueNumberFromImage(filePath) {
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');

    // Try multiple models in order of preference
    const models = ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini'];

    for (const model of models) {
      try {
        logger.info(`Attempting to use model: ${model}`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'You are looking at a screenshot. Find and extract ONLY the queue number. This could be displayed as "Queue: 15", "Position: 8", "Your number: 23", or similar formats. Return ONLY the numeric value as a raw integer. If no queue number is found, return -1.',
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/png;base64,${base64Image}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 10,
          }),
        });

        const data = await response.json();

        if (data.error) {
          logger.warn(`Model ${model} failed: ${data.error.message}`);
          continue; // Try next model
        }

        const raw = data.choices?.[0]?.message?.content?.trim();
        const number = parseInt(raw, 10);

        if (isNaN(number)) {
          logger.warn(`Could not parse queue number from response: ${raw}`);
          return null;
        }

        logger.info(`Successfully extracted queue number using ${model}: ${number}`);
        return number;

      } catch (modelError) {
        logger.warn(`Model ${model} failed with error: ${modelError.message}`);
        continue; // Try next model
      }
    }

    logger.error('All vision models failed. Please check your OpenAI API key permissions.');
    return null;

  } catch (error) {
    logger.error(`Error processing image: ${error.message}`);
    return null;
  }
}

// Log queue number to database
function logQueueNumber(queueNumber, alertTriggered = false) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT INTO queue_log (queue_number, screenshot_path, alert_triggered) VALUES (?, ?, ?)`);
    stmt.run(queueNumber, SCREENSHOT_PATH, alertTriggered ? 1 : 0, function (err) {
      if (err) {
        logger.error(`Database error: ${err.message}`);
        reject(err);
      } else {
        logger.info(`Queue number ${queueNumber} logged to database (ID: ${this.lastID})`);
        resolve(this.lastID);
      }
    });
    stmt.finalize();
  });
}

// Check if we should trigger an alert
function shouldTriggerAlert(queueNumber) {
  if (!ALERT_NUMBERS.includes(queueNumber)) {
    return false;
  }

  // Only trigger alert if we haven't already alerted for this number
  if (lastAlertNumber === queueNumber) {
    return false;
  }

  return true;
}

// Main queue checking function
async function checkQueue() {
  logger.info('Starting queue check...');

  try {
    // Take screenshot
    const screenshotSuccess = await takeScreenshot();
    if (!screenshotSuccess) {
      logger.error('Failed to take screenshot, skipping this check');
      return;
    }

    // Extract queue number
    const queueNumber = await getQueueNumberFromImage(SCREENSHOT_PATH);

    if (queueNumber === null) {
      logger.warn('Could not extract queue number from screenshot');
      return;
    }

    if (queueNumber === -1) {
      logger.info('No queue number found in screenshot');
      return;
    }

    logger.info(`Detected queue number: ${queueNumber}`);

    // Check if we should trigger an alert
    const triggerAlert = shouldTriggerAlert(queueNumber);

    if (triggerAlert) {
      logger.warn(`🚨 ALERT! Queue number is ${queueNumber} - Playing sound notification`);
      await playSound();
      lastAlertNumber = queueNumber;
    }

    // Log to database
    await logQueueNumber(queueNumber, triggerAlert);

    // Reset alert tracking if number goes back up (queue reset)
    if (queueNumber > 10) {
      lastAlertNumber = null;
    }

  } catch (error) {
    logger.error(`Queue check failed: ${error.message}`);
  }
}

// Start the queue watcher
export function startQueueWatcher() {
  logger.info('Queue Watcher starting...');

  // Initialize database
  initDatabase();

  // Perform initial check
  checkQueue();

  // Set up interval for continuous monitoring
  setInterval(checkQueue, INTERVAL_MS);

  logger.info(`Queue monitoring active - checking every ${INTERVAL_MS / 1000} seconds`);
}

// Export functions for external use
export { checkQueue, logQueueNumber, playSound };
