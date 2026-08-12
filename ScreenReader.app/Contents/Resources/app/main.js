import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { startNarrator, stopNarrator, exportSession, cleanupSession, getSessionData, setApiKey } from './screen-narrator.js';

let tray = null;
let mainWindow = null;
let setupWindow = null;

const CONFIG_PATH = path.join(process.cwd(), '.runtime-config.json');

function loadStoredApiKey() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return config.openaiApiKey || null;
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  return null;
}

function saveApiKey(key) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ openaiApiKey: key }, null, 2));
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 500,
    height: 400,
    show: true,
    alwaysOnTop: true,
    resizable: false,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  setupWindow.loadFile('setup.html').catch(err => {
    console.error('Failed to load setup.html:', err);
  });

  setupWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Setup window failed to load:', errorCode, errorDescription);
  });

  setupWindow.webContents.on('did-finish-load', () => {
    console.log('Setup window loaded');
    setupWindow.center();
    setupWindow.focus();
    if (app.focus) {
      app.focus({ steal: true });
    }
    if (app.dock) app.dock.show();
  });

  setupWindow.on('closed', () => {
    console.log('Setup window closed');
    setupWindow = null;
    if (!mainWindow && process.platform === 'darwin') {
      app.quit();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(process.cwd(), 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Make mainWindow globally accessible for the narrator
  global.mainWindow = mainWindow;

  mainWindow.loadFile('narrator.html');

  mainWindow.focus();
  if (app.dock) app.dock.show();
  if (app.focus) app.focus({ steal: true });

  // On Windows, hide to tray on close. On macOS, just hide the window normally.
  mainWindow.on('close', (event) => {
    if (process.platform === 'win32') {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Handle app quit with export dialog
  mainWindow.on('closed', () => {
    global.mainWindow = null;
  });
}

function createTray() {
  // Create a simple tray icon (16x16 solid blue for macOS compatibility)
  const trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5wQGEx44F3QjhwAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVAgb24gYSBNYWOHqHdDAAAAjElEQVQ4y72Tyw2AMBBE30wB0EAJVEAJVMB9OKACSuC+O7CINkp+ELLI7Izt0YwB+Oq9p5RijEEpta01pYTWGgBKKYwxtNZgjGGtRSkFgLX2+QDnnOdZayXnTCllbm6+wDlHrTUppZxzSil472drrdFaQwg456SUCCGQUiLnjHMOYwy11nndnPM8jDHUWplz/j8+W7gB72nLc1RTE7AAAAAASUVORK5CYII=');

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Screen Narrator',
      type: 'normal',
      enabled: false
    },
    {
      type: 'separator'
    },
    {
      label: 'Show Dashboard',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Status: Running',
      enabled: false
    },
    {
      type: 'separator'
    },
    {
      label: 'Export Session...',
      click: () => {
        showExportDialog();
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      click: () => {
        showQuitDialog();
      }
    }
  ]);

  tray.setToolTip('Screen Narrator - AI-powered screen description');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// Show export dialog
async function showExportDialog() {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Cancel', 'Text Only', 'Text + Screenshots'],
    defaultId: 1,
    title: 'Export Session',
    message: 'How would you like to export your session?',
    detail: 'Text Only: Export just the descriptions\nText + Screenshots: Export descriptions and all screenshots in a ZIP file'
  });

  if (result.response === 0) return; // Cancel

  const includeScreenshots = result.response === 2;
  const fileType = includeScreenshots ? 'zip' : 'txt';
  const defaultName = `screen_narrator_session_${new Date().toISOString().split('T')[0]}`;

  const saveResult = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Session Export',
    defaultPath: `${defaultName}.${fileType}`,
    filters: includeScreenshots
      ? [{ name: 'ZIP Files', extensions: ['zip'] }]
      : [{ name: 'Text Files', extensions: ['txt'] }]
  });

  if (saveResult.canceled) return;

  try {
    const exportPath = saveResult.filePath.replace(/\.[^/.]+$/, ''); // Remove extension
    await exportSession(includeScreenshots, exportPath);

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Export Complete',
      message: 'Session exported successfully!',
      detail: `Saved to: ${saveResult.filePath}`
    });
  } catch (error) {
    dialog.showErrorBox('Export Failed', `Failed to export session: ${error.message}`);
  }
}

// Show quit dialog with export option
async function showQuitDialog() {
  const sessionData = getSessionData();

  if (sessionData.captureCount === 0) {
    app.quit();
    return;
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Cancel', 'Quit Without Saving', 'Export & Quit'],
    defaultId: 2,
    title: 'Quit Screen Narrator',
    message: `You have ${sessionData.captureCount} captures in this session.`,
    detail: 'Would you like to export your session before quitting?'
  });

  switch (result.response) {
    case 0: // Cancel
      return;
    case 1: // Quit without saving
      cleanupSession();
      app.quit();
      break;
    case 2: // Export & Quit
      await showExportDialog();
      cleanupSession();
      app.quit();
      break;
  }
}

// IPC handlers for renderer communication
ipcMain.handle('get-config', () => {
  return { openaiApiKey: loadStoredApiKey() };
});

ipcMain.handle('save-api-key', async (event, apiKey) => {
  try {
    const key = (apiKey || '').trim();
    if (!key || !key.startsWith('sk-')) {
      return { success: false, error: 'Please enter a valid OpenAI API key starting with sk-' };
    }

    setApiKey(key);
    saveApiKey(key);

    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.destroy();
      setupWindow = null;
    }

    createWindow();
    createTray();
    startNarrator();

    return { success: true };
  } catch (error) {
    console.error('save-api-key failed:', error);
    return { success: false, error: error.message || 'Failed to start narrator' };
  }
});

ipcMain.handle('get-session-data', () => {
  return getSessionData();
});

ipcMain.handle('export-session', async (event, includeScreenshots) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportPath = path.join(process.cwd(), `session_export_${timestamp}`);
    return await exportSession(includeScreenshots, exportPath);
  } catch (error) {
    throw error;
  }
});

app.whenReady().then(() => {
  console.log('App ready. Platform:', process.platform);

  if (app.dock) {
    app.dock.show();
  }

  const storedKey = loadStoredApiKey();
  if (storedKey && storedKey.startsWith('sk-')) {
    console.log('Found stored API key, starting narrator...');
    setApiKey(storedKey);
    createWindow();
    createTray();
    startNarrator();
    mainWindow.show();
  } else {
    console.log('No stored API key, showing setup window...');
    createSetupWindow();
  }
});

app.on('window-all-closed', () => {
  // On macOS, keep the app running in the tray unless explicitly quit
  // On Windows/Linux, quit when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app quit
app.on('before-quit', (event) => {
  if (tray) {
    tray.destroy();
  }
  stopNarrator();
});
