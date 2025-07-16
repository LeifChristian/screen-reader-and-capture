import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain, screen } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import { startNarrator, stopNarrator, exportSession, cleanupSession, getSessionData, setAppConfig, setScreenRegion } from './screen-narrator.js';
import apiKeyManager from './api-key-manager.js';
import sessionManager from './session-manager.js';

dotenv.config();

const IS_DEV = process.env.IS_DEV === 'true';

let tray = null;
let mainWindow = null;
let startupWindow = null;
let apiKeyWindow = null;
let regionSelectorWindow = null;
let regionOverlayWindow = null;
let appConfig = null;
let currentRegion = null;
let isAppReady = false;

function createStartupModal() {
  startupWindow = new BrowserWindow({
    width: 550,
    height: 650,
    show: true,
    center: true,
    alwaysOnTop: true,
    resizable: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  startupWindow.loadFile('startup-modal.html');

  startupWindow.on('closed', () => {
    startupWindow = null;
    // Don't quit the app on cancel - just hide to tray
  });
}

function createApiKeyWindow() {
  apiKeyWindow = new BrowserWindow({
    width: 500,
    height: 600,
    show: true,
    center: true,
    alwaysOnTop: true,
    resizable: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  apiKeyWindow.loadFile('api-key-setup.html');

  apiKeyWindow.on('closed', () => {
    apiKeyWindow = null;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false, // Don't show window initially
    webPreferences: {
      preload: path.join(process.cwd(), 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Make mainWindow globally accessible for the narrator
  global.mainWindow = mainWindow;

  mainWindow.loadFile('narrator.html');

  // Hide window when closed instead of quitting app
  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  // Handle app quit with export dialog
  mainWindow.on('closed', () => {
    global.mainWindow = null;
  });
}

function createRegionSelector() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  regionSelectorWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    show: true,
    fullscreen: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  regionSelectorWindow.loadFile('region-selector.html');

  regionSelectorWindow.on('closed', () => {
    regionSelectorWindow = null;
  });

  // Focus the window
  regionSelectorWindow.focus();
  regionSelectorWindow.setAlwaysOnTop(true, 'screen-saver');
}

function createRegionOverlay() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  regionOverlayWindow = new BrowserWindow({
    width: width,
    height: height,
    x: primaryDisplay.bounds.x,
    y: primaryDisplay.bounds.y,
    show: true,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  regionOverlayWindow.loadFile('region-overlay.html');
  regionOverlayWindow.setIgnoreMouseEvents(true);
  regionOverlayWindow.setAlwaysOnTop(false);

  regionOverlayWindow.on('closed', () => {
    regionOverlayWindow = null;
  });

  // Update overlay with current region
  if (currentRegion) {
    regionOverlayWindow.webContents.once('did-finish-load', () => {
      regionOverlayWindow.webContents.send('update-region', currentRegion);
    });
  }
}

function createTray() {
  // Create a simple tray icon
  const trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');

  tray = new Tray(trayIcon);

  const modeLabel = appConfig?.mode === 'notification' ? 'Notification Mode' : 'Check-in Mode';
  const statusLabel = appConfig?.mode === 'notification' ? 'Monitoring for alerts' : 'Continuous narration';

  let regionLabel, regionMenuItems;

  if (currentRegion) {
    regionLabel = `Target: ${currentRegion.width}×${currentRegion.height} at (${currentRegion.x}, ${currentRegion.y})`;
    regionMenuItems = [
      {
        label: '🎯 Select New Target Region',
        click: () => {
          createRegionSelector();
        }
      },
      {
        label: '👁️ Show Target Region',
        click: () => {
          if (regionOverlayWindow) {
            regionOverlayWindow.show();
            regionOverlayWindow.focus();
          } else {
            createRegionOverlay();
          }
        }
      },
      {
        label: '🖥️ Use Full Screen',
        click: () => {
          currentRegion = null;
          setScreenRegion(null);
          updateTrayMenu();

          // Hide overlay
          if (regionOverlayWindow) {
            regionOverlayWindow.close();
          }

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('region-updated', null);
          }
        }
      }
    ];
  } else {
    regionLabel = 'Full Screen';
    regionMenuItems = [
      {
        label: '🎯 Select Target Region',
        click: () => {
          createRegionSelector();
        }
      }
    ];
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Screen Narrator',
      type: 'normal',
      enabled: false
    },
    ...(appConfig ? [
      {
        label: modeLabel,
        type: 'normal',
        enabled: false
      },
      {
        label: regionLabel,
        type: 'normal',
        enabled: false
      }
    ] : []),
    {
      type: 'separator'
    },
    {
      label: 'Show Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      }
    },
    {
      label: '📁 File Manager',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('show-file-manager');
        } else {
          createMainWindow();
          mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('show-file-manager');
          });
        }
      }
    },
    {
      label: '🔑 API Key Settings',
      click: () => {
        createApiKeyWindow();
      }
    },
    {
      label: '⚙️ Start New Session',
      click: () => {
        createStartupModal();
      }
    },
    {
      type: 'separator'
    },
    ...(appConfig ? [
      ...regionMenuItems,
      {
        label: `Status: ${statusLabel}`,
        enabled: false
      },
      {
        type: 'separator'
      },
      {
        label: 'Export Current Session...',
        click: () => {
          showExportDialog();
        }
      },
      {
        type: 'separator'
      }
    ] : []),
    {
      label: 'Quit',
      click: () => {
        showQuitDialog();
      }
    }
  ]);

  const tooltipText = appConfig?.mode === 'notification'
    ? `Screen Narrator - Monitoring for: ${appConfig.searchPrompt?.substring(0, 50)}...`
    : 'Screen Narrator - AI-powered screen description';

  tray.setToolTip(tooltipText);
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });
}

// Update tray menu when region changes
function updateTrayMenu() {
  if (tray) {
    createTray(); // Recreate tray with updated menu
  }
}

// Handle startup configuration
function handleStartupConfig(config) {
  appConfig = config;

  // Set the narrator configuration
  setAppConfig(config);

  // Close startup modal
  if (startupWindow) {
    startupWindow.close();
  }

  // Create main window and tray
  createMainWindow();
  createTray();

  // Start the narrator
  startNarrator();
}

// Handle startup with region selection
function handleStartupWithRegionSelection(config) {
  appConfig = config;

  // Set the narrator configuration
  setAppConfig(config);

  // Close startup modal
  if (startupWindow) {
    startupWindow.close();
  }

  // Create main window and tray first
  createMainWindow();
  createTray();

  // Show region selector
  createRegionSelector();

  // Don't start narrator yet - wait for region selection
}

// Show export dialog
async function showExportDialog() {
  if (!mainWindow) return;

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

// Handle region selection
ipcMain.on('region-selected', (event, region) => {
  currentRegion = region; // Update currentRegion
  setScreenRegion(region);
  updateTrayMenu();

  if (regionSelectorWindow) {
    regionSelectorWindow.close();
  }

  // Create or update overlay
  if (regionOverlayWindow) {
    regionOverlayWindow.webContents.send('update-region', region);
  } else {
    createRegionOverlay();
  }

  // Now start the narrator with the selected region
  startNarrator();

  // Notify main window of region change
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('region-updated', region);
  }

  // Show confirmation dialog
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Region Selected',
      message: 'Target region set successfully!',
      detail: `The app will now monitor a ${region.width}×${region.height} region at position (${region.x}, ${region.y})`
    });
  }
});

// Handle region selection cancellation
ipcMain.on('region-selection-cancelled', () => {
  if (regionSelectorWindow) {
    regionSelectorWindow.close();
  }

  // If this was during startup, quit the app
  if (!appConfig || !getSessionData().captureCount) {
    app.quit();
  }
});

// Handle overlay region requests
ipcMain.on('get-current-region', (event) => {
  event.reply('update-region', currentRegion);
});

// API Key Management IPC handlers
ipcMain.handle('test-api-key', async (event, apiKey) => {
  try {
    const isValid = await apiKeyManager.testApiKey(apiKey);
    return { success: isValid, error: isValid ? null : 'Invalid API key or insufficient permissions' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-api-key', async (event, apiKey) => {
  try {
    const success = apiKeyManager.hashAndStore(apiKey);
    return { success, error: success ? null : 'Failed to save API key' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.on('api-key-setup-complete', () => {
  if (apiKeyWindow) {
    apiKeyWindow.close();
  }
  // Continue with app initialization
  checkApiKeyAndContinue();
});

ipcMain.on('api-key-setup-skipped', () => {
  if (apiKeyWindow) {
    apiKeyWindow.close();
  }
  // Continue without API key (limited functionality)
});

// Session Management IPC handlers
ipcMain.handle('get-all-sessions', async () => {
  try {
    const sessions = sessionManager.getAllSessions();
    return { success: true, sessions };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-session-stats', async () => {
  try {
    const stats = sessionManager.getSessionStats();
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-session', async (event, sessionId) => {
  try {
    const result = sessionManager.deleteSession(sessionId);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-session-with-picker', async (event, sessionId, includeScreenshots) => {
  try {
    const defaultName = `screen_narrator_session_${sessionId.substring(0, 8)}_${new Date().toISOString().split('T')[0]}`;
    const fileType = includeScreenshots ? 'zip' : 'txt';

    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Session',
      defaultPath: `${defaultName}.${fileType}`,
      filters: includeScreenshots
        ? [{ name: 'ZIP Files', extensions: ['zip'] }]
        : [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (saveResult.canceled) {
      return { success: false, cancelled: true };
    }

    const exportPath = saveResult.filePath.replace(/\.[^/.]+$/, ''); // Remove extension
    const result = await sessionManager.exportSession(sessionId, exportPath, includeScreenshots);

    if (result.success) {
      return {
        success: true,
        path: result.path,
        size: sessionManager.formatSize(result.size)
      };
    } else {
      return result;
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check API key and continue app initialization
function checkApiKeyAndContinue() {
  if (IS_DEV || apiKeyManager.hasStoredKey()) {
    isAppReady = true;
    if (!tray) {
      createTray();
    }
  } else {
    // Show API key setup
    createApiKeyWindow();
  }
}

// Handle startup configuration from modal
ipcMain.on('start-app-with-config', (event, config) => {
  handleStartupConfig(config);
});

// Handle startup with region selection
ipcMain.on('start-app-with-region-selection', (event, config) => {
  handleStartupWithRegionSelection(config);
});

// Handle setup cancellation
ipcMain.on('cancel-setup', () => {
  if (startupWindow) {
    startupWindow.close();
  }
  // Don't quit the app, just close the modal
});

// IPC handlers for renderer communication
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
  // Check API key first
  checkApiKeyAndContinue();
});

app.on('window-all-closed', () => {
  // Don't quit the app when all windows are closed (keep running in tray)
  if (process.platform !== 'darwin') {
    // Keep running
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createStartupModal();
  }
});

// Handle app quit
app.on('before-quit', (event) => {
  if (tray) {
    tray.destroy();
  }

  // Close overlay window
  if (regionOverlayWindow) {
    regionOverlayWindow.close();
  }

  stopNarrator();
});
