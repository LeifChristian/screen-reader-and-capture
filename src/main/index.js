import { app, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  loadStoredApiKey,
  saveApiKey,
  setApiKey,
  isValidApiKey
} from '../lib/config.js';
import { ScreenNarrator } from '../services/narrator.js';
import { createDashboardWindow, createSetupWindow } from './windows.js';
import { createTray } from './tray.js';
import {
  showExportOptionsDialog,
  showSaveExportDialog,
  showQuitConfirmationDialog,
  showExportCompleteDialog,
  showExportErrorDialog
} from './dialogs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');

let mainWindow = null;
let setupWindow = null;
let tray = null;
let narrator = null;

function ensureApiKey() {
  const storedKey = loadStoredApiKey();
  if (storedKey && isValidApiKey(storedKey)) {
    setApiKey(storedKey);
    return true;
  }
  return false;
}

function startApplication() {
  narrator = new ScreenNarrator();
  mainWindow = createDashboardWindow();
  global.mainWindow = mainWindow;

  tray = createTray(mainWindow, {
    onExport: handleExport,
    onQuit: handleQuit
  });

  narrator.start();
}

function handleSetupComplete(apiKey) {
  if (!isValidApiKey(apiKey)) {
    return { success: false, error: 'Please enter a valid OpenAI API key starting with sk-' };
  }

  setApiKey(apiKey);
  saveApiKey(apiKey);

  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.destroy();
    setupWindow = null;
  }

  startApplication();
  return { success: true };
}

async function handleExport() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const options = await showExportOptionsDialog(mainWindow);
  if (!options) return;

  const filePath = await showSaveExportDialog(mainWindow, options.includeScreenshots);
  if (!filePath) return;

  try {
    const exportPath = filePath.replace(/\.[^/.]+$/, '');
    const result = await narrator.exportSession(options.includeScreenshots, exportPath);
    await showExportCompleteDialog(mainWindow, result);
  } catch (error) {
    showExportErrorDialog(mainWindow, error.message);
  }
}

async function handleQuit() {
  if (!narrator) {
    app.quit();
    return;
  }

  const captureCount = narrator.getSessionData().captureCount;

  if (captureCount === 0) {
    narrator.stop();
    app.quit();
    return;
  }

  const response = await showQuitConfirmationDialog(mainWindow, captureCount);

  switch (response) {
    case 0: // Cancel
      return;
    case 1: // Quit without saving
      narrator.stop();
      app.quit();
      break;
    case 2: // Export & Quit
      await handleExport();
      narrator.stop();
      app.quit();
      break;
  }
}

function registerIpcHandlers() {
  ipcMain.handle('get-config', () => ({
    openaiApiKey: loadStoredApiKey()
  }));

  ipcMain.handle('save-api-key', async (_event, apiKey) => {
    try {
      return handleSetupComplete(apiKey);
    } catch (error) {
      console.error('save-api-key failed:', error);
      return { success: false, error: error.message || 'Failed to start narrator' };
    }
  });

  ipcMain.handle('get-session-data', () => {
    return narrator ? narrator.getSessionData() : {};
  });

  ipcMain.handle('export-session', async (_event, includeScreenshots) => {
    if (!narrator) throw new Error('Narrator not running');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportPath = path.join(ROOT_DIR, `session_export_${timestamp}`);
    return narrator.exportSession(includeScreenshots, exportPath);
  });
}

app.whenReady().then(() => {
  console.log(`App ready. Platform: ${process.platform}`);

  if (app.dock) app.dock.show();

  registerIpcHandlers();

  if (ensureApiKey()) {
    console.log('Found stored API key, starting narrator...');
    startApplication();
  } else {
    console.log('No stored API key, showing setup window...');
    setupWindow = createSetupWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && ensureApiKey()) {
    startApplication();
  }
});

app.on('before-quit', () => {
  if (tray) tray.destroy();
  if (narrator) narrator.stop();
});
