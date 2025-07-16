import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

class SessionManager {
    constructor() {
        this.sessionsDir = path.join(process.cwd(), 'sessions');
    }

    // Get all sessions
    getAllSessions() {
        try {
            if (!fs.existsSync(this.sessionsDir)) {
                return [];
            }

            const sessionFolders = fs.readdirSync(this.sessionsDir);
            const sessions = [];

            for (const folder of sessionFolders) {
                const sessionPath = path.join(this.sessionsDir, folder);

                if (fs.statSync(sessionPath).isDirectory()) {
                    const sessionInfo = this.getSessionInfo(sessionPath, folder);
                    if (sessionInfo) {
                        sessions.push(sessionInfo);
                    }
                }
            }

            // Sort by creation date (newest first)
            return sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error('Error getting sessions:', error);
            return [];
        }
    }

    // Get session info
    getSessionInfo(sessionPath, sessionId) {
        try {
            const screenshotsDir = path.join(sessionPath, 'screenshots');
            const descriptionsFile = path.join(sessionPath, 'descriptions.txt');
            const logFile = path.join(sessionPath, 'session.log');

            let screenshotCount = 0;
            let size = 0;
            let createdAt = null;
            let lastModified = null;

            // Count screenshots
            if (fs.existsSync(screenshotsDir)) {
                const screenshots = fs.readdirSync(screenshotsDir);
                screenshotCount = screenshots.length;
            }

            // Calculate total size
            const calculateDirSize = (dirPath) => {
                let totalSize = 0;
                if (fs.existsSync(dirPath)) {
                    const items = fs.readdirSync(dirPath);
                    for (const item of items) {
                        const itemPath = path.join(dirPath, item);
                        const stats = fs.statSync(itemPath);
                        if (stats.isDirectory()) {
                            totalSize += calculateDirSize(itemPath);
                        } else {
                            totalSize += stats.size;
                        }
                    }
                }
                return totalSize;
            };

            size = calculateDirSize(sessionPath);

            // Get creation date from first screenshot or descriptions file
            if (fs.existsSync(descriptionsFile)) {
                const stats = fs.statSync(descriptionsFile);
                createdAt = stats.birthtime;
                lastModified = stats.mtime;
            } else if (fs.existsSync(screenshotsDir)) {
                const screenshots = fs.readdirSync(screenshotsDir);
                if (screenshots.length > 0) {
                    const firstScreenshot = path.join(screenshotsDir, screenshots[0]);
                    const stats = fs.statSync(firstScreenshot);
                    createdAt = stats.birthtime;
                    lastModified = stats.mtime;
                }
            }

            // Get mode from log file
            let mode = 'unknown';
            if (fs.existsSync(logFile)) {
                const logContent = fs.readFileSync(logFile, 'utf8');
                const modeMatch = logContent.match(/App configured for (\w+) mode/);
                if (modeMatch) {
                    mode = modeMatch[1];
                }
            }

            return {
                id: sessionId,
                path: sessionPath,
                screenshotCount,
                size,
                createdAt: createdAt || new Date(),
                lastModified: lastModified || new Date(),
                mode,
                hasDescriptions: fs.existsSync(descriptionsFile),
                hasLog: fs.existsSync(logFile)
            };
        } catch (error) {
            console.error(`Error getting session info for ${sessionId}:`, error);
            return null;
        }
    }

    // Delete session
    deleteSession(sessionId) {
        try {
            const sessionPath = path.join(this.sessionsDir, sessionId);

            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                return { success: true };
            } else {
                return { success: false, error: 'Session not found' };
            }
        } catch (error) {
            console.error(`Error deleting session ${sessionId}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Export session
    async exportSession(sessionId, exportPath, includeScreenshots = true) {
        try {
            const sessionPath = path.join(this.sessionsDir, sessionId);

            if (!fs.existsSync(sessionPath)) {
                return { success: false, error: 'Session not found' };
            }

            const descriptionsFile = path.join(sessionPath, 'descriptions.txt');
            const screenshotsDir = path.join(sessionPath, 'screenshots');

            if (includeScreenshots) {
                // Create zip file with screenshots and descriptions
                const zipPath = `${exportPath}.zip`;
                const output = fs.createWriteStream(zipPath);
                const archive = archiver('zip', { zlib: { level: 9 } });

                return new Promise((resolve, reject) => {
                    output.on('close', () => {
                        resolve({
                            success: true,
                            path: zipPath,
                            size: archive.pointer()
                        });
                    });

                    archive.on('error', (err) => {
                        reject({ success: false, error: err.message });
                    });

                    archive.pipe(output);

                    // Add descriptions file
                    if (fs.existsSync(descriptionsFile)) {
                        archive.file(descriptionsFile, { name: 'descriptions.txt' });
                    }

                    // Add all screenshots
                    if (fs.existsSync(screenshotsDir)) {
                        const screenshots = fs.readdirSync(screenshotsDir);
                        screenshots.forEach(filename => {
                            const filePath = path.join(screenshotsDir, filename);
                            archive.file(filePath, { name: `screenshots/${filename}` });
                        });
                    }

                    archive.finalize();
                });
            } else {
                // Just export descriptions
                const textPath = `${exportPath}.txt`;

                if (fs.existsSync(descriptionsFile)) {
                    fs.copyFileSync(descriptionsFile, textPath);
                    return {
                        success: true,
                        path: textPath,
                        size: fs.statSync(textPath).size
                    };
                } else {
                    return { success: false, error: 'No descriptions file found' };
                }
            }
        } catch (error) {
            console.error(`Error exporting session ${sessionId}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Get session statistics
    getSessionStats() {
        try {
            const sessions = this.getAllSessions();

            const stats = {
                totalSessions: sessions.length,
                totalScreenshots: sessions.reduce((sum, session) => sum + session.screenshotCount, 0),
                totalSize: sessions.reduce((sum, session) => sum + session.size, 0),
                modeBreakdown: {
                    checkin: sessions.filter(s => s.mode === 'checkin').length,
                    notification: sessions.filter(s => s.mode === 'notification').length,
                    unknown: sessions.filter(s => s.mode === 'unknown').length
                }
            };

            return stats;
        } catch (error) {
            console.error('Error getting session stats:', error);
            return {
                totalSessions: 0,
                totalScreenshots: 0,
                totalSize: 0,
                modeBreakdown: { checkin: 0, notification: 0, unknown: 0 }
            };
        }
    }

    // Format file size
    formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Clean up old sessions (optional utility)
    cleanupOldSessions(daysOld = 30) {
        try {
            const sessions = this.getAllSessions();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            let deletedCount = 0;

            for (const session of sessions) {
                if (session.createdAt < cutoffDate) {
                    const result = this.deleteSession(session.id);
                    if (result.success) {
                        deletedCount++;
                    }
                }
            }

            return { success: true, deletedCount };
        } catch (error) {
            console.error('Error cleaning up old sessions:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new SessionManager(); 