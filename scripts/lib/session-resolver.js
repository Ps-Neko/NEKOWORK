import fs from 'node:fs';
import path from 'node:path';

export function resolveSessionId(projectRoot, sessionId) {
  const value = String(sessionId || '').trim();
  if (value !== 'latest') return value;

  const sessionsRoot = path.join(projectRoot || process.cwd(), '.harness', 'state', 'sessions');
  if (!fs.existsSync(sessionsRoot)) return value;

  const sessions = fs.readdirSync(sessionsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const full = path.join(sessionsRoot, entry.name);
      return {
        name: entry.name,
        mtimeMs: fs.statSync(full).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));

  return sessions[0]?.name || value;
}
