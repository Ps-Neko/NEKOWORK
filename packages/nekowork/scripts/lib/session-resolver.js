import fs from 'node:fs';
import path from 'node:path';

function listSessions(projectRoot) {
  const sessionsRoot = path.join(projectRoot || process.cwd(), '.harness', 'state', 'sessions');
  if (!fs.existsSync(sessionsRoot)) return [];
  return fs.readdirSync(sessionsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      name: entry.name,
      mtimeMs: fs.statSync(path.join(sessionsRoot, entry.name)).mtimeMs,
    }));
}

export function resolveSessionId(projectRoot, sessionId) {
  const value = String(sessionId || '').trim();
  if (!value) return value;

  const sessions = listSessions(projectRoot);

  if (value === 'latest') {
    const sorted = [...sessions].sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));
    return sorted[0]?.name || value;
  }

  const exact = sessions.find(s => s.name === value);
  if (exact) return exact.name;

  const matches = sessions.filter(s => s.name.includes(value));
  if (matches.length === 1) return matches[0].name;
  if (matches.length > 1) {
    const list = matches.map(m => m.name).sort().join(', ');
    throw new Error(`session prefix '${value}' is ambiguous: ${list}`);
  }

  return value;
}
