#!/usr/bin/env node
// Import the already-authenticated GitHub CLI OAuth token into the HARNESS vault.
// This is an explicit local-session bridge, not a static API-key path.

import { spawnSync } from 'node:child_process';
import { save, audit, redact } from '../lib/token-vault.js';

function runGh(args) {
  const r = spawnSync('gh', args, {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0) {
    throw new Error(`gh ${args.join(' ')} failed\n${r.stderr || r.stdout}`);
  }
  return r.stdout.trim();
}

function parseScopes(statusText) {
  const line = statusText.split(/\r?\n/).find((l) => /Token scopes:/i.test(l));
  if (!line) return 'unknown';
  return line
    .replace(/^.*Token scopes:\s*/i, '')
    .split(',')
    .map((s) => s.replace(/['"]/g, '').trim())
    .filter(Boolean)
    .join(' ');
}

(async () => {
  try {
    audit('auth.github.import_gh.requested', { provider: 'github' });
    const status = runGh(['auth', 'status']);
    const token = runGh(['auth', 'token']);
    const scope = parseScopes(status);
    const location = await save('github', {
      access_token: token,
      token_type: 'token',
      scope,
      source: 'gh-cli',
    });
    audit('auth.github.import_gh', { provider: 'github', scope, source: 'gh-cli' });
    process.stdout.write('GitHub gh session imported into HARNESS vault.\n');
    process.stdout.write(`  backend/path : ${location}\n`);
    process.stdout.write(`  scope        : ${scope}\n`);
    process.stdout.write(`  token        : ${redact(token)}\n`);
  } catch (e) {
    audit('auth.github.import_gh.failed', { provider: 'github', error: String(e.message || e) });
    process.stderr.write(`${e.message || e}\n`);
    process.exit(1);
  }
})();
