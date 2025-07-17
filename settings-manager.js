import { app } from 'electron';
import fs from 'fs';
import path from 'path';

class SettingsManager {
    constructor() {
        this.settingsFile = path.join(app.getPath('userData'), 'user-settings.json');
        // Default settings
        const DEFAULT_SETTINGS = {
            captureFrequency: {
                value: 5,
                unit: 'minutes',
                intervalMs: 5 * 60 * 1000 // 5 minutes in milliseconds
            },
            lastUsedMode: 'checkin',
            lastUsedRegion: null,
            windowBounds: {
                width: 1200,
                height: 800
            },
            webhook: {
                enabled: false,
                url: '',
                sendOnAlarm: true,
                sendOnCheckin: false,
                timeout: 5000, // 5 seconds timeout
                retries: 3
            },
            alarmSound: {
                enabled: true
            }
        };

        this.settings = this.loadSettings();
    }

    // Load settings from file
    loadSettings() {
        try {
            if (fs.existsSync(this.settingsFile)) {
                const data = fs.readFileSync(this.settingsFile, 'utf8');
                const loadedSettings = JSON.parse(data);

                // Merge with defaults to ensure all properties exist
                return { ...this.defaultSettings, ...loadedSettings };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }

        // Return defaults if file doesn't exist or there's an error
        return { ...this.defaultSettings };
    }

    // Save settings to file
    saveSettings() {
        try {
            const settingsDir = path.dirname(this.settingsFile);
            if (!fs.existsSync(settingsDir)) {
                fs.mkdirSync(settingsDir, { recursive: true });
            }

            fs.writeFileSync(this.settingsFile, JSON.stringify(this.settings, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    // Get a setting value
    get(key) {
        return this.settings[key];
    }

    // Set a setting value
    set(key, value) {
        this.settings[key] = value;
        this.saveSettings();
    }

    // Get capture frequency settings
    getCaptureFrequency() {
        return this.settings.captureFrequency;
    }

    // Set capture frequency settings
    setCaptureFrequency(value, unit) {
        let intervalMs;

        switch (unit) {
            case 'seconds':
                intervalMs = value * 1000;
                break;
            case 'minutes':
                intervalMs = value * 60 * 1000;
                break;
            case 'hours':
                intervalMs = value * 60 * 60 * 1000;
                break;
            case 'days':
                intervalMs = value * 24 * 60 * 60 * 1000;
                break;
            default:
                throw new Error(`Invalid frequency unit: ${unit}`);
        }

        this.settings.captureFrequency = {
            value: value,
            unit: unit,
            intervalMs: intervalMs
        };

        this.saveSettings();
        return this.settings.captureFrequency;
    }

    // Get last used mode
    getLastUsedMode() {
        return this.settings.lastUsedMode;
    }

    // Set last used mode
    setLastUsedMode(mode) {
        this.settings.lastUsedMode = mode;
        this.saveSettings();
    }

    // Get last used region
    getLastUsedRegion() {
        return this.settings.lastUsedRegion;
    }

    // Set last used region
    setLastUsedRegion(region) {
        this.settings.lastUsedRegion = region;
        this.saveSettings();
    }

    // Get window bounds
    getWindowBounds() {
        return this.settings.windowBounds;
    }

    // Set window bounds
    setWindowBounds(bounds) {
        this.settings.windowBounds = bounds;
        this.saveSettings();
    }

    // Reset to defaults
    resetToDefaults() {
        this.settings = { ...this.defaultSettings };
        this.saveSettings();
        return this.settings;
    }

    // Get all settings
    getAllSettings() {
        return { ...this.settings };
    }

    // Get webhook settings
    getWebhookSettings() {
        return this.settings.webhook;
    }

    // Set webhook settings
    setWebhookSettings(webhookSettings) {
        this.settings.webhook = { ...this.settings.webhook, ...webhookSettings };
        this.saveSettings();
        return this.settings.webhook;
    }

    // Enable/disable webhook
    setWebhookEnabled(enabled) {
        this.settings.webhook.enabled = enabled;
        this.saveSettings();
        return this.settings.webhook;
    }

    // Set webhook URL
    setWebhookUrl(url) {
        this.settings.webhook.url = url;
        this.saveSettings();
        return this.settings.webhook;
    }

    // Get alarm sound settings
    getAlarmSoundSettings() {
        return this.settings.alarmSound;
    }

    // Set alarm sound settings
    setAlarmSoundSettings(alarmSoundSettings) {
        this.settings.alarmSound = { ...this.settings.alarmSound, ...alarmSoundSettings };
        this.saveSettings();
        return this.settings.alarmSound;
    }

    // Enable/disable alarm sound
    setAlarmSoundEnabled(enabled) {
        this.settings.alarmSound.enabled = enabled;
        this.saveSettings();
        return this.settings.alarmSound;
    }
}

export default new SettingsManager(); 