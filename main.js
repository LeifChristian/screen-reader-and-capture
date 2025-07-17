import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain, screen } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { startNarrator, stopNarrator, exportSession, cleanupSession, getSessionData, setAppConfig, setScreenRegion, setCaptureFrequency, getCaptureFrequency, getWebhookHealthStatus } from './screen-narrator.js';
import apiKeyManager from './api-key-manager.js';
import sessionManager from './session-manager.js';
import settingsManager from './settings-manager.js';
import volumeControl from './volume-control.js';
import fs from 'fs';

dotenv.config();

const IS_DEV = process.env.IS_DEV === 'true';

let tray = null;
let mainWindow = null;
let startupWindow = null;
let apiKeyWindow = null;
let regionSelectorWindows = [];
let regionOverlayWindow = null;
let flashIndicatorWindow = null;
let appConfig = null;
let currentRegion = null;
let isAppReady = false;

function createStartupModal() {
  console.log('🔥 createStartupModal() called');

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

  console.log('🔥 Startup modal created');

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
  console.log('🔥 createMainWindow() called');

  const savedBounds = settingsManager.getWindowBounds();

  mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    show: false, // Never show automatically
    webPreferences: {
      preload: path.join(process.cwd(), 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  console.log('🔥 BrowserWindow created, show: false');

  // Make mainWindow globally accessible for the narrator
  global.mainWindow = mainWindow;

  mainWindow.loadFile('narrator.html');
  console.log('🔥 Loading narrator.html');

  // Save window bounds when resized or moved
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    settingsManager.setWindowBounds({ width: bounds.width, height: bounds.height });
  });

  // Hide window when closed instead of quitting app
  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  // Handle app quit with export dialog
  mainWindow.on('closed', () => {
    global.mainWindow = null;
  });

  // DO NOT show window automatically - only when user clicks tray
}

function getVirtualBounds() {
  const displays = screen.getAllDisplays();
  const bounds = {
    x: Math.min(...displays.map(d => d.bounds.x)),
    y: Math.min(...displays.map(d => d.bounds.y)),
    width: 0,
    height: 0
  };
  const maxRight = Math.max(...displays.map(d => d.bounds.x + d.bounds.width));
  const maxBottom = Math.max(...displays.map(d => d.bounds.y + d.bounds.height));
  bounds.width = maxRight - bounds.x;
  bounds.height = maxBottom - bounds.y;
  return bounds;
}

// Helper to close all region selector windows
function closeRegionSelectorWindows() {
  regionSelectorWindows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.close();
    }
  });
  regionSelectorWindows = [];
}

function createRegionSelector() {
  // If selector windows are already open, just focus them
  if (regionSelectorWindows.some(win => !win.isDestroyed())) {
    regionSelectorWindows.forEach(win => {
      if (!win.isDestroyed()) {
        win.focus();
      }
    });
    return;
  }

  // Create one transparent selector window per display
  const displays = screen.getAllDisplays();
  regionSelectorWindows = [];

  displays.forEach(display => {
    const { bounds, scaleFactor } = display;
    const displayWidth = bounds.width;
    const displayHeight = bounds.height;

    console.log('🖥️ Creating selector for display', display.id, {
      bounds,
      scaleFactor,
      displayWidth,
      displayHeight
    });

    const selectorWin = new BrowserWindow({
      width: displayWidth,
      height: displayHeight,
      x: bounds.x,
      y: bounds.y,
      show: true,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      enableLargerThanScreen: false,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Ensure window covers the full logical bounds of the display
    selectorWin.setBounds(bounds);

    selectorWin.loadFile('region-selector.html');

    // No zoomFactor applied; content runs at native DIP scale for transparency stability

    selectorWin.on('closed', () => {
      regionSelectorWindows = regionSelectorWindows.filter(w => w !== selectorWin);
    });

    selectorWin.setAlwaysOnTop(true, 'screen-saver');
    selectorWin.focus();

    regionSelectorWindows.push(selectorWin);
  });
}

function createRegionOverlay() {
  if (regionOverlayWindow && !regionOverlayWindow.isDestroyed()) {
    regionOverlayWindow.close();
  }

  const vb = getVirtualBounds();

  regionOverlayWindow = new BrowserWindow({
    width: vb.width,
    height: vb.height,
    x: vb.x,
    y: vb.y,
    show: true,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    enableLargerThanScreen: true,
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

  if (currentRegion) {
    regionOverlayWindow.webContents.once('did-finish-load', () => {
      regionOverlayWindow.webContents.send('update-region', currentRegion);
    });
  }
}

function createTray() {
  // Destroy existing tray if it exists
  if (tray) {
    console.log('🔥 Destroying existing tray');
    tray.destroy();
    tray = null;
  }

  console.log('🔥 Creating new tray');

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
      label: '🔊 Volume Control',
      click: () => {
        volumeControl.showVolumeSlider();
      }
    },
    {
      label: 'Show Dashboard',
      click: () => {
        showMainWindow();
      }
    },
    {
      label: '📁 File Manager',
      click: () => {
        showMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('show-file-manager');
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quick Access:',
      type: 'normal',
      enabled: false
    },
    {
      label: '  Left Click → Dashboard',
      type: 'normal',
      enabled: false
    },
    {
      label: '  Right Click → Volume',
      type: 'normal',
      enabled: false
    },
    {
      label: '  Double Click → Mute/Unmute',
      type: 'normal',
      enabled: false
    },
    {
      type: 'separator'
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
        label: '🛑 End Current Session',
        click: () => {
          endCurrentSession();
        }
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
        cleanupAndExit(true);
      }
    }
  ]);

  const tooltipText = appConfig?.mode === 'notification'
    ? `Screen Narrator - Monitoring for: ${appConfig.searchPrompt?.substring(0, 50)}...`
    : 'Screen Narrator - AI-powered screen description';

  tray.setToolTip(tooltipText);
  tray.setContextMenu(contextMenu);

  // Left click to show dashboard
  tray.on('click', () => {
    showMainWindow();
  });

  // Right click to show volume slider
  tray.on('right-click', () => {
    volumeControl.showVolumeSlider();
  });

  // Double click to toggle mute
  tray.on('double-click', async () => {
    await volumeControl.toggleMute();
  });

  console.log('🔥 Tray created successfully');
}

// Update tray menu when region changes
function updateTrayMenu() {
  if (tray) {
    console.log('🔥 Updating tray menu');
    createTray(); // Recreate tray with updated menu
  }
}

// Handle startup configuration
function handleStartupConfig(config) {
  console.log('🔥 handleStartupConfig called with:', config);

  appConfig = config;

  // Save last used mode
  settingsManager.setLastUsedMode(config.mode);

  // Set the narrator configuration
  setAppConfig(config);

  // Close startup modal
  if (startupWindow) {
    startupWindow.close();
  }

  console.log('🔥 About to create main window and tray');

  // Create main window and tray - but DON'T show window
  createMainWindow();
  createTray();

  console.log('🔥 Main window and tray created - app running in tray');

  // Start the narrator
  startNarrator();
}

// Handle startup with region selection
function handleStartupWithRegionSelection(config) {
  console.log('🔥 handleStartupWithRegionSelection called with:', config);

  appConfig = config;

  // Save last used mode
  settingsManager.setLastUsedMode(config.mode);

  // Set the narrator configuration
  setAppConfig(config);

  // Close startup modal
  if (startupWindow) {
    startupWindow.close();
  }

  // Create main window and tray first - but DON'T show window
  createMainWindow();
  createTray();

  console.log('🔥 Main window created, now showing region selector');

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
    // No session data, quit immediately
    app.quit();
    return;
  }

  // Only show dialog if we have a main window to show it in
  if (!mainWindow) {
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
  const displays = screen.getAllDisplays();

  // Compare against display bounds in PHYSICAL pixels for reliable matching
  const containingDisplay = (() => {
    for (const d of displays) {
      const physLeft = d.bounds.x * d.scaleFactor;
      const physTop = d.bounds.y * d.scaleFactor;
      const physRight = physLeft + d.bounds.width * d.scaleFactor;
      const physBottom = physTop + d.bounds.height * d.scaleFactor;

      if (region.x >= physLeft && region.x < physRight &&
        region.y >= physTop && region.y < physBottom) {
        return d;
      }
    }
    return null;
  })();

  if (containingDisplay) {
    region.displayIndex = displays.indexOf(containingDisplay);
  } else {
    // Fallback to primary display index 0
    region.displayIndex = 0;
  }

  currentRegion = region; // Update currentRegion

  // Save last used region
  settingsManager.setLastUsedRegion(region);

  setScreenRegion(region);
  updateTrayMenu();

  closeRegionSelectorWindows();

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
  closeRegionSelectorWindows();

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

// Rename session folder
ipcMain.handle('rename-session', async (event, sessionId, newName) => {
  try {
    const result = sessionManager.renameSession(sessionId, newName);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// List files inside a session
ipcMain.handle('list-session-files', async (event, sessionId) => {
  try {
    return sessionManager.listFilesInSession(sessionId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Save a single file from a session with a file picker
ipcMain.handle('save-session-file', async (event, sessionId, relativePath) => {
  try {
    const sessionPath = path.join(process.cwd(), 'sessions', sessionId);
    const absPath = path.join(sessionPath, relativePath);

    if (!fs.existsSync(absPath)) {
      return { success: false, error: 'File not found' };
    }

    const saveResult = await dialog.showSaveDialog(mainWindow ?? BrowserWindow.getFocusedWindow(), {
      defaultPath: path.basename(relativePath),
      title: 'Save Session File'
    });

    if (saveResult.canceled) {
      return { success: false, cancelled: true };
    }

    fs.copyFileSync(absPath, saveResult.filePath);
    return { success: true, savedTo: saveResult.filePath };
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
  console.log('🔥 checkApiKeyAndContinue() called');
  console.log('🔥 IS_DEV:', IS_DEV);
  console.log('🔥 hasStoredKey:', apiKeyManager.hasStoredKey());

  if (IS_DEV || apiKeyManager.hasStoredKey()) {
    console.log('🔥 API key check passed, setting isAppReady = true');
    isAppReady = true;

    // Only create tray if it doesn't exist
    if (!tray) {
      console.log('🔥 Creating tray (first time)');
      createTray();
    }

    // If we have an API key but no startup modal, show it
    if (!startupWindow && !appConfig) {
      console.log('🔥 No startup modal and no config, creating startup modal');
      createStartupModal();
    }
  } else {
    console.log('🔥 No API key, showing API key setup');
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

// End current session
function endCurrentSession() {
  try {
    // Stop the narrator
    stopNarrator();

    // Reset app config
    appConfig = null;

    // Update tray menu
    updateTrayMenu();

    // Notify main window if it exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session-ended');
    }

    // Show confirmation
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Session Ended',
        message: 'Current monitoring session has been stopped.',
        detail: 'You can start a new session from the tray menu or dashboard.'
      });
    }

    console.log('Session ended successfully');
  } catch (error) {
    console.error('Error ending session:', error);
  }
}

// IPC handlers for renderer communication
ipcMain.handle('get-session-data', () => {
  return getSessionData();
});

ipcMain.handle('set-capture-frequency', (event, value, unit) => {
  try {
    const success = setCaptureFrequency(value, unit);
    return { success, frequency: getCaptureFrequency() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-capture-frequency', () => {
  try {
    return { success: true, frequency: getCaptureFrequency() };
  } catch (error) {
    return { success: false, error: error.message };
  }
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

// IPC handlers for settings management
ipcMain.handle('get-user-settings', () => {
  try {
    return { success: true, settings: settingsManager.getAllSettings() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('reset-settings', () => {
  try {
    const settings = settingsManager.resetToDefaults();
    return { success: true, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-new-session', () => {
  try {
    // End current session if one is running
    if (appConfig) {
      endCurrentSession();
    }

    // Hide main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }

    // Create startup modal
    createStartupModal();

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('end-current-session', () => {
  try {
    endCurrentSession();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handlers for webhook management
ipcMain.handle('get-webhook-settings', () => {
  try {
    return { success: true, settings: settingsManager.getWebhookSettings() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-webhook-health', () => {
  try {
    return { success: true, health: getWebhookHealthStatus() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-webhook-settings', (event, webhookSettings) => {
  try {
    const settings = settingsManager.setWebhookSettings(webhookSettings);
    return { success: true, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-alarm-sound-settings', () => {
  try {
    return { success: true, settings: settingsManager.getAlarmSoundSettings() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-alarm-sound-settings', (event, alarmSoundSettings) => {
  try {
    const settings = settingsManager.setAlarmSoundSettings(alarmSoundSettings);
    return { success: true, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-webhook', async (event, webhookUrl) => {
  try {
    const testPayload = {
      eventType: 'TEST',
      data: {
        description: 'This is a test webhook from Screen Narrator',
        screenshotPath: null,
        captureNumber: 0,
        sessionId: 'test-session',
        eventTimestamp: new Date().toISOString(),
        mode: 'test'
      }
    };

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for tests

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Screen-Narrator-Webhook/1.0'
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        let responseData;
        try {
          responseData = await response.json();
        } catch (jsonError) {
          responseData = { status: 'received', note: 'Non-JSON response' };
        }
        return { success: true, status: response.status, response: responseData };
      } else {
        const errorData = await response.text();
        return { success: false, status: response.status, error: errorData };
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        return { success: false, error: 'Request timeout (10 seconds)' };
      }

      return { success: false, error: fetchError.message };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

function createFlashIndicator() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  flashIndicatorWindow = new BrowserWindow({
    width: width,
    height: height,
    x: primaryDisplay.bounds.x,
    y: primaryDisplay.bounds.y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  flashIndicatorWindow.loadFile('flash-indicator.html');
  flashIndicatorWindow.setIgnoreMouseEvents(true);
  flashIndicatorWindow.setAlwaysOnTop(true, 'screen-saver');

  flashIndicatorWindow.on('closed', () => {
    flashIndicatorWindow = null;
  });
}

// Handle flash indicator trigger
ipcMain.on('trigger-flash-indicator', () => {
  if (!flashIndicatorWindow) {
    createFlashIndicator();
  }

  flashIndicatorWindow.show();
  flashIndicatorWindow.webContents.send('start-flash');
});

// Handle flash indicator hide
ipcMain.on('hide-flash-indicator', () => {
  if (flashIndicatorWindow) {
    flashIndicatorWindow.hide();
  }
});

// Volume control IPC handlers
ipcMain.handle('get-volume', async () => {
  return await volumeControl.getVolume();
});

ipcMain.handle('set-volume', async (event, volume) => {
  return await volumeControl.setVolume(volume);
});

ipcMain.handle('toggle-mute', async () => {
  return await volumeControl.toggleMute();
});

ipcMain.handle('is-muted', async () => {
  return await volumeControl.isMutedState();
});

app.whenReady().then(() => {
  console.log('🔥 App ready event fired');

  // Load last used region if available
  const lastRegion = settingsManager.getLastUsedRegion();
  if (lastRegion) {
    console.log('🔥 Loading last used region:', lastRegion);
    currentRegion = lastRegion;
  }

  // Check API key first
  console.log('🔥 Calling checkApiKeyAndContinue');
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

// Helper to fully clean up and exit the app
function cleanupAndExit(force = false) {
  try {
    console.log('🧹 Performing final cleanup before exit');

    // Stop narrator interval
    stopNarrator();

    // Destroy tray
    if (tray) {
      tray.destroy();
      tray = null;
    }

    // Close auxiliary windows
    [regionOverlayWindow, flashIndicatorWindow, ...regionSelectorWindows].forEach(win => {
      if (win && !win.isDestroyed()) {
        win.destroy();
      }
    });

    // Additional timers / handles can be cleared here if needed
  } catch (err) {
    console.error('Cleanup error:', err);
  } finally {
    // Force exit if requested (Windows sometimes keeps the process alive)
    if (force) {
      console.log('🛑 Force-exiting Electron process');
      app.exit(0); // equals process.exit(0) but safer in Electron
    }
  }
}

// Handle app quit
app.on('before-quit', (event) => {
  cleanupAndExit();
});

// Helper function to show main window
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    // Wait for window to be ready before showing
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}
