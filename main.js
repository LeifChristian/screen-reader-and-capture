import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { startQueueWatcher } from './capture.js';

let tray = null;
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    show: false, // Don't show window initially
    webPreferences: {
      preload: path.join(process.cwd(), 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Hide window when closed instead of quitting app
  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  // Create a simple tray icon (you can replace this with a proper icon file)
  const trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Queue Watcher',
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
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Queue Watcher - Monitoring your queue position');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  startQueueWatcher(); // Start monitoring immediately
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

// Prevent the app from quitting when the last window is closed
app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
  }
});
