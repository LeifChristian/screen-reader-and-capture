import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain } from 'electron';
import path from 'path';
import { startNarrator, stopNarrator, exportSession, cleanupSession, getSessionData } from './screen-narrator.js';

let tray = null;
let mainWindow = null;

function createWindow() {
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

function createTray() {
  // Create a simple tray icon
  const trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');

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
  createWindow();
  createTray();
  startNarrator(); // Start screen narration immediately
});

app.on('window-all-closed', () => {
  // Don't quit the app when all windows are closed (keep running in tray)
  if (process.platform !== 'darwin') {
    // Keep running
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
