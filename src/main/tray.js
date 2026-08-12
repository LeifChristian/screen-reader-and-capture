import { Tray, Menu } from 'electron';
import { createTrayIcon } from './windows.js';
import { APP_NAME } from '../lib/config.js';

export function createTray(mainWindow, handlers) {
  const tray = new Tray(createTrayIcon());

  const contextMenu = Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
    { type: 'separator' },
    {
      label: 'Show Dashboard',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { label: 'Status: Running', enabled: false },
    { type: 'separator' },
    {
      label: 'Export Session...',
      click: () => handlers.onExport()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => handlers.onQuit()
    }
  ]);

  tray.setToolTip(`${APP_NAME} - AI-powered screen description`);
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}
