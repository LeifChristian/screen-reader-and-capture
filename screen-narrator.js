import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import winston from 'winston';
import screenshot from 'screenshot-desktop';
import say from 'say';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const INTERVAL_MS = 60 * 1000; // 30 seconds between captures
const SESSION_ID = uuidv4();
const SESSION_DIR = path.join(process.cwd(), 'sessions', SESSION_ID);
const SCREENSHOTS_DIR = path.join(SESSION_DIR, 'screenshots');

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

// Text-to-speech function
function speakText(text) {
    return new Promise((resolve, reject) => {
        if (process.platform === 'win32') {
            say.speak(text, 'Microsoft Zira Desktop', 1.3, (err) => {
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
            say.speak(text, null, 1.3, (err) => {
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

        const img = await screenshot({ format: 'png' });
        fs.writeFileSync(filePath, img);

        logger.info(`Screenshot ${captureCount} captured: ${filename}`);
        return {
            path: filePath,
            filename: filename,
            captureNumber: captureCount
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

        // Build context from conversation history
        let contextPrompt = "You are a screen narrator assistant. You're looking at a screenshot from the user's computer screen. Provide a natural, conversational description of what you see. Be concise but informative.";

        if (conversationHistory.length > 0) {
            contextPrompt += "\n\nPrevious context from recent screenshots:\n";
            conversationHistory.slice(-3).forEach((entry, index) => {
                contextPrompt += `${entry.captureNumber}: ${entry.description}\n`;
            });
            contextPrompt += "\nNow describe this new screenshot, noting any changes or continuity:";
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`,
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
                max_tokens: 150,
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

        // Create entry
        const entry = {
            captureNumber: screenshot.captureNumber,
            timestamp: new Date().toISOString(),
            filename: screenshot.filename,
            description: description,
            path: screenshot.path
        };

        // Add to conversation history
        conversationHistory.push(entry);

        // Log to session file
        const logEntry = `Capture ${entry.captureNumber} - ${new Date(entry.timestamp).toLocaleString()}\n`;
        const separator = '-'.repeat(50);
        fs.appendFileSync(sessionLogPath, `${logEntry}${separator}\n${description}\n\n`);

        logger.info(`Capture ${entry.captureNumber}: ${description}`);

        // Speak the description
        try {
            await speakText(description);
        } catch (ttsError) {
            logger.error(`TTS failed: ${ttsError.message}`);
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
    logger.info(`Session ID: ${SESSION_ID}`);
    logger.info(`Captures will be saved to: ${SCREENSHOTS_DIR}`);

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

// Get current session data for UI
function getSessionData() {
    return {
        sessionId: SESSION_ID,
        captureCount: captureCount,
        conversationHistory: conversationHistory,
        isNarrating: isNarrating,
        sessionDir: SESSION_DIR
    };
}

export {
    startNarrator,
    stopNarrator,
    captureAndNarrate,
    exportSession,
    cleanupSession,
    getSessionData,
    speakText
}; 