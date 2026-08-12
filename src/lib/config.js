import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(ROOT_DIR, '.runtime-config.json');

export const APP_NAME = 'Screen Narrator';
export const DEFAULT_INTERVAL_MS = 60 * 1000;
export const DEFAULT_MODEL = 'gpt-4o';
export const MAX_HISTORY_ENTRIES = 3;
export const MAX_TOKENS = 150;

dotenv.config({ path: path.join(ROOT_DIR, '.env') });

let apiKey = process.env.OPENAI_API_KEY || null;

export function loadStoredApiKey() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return config.openaiApiKey || null;
    }
  } catch (error) {
    console.error('Failed to load runtime config:', error.message);
  }
  return null;
}

export function setApiKey(key) {
  apiKey = (key || '').trim();
}

export function getApiKey() {
  return apiKey;
}

export function saveApiKey(key) {
  const trimmed = (key || '').trim();
  if (!trimmed) return;
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ openaiApiKey: trimmed }, null, 2));
    apiKey = trimmed;
  } catch (error) {
    console.error('Failed to save runtime config:', error.message);
  }
}

export function isValidApiKey(key) {
  const value = (key || '').trim();
  return value.startsWith('sk-') && value.length > 20;
}
