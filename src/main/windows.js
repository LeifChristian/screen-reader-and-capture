import { BrowserWindow, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { APP_NAME } from '../lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5wQGEx44F3QjhwAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVAgb24gYSBNYWOHqHdDAAAAjElEQVQ4y72Tyw2AMBBE30wB0EAJVEAJVMB9OKACSuC+O7CINkp+ELLI7Izt0YwB+Oq9p5RijEEpta01pYTWGgBKKYwxtNZgjGGtRSkFgLX2+QDnnOdZayXnTCllbm6+wDlHrTUppZxzSil472drrdFaQwg456SUCCGQUiLnjHMOYwy11nndnPM8jDHUWplz/j8+W7gB72nLc1RTE7AAAAAASUVORK5CYII=';

export function createTrayIcon() {
  return nativeImage.createFromDataURL(ICON_DATA_URL);
}

export function createSetupWindow() {
  const window = new BrowserWindow({
    width: 500,
    height: 400,
    show: true,
    alwaysOnTop: true,
    resizable: false,
    title: `${APP_NAME} - Setup`,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  window.loadFile(path.join(ROOT_DIR, 'src/renderer/setup.html'));
  return window;
}

export function createDashboardWindow() {
  const window = new BrowserWindow({
    width: 1000,
    height: 700,
    show: true,
    title: APP_NAME,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(ROOT_DIR, 'src/renderer/preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  window.loadFile(path.join(ROOT_DIR, 'src/renderer/dashboard.html'));

  window.on('close', (event) => {
    if (process.platform === 'win32') {
      event.preventDefault();
      window.hide();
    }
  });

  return window;
}
