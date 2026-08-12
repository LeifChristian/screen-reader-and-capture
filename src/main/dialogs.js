import { dialog } from 'electron';

export async function showExportOptionsDialog(window) {
  const result = await dialog.showMessageBox(window, {
    type: 'question',
    buttons: ['Cancel', 'Text Only', 'Text + Screenshots'],
    defaultId: 1,
    title: 'Export Session',
    message: 'How would you like to export your session?',
    detail: 'Text Only: Export just the descriptions\nText + Screenshots: Export descriptions and all screenshots in a ZIP file'
  });

  if (result.response === 0) return null;
  return { includeScreenshots: result.response === 2 };
}

export async function showSaveExportDialog(window, includeScreenshots) {
  const fileType = includeScreenshots ? 'zip' : 'txt';
  const defaultName = `screen_narrator_session_${new Date().toISOString().split('T')[0]}`;

  const result = await dialog.showSaveDialog(window, {
    title: 'Save Session Export',
    defaultPath: `${defaultName}.${fileType}`,
    filters: includeScreenshots
      ? [{ name: 'ZIP Files', extensions: ['zip'] }]
      : [{ name: 'Text Files', extensions: ['txt'] }]
  });

  return result.canceled ? null : result.filePath;
}

export async function showQuitConfirmationDialog(window, captureCount) {
  const result = await dialog.showMessageBox(window, {
    type: 'question',
    buttons: ['Cancel', 'Quit Without Saving', 'Export & Quit'],
    defaultId: 2,
    title: `Quit ${window.title}`,
    message: `You have ${captureCount} captures in this session.`,
    detail: 'Would you like to export your session before quitting?'
  });

  return result.response;
}

export function showExportCompleteDialog(window, filePath) {
  return dialog.showMessageBox(window, {
    type: 'info',
    title: 'Export Complete',
    message: 'Session exported successfully!',
    detail: `Saved to: ${filePath}`
  });
}

export function showExportErrorDialog(window, message) {
  return dialog.showErrorBox('Export Failed', `Failed to export session: ${message}`);
}
