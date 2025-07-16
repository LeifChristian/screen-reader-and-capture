import CryptoJS from 'crypto-js';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

const STORAGE_KEY = 'openai_api_key_hash';
const ENCRYPTION_KEY = 'screen-narrator-key-2024'; // In production, this should be more secure

class ApiKeyManager {
    constructor() {
        this.storageFile = path.join(app.getPath('userData'), 'api-key-storage.json');
    }

    // Hash and encrypt the API key for storage
    hashAndStore(apiKey) {
        try {
            const encrypted = CryptoJS.AES.encrypt(apiKey, ENCRYPTION_KEY).toString();
            const storage = {
                [STORAGE_KEY]: encrypted,
                timestamp: Date.now()
            };

            fs.writeFileSync(this.storageFile, JSON.stringify(storage, null, 2));
            return true;
        } catch (error) {
            console.error('Error storing API key:', error);
            return false;
        }
    }

    // Retrieve and decrypt the API key
    getStoredKey() {
        try {
            if (!fs.existsSync(this.storageFile)) {
                return null;
            }

            const storage = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
            const encrypted = storage[STORAGE_KEY];

            if (!encrypted) {
                return null;
            }

            const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
            return decrypted || null;
        } catch (error) {
            console.error('Error retrieving API key:', error);
            return null;
        }
    }

    // Check if API key is stored
    hasStoredKey() {
        return this.getStoredKey() !== null;
    }

    // Clear stored API key
    clearStoredKey() {
        try {
            if (fs.existsSync(this.storageFile)) {
                fs.unlinkSync(this.storageFile);
            }
            return true;
        } catch (error) {
            console.error('Error clearing API key:', error);
            return false;
        }
    }

    // Validate API key format (basic check)
    validateApiKey(apiKey) {
        return apiKey &&
            typeof apiKey === 'string' &&
            apiKey.trim().length > 20 &&
            apiKey.startsWith('sk-');
    }

    // Test API key by making a simple request
    async testApiKey(apiKey) {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            console.error('Error testing API key:', error);
            return false;
        }
    }
}

export default new ApiKeyManager(); 