import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import winston from 'winston';
import screenshot from 'screenshot-desktop';
import say from 'say';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import apiKeyManager from './api-key-manager.js';
import settingsManager from './settings-manager.js';
import { BrowserWindow } from 'electron';

dotenv.config();

const IS_DEV = process.env.IS_DEV === 'true';
// Load frequency from settings manager, default to 5 minutes
const savedFrequency = settingsManager.getCaptureFrequency();
let INTERVAL_MS = savedFrequency.intervalMs;
const SESSION_ID = uuidv4();
const SESSION_DIR = path.join(process.cwd(), 'sessions', SESSION_ID);
const SCREENSHOTS_DIR = path.join(SESSION_DIR, 'screenshots');
const SOUND_PATH = path.join(process.cwd(), 'sound.wav');

// Get API key from manager or environment
function getApiKey() {
    if (IS_DEV && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
        return process.env.OPENAI_API_KEY;
    }
    return apiKeyManager.getStoredKey();
}

// App configuration
let appConfig = {
    mode: 'checkin', // 'checkin' or 'notification'
    searchPrompt: null,
    region: null // { x, y, width, height } for targeted screenshots
};

// Ensure session directories exist
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

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
        new winston.transports.File({ filename: path.join(SESSION_DIR, 'session.log') }),
        new winston.transports.Console()
    ]
});

// Session state
let conversationHistory = [];
let captureCount = 0;
let isNarrating = false;
let narratorInterval = null;

// Initialize session log
const sessionLogPath = path.join(SESSION_DIR, 'descriptions.txt');
fs.writeFileSync(sessionLogPath, `Screen Narrator Session - ${new Date().toISOString()}\n${'='.repeat(50)}\n\n`);

// Set app configuration
function setAppConfig(config) {
    appConfig = { ...appConfig, ...config };
    logger.info(`App configured for ${appConfig.mode} mode`);
    if (appConfig.mode === 'notification') {
        logger.info(`Watching for: ${appConfig.searchPrompt}`);
    }
    if (appConfig.region) {
        logger.info(`Using region: ${appConfig.region.width}x${appConfig.region.height} at (${appConfig.region.x}, ${appConfig.region.y})`);
    }
}

// Set screen region
function setScreenRegion(region) {
    appConfig.region = region;
    if (region) {
        logger.info(`Screen region set: ${region.width}x${region.height} at (${region.x}, ${region.y})`);
    } else {
        logger.info('Screen region cleared - using full screen');
    }
}

// Play sound notification (alarm)
function playAlarmSound() {
    return new Promise((resolve) => {
        const platform = process.platform;
        let command;

        if (platform === 'win32') {
            command = `powershell -command "& {Add-Type -TypeDefinition 'using System; using System.Media; public class Sound { public static void Play(string path) { using (var player = new SoundPlayer(path)) { player.PlaySync(); } } }'; [Sound]::Play('${SOUND_PATH.replace(/\\/g, '\\\\')}')}"`;
        } else if (platform === 'darwin') {
            command = `afplay "${SOUND_PATH}"`;
        } else {
            command = `aplay "${SOUND_PATH}"`;
        }

        exec(command, (error) => {
            if (error) {
                logger.error(`Alarm sound playback error: ${error.message}`);
            } else {
                logger.info('Alarm sound played successfully');
            }
            resolve();
        });
    });
}

// Text-to-speech function
function speakText(text) {
    return new Promise((resolve, reject) => {
        // Remove [ALARM] marker from text before speaking
        const cleanText = text.replace(/\[ALARM\]/g, '').trim();

        if (process.platform === 'win32') {
            say.speak(cleanText, 'Microsoft Zira Desktop', 1.3, (err) => {
                if (err) {
                    logger.error(`TTS Error: ${err.message}`);
                    reject(err);
                } else {
                    logger.info('TTS playback completed');
                    resolve();
                }
            });
        } else {
            // For macOS/Linux
            say.speak(cleanText, null, 1.3, (err) => {
                if (err) {
                    logger.error(`TTS Error: ${err.message}`);
                    reject(err);
                } else {
                    logger.info('TTS playback completed');
                    resolve();
                }
            });
        }
    });
}

// Take screenshot and save to session
async function takeScreenshot() {
    try {
        captureCount++;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `capture_${captureCount.toString().padStart(3, '0')}_${timestamp}.png`;
        const filePath = path.join(SCREENSHOTS_DIR, filename);

        let img;

        if (appConfig.region) {
            // Take full screen screenshot first, then crop to region
            const fullScreenImg = await screenshot({ format: 'png' });

            // Use sharp or canvas to crop the image
            img = await sharp(fullScreenImg)
                .extract({
                    left: appConfig.region.x,
                    top: appConfig.region.y,
                    width: appConfig.region.width,
                    height: appConfig.region.height
                })
                .png()
                .toBuffer();

            logger.info(`Regional screenshot captured: ${appConfig.region.width}x${appConfig.region.height} at (${appConfig.region.x}, ${appConfig.region.y})`);
        } else {
            // Take full screen screenshot
            img = await screenshot({ format: 'png' });
            logger.info('Full screen screenshot captured');
        }

        fs.writeFileSync(filePath, img);

        logger.info(`Screenshot ${captureCount} captured: ${filename}`);
        return {
            path: filePath,
            filename: filename,
            captureNumber: captureCount,
            region: appConfig.region
        };
    } catch (error) {
        logger.error(`Screenshot failed: ${error.message}`);
        return null;
    }
}

// Get description from OpenAI Vision API
async function getScreenDescription(imagePath) {
    try {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        let contextPrompt;

        if (appConfig.mode === 'checkin') {
            // Check-in mode: continuous narration
            contextPrompt = "You are a screen narrator assistant. You're looking at a screenshot from the user's computer screen. Provide a natural, conversational description of what you see. Be concise but informative.";

            if (conversationHistory.length > 0) {
                contextPrompt += "\n\nPrevious context from recent screenshots:\n";
                conversationHistory.slice(-3).forEach((entry, index) => {
                    contextPrompt += `${entry.captureNumber}: ${entry.description}\n`;
                });
                contextPrompt += "\nNow describe this new screenshot, noting any changes or continuity:";
            }
        } else {
            // Notification mode: search for specific content
            contextPrompt = `You are monitoring a screenshot for specific content. The user is looking for: "${appConfig.searchPrompt}".

Analyze the screenshot carefully and determine if what the user is looking for is present or visible.

If you find what they're looking for:
- Start your response with [ALARM] (this exact text)
- Then provide a clear description of what you found and why it matches their search
- Be specific about where you see it and what makes it match their criteria

If you don't find what they're looking for:
- Simply provide a brief description of what you see instead
- Do NOT include [ALARM] in your response

Remember: Only include [ALARM] if you're confident you found what they're specifically looking for.`;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getApiKey()}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: contextPrompt
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
                max_tokens: 200,
            }),
        });

        const data = await response.json();

        if (data.error) {
            logger.error(`OpenAI API error: ${data.error.message}`);
            return null;
        }

        const description = data.choices?.[0]?.message?.content?.trim();
        if (!description) {
            logger.warn('No description received from OpenAI');
            return null;
        }

        return description;
    } catch (error) {
        logger.error(`Error getting description: ${error.message}`);
        return null;
    }
}

// Main capture and narrate function
async function captureAndNarrate() {
    if (isNarrating) {
        logger.info('Already processing a capture, skipping...');
        return;
    }

    isNarrating = true;
    logger.info('Starting capture and narration...');

    try {
        // Take screenshot
        const screenshot = await takeScreenshot();
        if (!screenshot) {
            logger.error('Failed to take screenshot');
            return;
        }

        // Get description
        const description = await getScreenDescription(screenshot.path);
        if (!description) {
            logger.error('Failed to get description');
            return;
        }

        // Check if this is an alarm trigger
        const isAlarmTriggered = description.includes('[ALARM]');

        // In notification mode, only keep screenshots if alarm is triggered
        if (appConfig.mode === 'notification' && !isAlarmTriggered) {
            // Delete the screenshot since no alarm was triggered
            try {
                fs.unlinkSync(screenshot.path);
                logger.info(`Screenshot deleted (no alarm triggered): ${screenshot.filename}`);
            } catch (deleteError) {
                logger.error(`Failed to delete screenshot: ${deleteError.message}`);
            }
        }

        // Create entry
        const entry = {
            captureNumber: screenshot.captureNumber,
            timestamp: new Date().toISOString(),
            filename: screenshot.filename,
            description: description,
            path: isAlarmTriggered || appConfig.mode === 'checkin' ? screenshot.path : null,
            isAlarm: isAlarmTriggered,
            mode: appConfig.mode
        };

        // Add to conversation history
        conversationHistory.push(entry);

        // Log to session file
        const logEntry = `Capture ${entry.captureNumber} - ${new Date(entry.timestamp).toLocaleString()} ${isAlarmTriggered ? '[ALARM]' : ''}\n`;
        const separator = '-'.repeat(50);
        const cleanDescription = description.replace(/\[ALARM\]/g, '').trim();
        fs.appendFileSync(sessionLogPath, `${logEntry}${separator}\n${cleanDescription}\n\n`);

        logger.info(`Capture ${entry.captureNumber}: ${cleanDescription}`);

        // Handle alarm if triggered
        if (isAlarmTriggered) {
            logger.warn(`🚨 ALARM TRIGGERED! Found: ${cleanDescription}`);

            // Play alarm sound
            await playAlarmSound();

            // Trigger visual flash indicator
            const allWindows = BrowserWindow.getAllWindows();
            const mainWindow = allWindows.find(win => win.webContents.getURL().includes('narrator.html'));

            if (mainWindow && !mainWindow.isDestroyed()) {
                // Send to main window for dashboard update
                mainWindow.webContents.send('trigger-flash-indicator');

                // Send to main process for flash indicator window
                mainWindow.webContents.send('trigger-flash-to-main');
            }
        }

        // Speak the description (only in check-in mode or when alarm is triggered)
        if (appConfig.mode === 'checkin' || isAlarmTriggered) {
            try {
                await speakText(description);
            } catch (ttsError) {
                logger.error(`TTS failed: ${ttsError.message}`);
            }
        }

        // Emit event for UI update (if main process is listening)
        if (global.mainWindow && !global.mainWindow.isDestroyed()) {
            global.mainWindow.webContents.send('new-capture', entry);
        }

    } catch (error) {
        logger.error(`Capture and narration failed: ${error.message}`);
    } finally {
        isNarrating = false;
    }
}

// Start the narrator
function startNarrator() {
    if (narratorInterval) {
        logger.info('Narrator already running');
        return;
    }

    logger.info('Starting Screen Narrator...');
    logger.info(`Mode: ${appConfig.mode}`);
    logger.info(`Session ID: ${SESSION_ID}`);
    logger.info(`Captures will be saved to: ${SCREENSHOTS_DIR}`);

    if (appConfig.mode === 'notification') {
        logger.info(`Monitoring for: ${appConfig.searchPrompt}`);
    }

    // Initial capture
    captureAndNarrate();

    // Set up interval
    narratorInterval = setInterval(captureAndNarrate, INTERVAL_MS);

    logger.info(`Screen narrator active - capturing every ${INTERVAL_MS / 1000} seconds`);
}

// Stop the narrator
function stopNarrator() {
    if (narratorInterval) {
        clearInterval(narratorInterval);
        narratorInterval = null;
        logger.info('Screen narrator stopped');
    }
}

// Export session data
async function exportSession(includeScreenshots = false, exportPath = null) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultPath = path.join(process.cwd(), `session_export_${timestamp}`);
        const basePath = exportPath || defaultPath;

        if (includeScreenshots) {
            // Create zip file with screenshots and descriptions
            const zipPath = `${basePath}.zip`;
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                logger.info(`Session exported to: ${zipPath} (${archive.pointer()} bytes)`);
            });

            archive.on('error', (err) => {
                throw err;
            });

            archive.pipe(output);

            // Add descriptions file
            archive.file(sessionLogPath, { name: 'descriptions.txt' });

            // Add all screenshots
            const screenshots = fs.readdirSync(SCREENSHOTS_DIR);
            screenshots.forEach(filename => {
                const filePath = path.join(SCREENSHOTS_DIR, filename);
                archive.file(filePath, { name: `screenshots/${filename}` });
            });

            await archive.finalize();
            return zipPath;
        } else {
            // Just export descriptions
            const textPath = `${basePath}_descriptions.txt`;
            fs.copyFileSync(sessionLogPath, textPath);
            logger.info(`Descriptions exported to: ${textPath}`);
            return textPath;
        }
    } catch (error) {
        logger.error(`Export failed: ${error.message}`);
        throw error;
    }
}

// Cleanup session
function cleanupSession() {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            logger.info('Session data cleaned up');
        }
    } catch (error) {
        logger.error(`Cleanup failed: ${error.message}`);
    }
}

// Set capture frequency
function setCaptureFrequency(value, unit) {
    let newIntervalMs;

    switch (unit) {
        case 'seconds':
            newIntervalMs = value * 1000;
            break;
        case 'minutes':
            newIntervalMs = value * 60 * 1000;
            break;
        case 'hours':
            newIntervalMs = value * 60 * 60 * 1000;
            break;
        case 'days':
            newIntervalMs = value * 24 * 60 * 60 * 1000;
            break;
        default:
            logger.error(`Invalid frequency unit: ${unit}`);
            return false;
    }

    // Minimum interval of 10 seconds
    if (newIntervalMs < 10000) {
        logger.warn('Minimum capture interval is 10 seconds');
        newIntervalMs = 10000;
    }

    // Maximum interval of 7 days
    if (newIntervalMs > 7 * 24 * 60 * 60 * 1000) {
        logger.warn('Maximum capture interval is 7 days');
        newIntervalMs = 7 * 24 * 60 * 60 * 1000;
    }

    const oldInterval = INTERVAL_MS;
    INTERVAL_MS = newIntervalMs;

    // Save to settings manager
    settingsManager.setCaptureFrequency(value, unit);

    logger.info(`Capture frequency changed from ${oldInterval / 1000}s to ${INTERVAL_MS / 1000}s`);

    // If narrator is running, restart with new interval
    if (narratorInterval) {
        clearInterval(narratorInterval);
        narratorInterval = setInterval(captureAndNarrate, INTERVAL_MS);
        logger.info('Narrator restarted with new frequency');
    }

    return true;
}

// Get current capture frequency
function getCaptureFrequency() {
    const savedSettings = settingsManager.getCaptureFrequency();
    return {
        intervalMs: INTERVAL_MS,
        intervalSeconds: INTERVAL_MS / 1000,
        intervalMinutes: INTERVAL_MS / (60 * 1000),
        intervalHours: INTERVAL_MS / (60 * 60 * 1000),
        intervalDays: INTERVAL_MS / (24 * 60 * 60 * 1000),
        value: savedSettings.value,
        unit: savedSettings.unit
    };
}

// Get current session data for UI
function getSessionData() {
    return {
        sessionId: SESSION_ID,
        captureCount: captureCount,
        conversationHistory: conversationHistory,
        isNarrating: isNarrating,
        sessionDir: SESSION_DIR,
        mode: appConfig.mode,
        searchPrompt: appConfig.searchPrompt,
        frequency: getCaptureFrequency()
    };
}

export {
    startNarrator,
    stopNarrator,
    captureAndNarrate,
    exportSession,
    cleanupSession,
    getSessionData,
    speakText,
    setAppConfig,
    setScreenRegion,
    setCaptureFrequency,
    getCaptureFrequency
}; 