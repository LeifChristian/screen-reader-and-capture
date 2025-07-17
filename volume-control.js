import loudness from 'loudness';
import { BrowserWindow, Menu, screen } from 'electron';

class VolumeControl {
    constructor() {
        this.volumeWindow = null;
        this.currentVolume = 50;
        this.isMuted = false;
        this.loadCurrentVolume();
    }

    // Load current system volume
    async loadCurrentVolume() {
        try {
            this.currentVolume = await loudness.getVolume();
            this.isMuted = await loudness.getMuted();
        } catch (error) {
            console.error('Error loading volume:', error);
            this.currentVolume = 50;
            this.isMuted = false;
        }
    }

    // Get current volume
    async getVolume() {
        try {
            return await loudness.getVolume();
        } catch (error) {
            console.error('Error getting volume:', error);
            return this.currentVolume;
        }
    }

    // Set volume (0-100)
    async setVolume(volume) {
        try {
            await loudness.setVolume(Math.max(0, Math.min(100, volume)));
            this.currentVolume = volume;
            return true;
        } catch (error) {
            console.error('Error setting volume:', error);
            return false;
        }
    }

    // Toggle mute
    async toggleMute() {
        try {
            this.isMuted = !this.isMuted;
            await loudness.setMuted(this.isMuted);
            return this.isMuted;
        } catch (error) {
            console.error('Error toggling mute:', error);
            return this.isMuted;
        }
    }

    // Check if muted
    async isMutedState() {
        try {
            return await loudness.getMuted();
        } catch (error) {
            console.error('Error checking mute state:', error);
            return this.isMuted;
        }
    }

    // Show volume slider window
    showVolumeSlider() {
        if (this.volumeWindow && !this.volumeWindow.isDestroyed()) {
            this.volumeWindow.focus();
            return;
        }

        this.volumeWindow = new BrowserWindow({
            width: 300,
            height: 120,
            show: false,
            frame: false,
            resizable: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            transparent: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        // Position near system tray (bottom right)
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;

        this.volumeWindow.setPosition(width - 320, height - 140);

        this.volumeWindow.loadFile('volume-slider.html');

        this.volumeWindow.once('ready-to-show', () => {
            this.volumeWindow.show();
        });

        this.volumeWindow.on('blur', () => {
            this.volumeWindow.close();
        });

        this.volumeWindow.on('closed', () => {
            this.volumeWindow = null;
        });

        // Auto-close after 5 seconds
        setTimeout(() => {
            if (this.volumeWindow && !this.volumeWindow.isDestroyed()) {
                this.volumeWindow.close();
            }
        }, 5000);
    }

    // Close volume slider
    closeVolumeSlider() {
        if (this.volumeWindow && !this.volumeWindow.isDestroyed()) {
            this.volumeWindow.close();
        }
    }
}

export default new VolumeControl(); 