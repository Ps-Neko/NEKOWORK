import fs from 'node:fs';
import path from 'node:path';

export function resolveCli(bin, env = process.env, options = {}) {
  const platform = options.platform || process.platform;
  const sep = platform === 'win32' ? ';' : ':';
  const pathDirs = (env.PATH || '').split(sep).filter(Boolean);

  const exts = platform === 'win32'
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

export function resolveProviderCli(provider, options = {}) {
  const bin = options.bin || provider;
  const env = options.env || process.env;
  const root = options.root || process.cwd();
  const resolved = resolveCli(bin, env, options);
  if (!resolved) return null;
  return assertProviderCliTrust(provider, resolved, root, env);
}

export function assertProviderCliTrust(provider, binPath, root = process.cwd(), env = process.env) {
  const providerKey = provider.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const allowWorkspaceBin =
    env.HARNESS_CLI_ALLOW_WORKSPACE_BIN === '1'
    || env[`HARNESS_${providerKey}_ALLOW_WORKSPACE_BIN`] === '1';

  if (!allowWorkspaceBin && isPathInside(root, binPath)) {
    throw new Error([
      `${provider} CLI resolved inside the current workspace: ${binPath}`,
      'Provider CLIs should come from a user/global install so local project files cannot hijack delegated auth.',
      `Move the CLI earlier on PATH outside this repo, or set HARNESS_${providerKey}_ALLOW_WORKSPACE_BIN=1 if this is intentional.`,
    ].join('\n'));
  }

  return binPath;
}

export function isPathInside(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function preferredWindowsExtensions(env) {
  const fromPathExt = (env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((ext) => ext.trim().toLowerCase())
    .filter(Boolean);
  const preferred = ['.exe', '.cmd', '.bat', '.ps1', ''];
  return [...new Set([...preferred, ...fromPathExt])];
}
