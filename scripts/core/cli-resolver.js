import fs from 'node:fs';
import path from 'node:path';

export function resolveCli(bin, env = process.env) {
  const sep = process.platform === 'win32' ? ';' : ':';
  const pathDirs = (env.PATH || '').split(sep).filter(Boolean);

  const exts = process.platform === 'win32'
    ? preferredWindowsExtensions(env)
    : [''];

  for (const dir of pathDirs) {
    for (const ext of exts) {
      const full = path.join(dir, bin + ext);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

function preferredWindowsExtensions(env) {
  const fromPathExt = (env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((ext) => ext.trim().toLowerCase())
    .filter(Boolean);
  const preferred = ['.exe', '.cmd', '.bat', '.ps1', ''];
  return [...new Set([...preferred, ...fromPathExt])];
}
