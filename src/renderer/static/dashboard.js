const { ipcRenderer } = require('electron');

let sessionData = null;

async function initDashboard() {
  try {
    sessionData = await ipcRenderer.invoke('get-session-data');
    updateSessionInfo();
    updateCapturesDisplay();
  } catch (error) {
    console.error('Failed to load session data:', error);
  }
}

function updateSessionInfo() {
  if (!sessionData) return;
  document.getElementById('sessionId').textContent = sessionData.sessionId?.substring(0, 8) ?? '-';
  document.getElementById('captureCount').textContent = sessionData.captureCount ?? 0;
  document.getElementById('sessionStart').textContent = new Date().toLocaleTimeString();
}

function updateCapturesDisplay() {
  const container = document.getElementById('capturesContainer');
  const history = sessionData?.conversationHistory ?? [];

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>🔄 Waiting for first capture...</h3>
        <p>The narrator will capture and describe your screen every 60 seconds</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  [...history].reverse().forEach((capture, index) => {
    container.appendChild(createCaptureElement(capture, index === 0));
  });
}

function createCaptureElement(capture, isLatest) {
  const div = document.createElement('div');
  div.className = `capture-entry ${isLatest ? 'latest' : ''}`;

  const imageUrl = `file://${capture.path}`;
  const timestamp = new Date(capture.timestamp).toLocaleString();

  div.innerHTML = `
    <div class="capture-image">
      <img src="${imageUrl}" alt="Capture ${capture.captureNumber}" />
    </div>
    <div class="capture-content">
      <div class="capture-header">
        <div class="capture-title">Capture ${capture.captureNumber}</div>
        <div class="capture-time">${timestamp}</div>
      </div>
      <div class="capture-description">${escapeHtml(capture.description)}</div>
    </div>
  `;

  return div;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showSpeakingIndicator() {
  const indicator = document.getElementById('speakingIndicator');
  indicator.classList.add('active');
  setTimeout(() => indicator.classList.remove('active'), 5000);
}

async function exportText() {
  try {
    const result = await ipcRenderer.invoke('export-session', false);
    alert(`Text exported to: ${result}`);
  } catch (error) {
    alert(`Export failed: ${error.message}`);
  }
}

async function exportFull() {
  try {
    const result = await ipcRenderer.invoke('export-session', true);
    alert(`Full session exported to: ${result}`);
  } catch (error) {
    alert(`Export failed: ${error.message}`);
  }
}

function clearSession() {
  if (!confirm('Are you sure you want to clear the current session? This cannot be undone.')) return;
  sessionData = { conversationHistory: [], captureCount: 0 };
  updateCapturesDisplay();
  updateSessionInfo();
}

ipcRenderer.on('new-capture', (_event, capture) => {
  if (!sessionData) sessionData = { conversationHistory: [] };
  sessionData.conversationHistory.push(capture);
  sessionData.captureCount = capture.captureNumber;
  updateSessionInfo();
  updateCapturesDisplay();
  showSpeakingIndicator();
});

document.addEventListener('DOMContentLoaded', initDashboard);
