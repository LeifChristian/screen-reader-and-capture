const { ipcRenderer } = require('electron');

async function startApp() {
  const input = document.getElementById('apiKey');
  const button = document.getElementById('startBtn');
  const error = document.getElementById('errorMessage');
  const key = input.value.trim();

  if (!key) {
    error.textContent = 'Please enter an API key.';
    error.style.display = 'block';
    return;
  }

  button.disabled = true;
  button.textContent = 'Starting...';
  error.style.display = 'none';

  try {
    const result = await ipcRenderer.invoke('save-api-key', key);
    if (!result.success) {
      error.textContent = result.error || 'Failed to start.';
      error.style.display = 'block';
      button.disabled = false;
      button.textContent = 'Start Screen Narrator';
    }
  } catch (err) {
    error.textContent = `Unexpected error: ${err.message}`;
    error.style.display = 'block';
    button.disabled = false;
    button.textContent = 'Start Screen Narrator';
  }
}

document.getElementById('apiKey').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startApp();
});

window.addEventListener('DOMContentLoaded', async () => {
  const config = await ipcRenderer.invoke('get-config');
  if (config.openaiApiKey) {
    document.getElementById('apiKey').value = config.openaiApiKey;
  }
});
