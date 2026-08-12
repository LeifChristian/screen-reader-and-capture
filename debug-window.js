import { app, BrowserWindow } from 'electron';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 600,
    height: 400,
    show: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.loadURL('data:text/html,<h1>Window Test</h1>');
  console.log('Window created, visible:', win.isVisible(), 'bounds:', win.getBounds());
});
