export function formatTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9\-_]/gi, '_');
}

export function parseInteger(value) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
