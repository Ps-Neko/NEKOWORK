#!/usr/bin/env node
// GitHub OAuth 상태 점검. vault 에 토큰이 있고 GitHub API 가 응답하는지 확인.

import { load, redact, backend } from '../lib/token-vault.js';

async function verify(tok) {
  try {
    const r = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `${tok.token_type || 'token'} ${tok.access_token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'harness-cli',
      },
    });
    if (!r.ok) return { ok: false, status: r.status };
    const u = await r.json();
    return { ok: true, login: u.login };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

(async () => {
  const tok = await load('github');
  if (!tok) {
    process.stdout.write('GitHub: 미인증 (`npm run auth:github:login` 필요).\n');
    process.exit(1);
  }

  process.stdout.write('GitHub 인증 상태:\n');
  process.stdout.write(`  backend  : ${await backend()}\n`);
  process.stdout.write(`  scope    : ${tok.scope}\n`);
  process.stdout.write(`  saved_at : ${tok.saved_at}\n`);
  process.stdout.write(`  token    : ${redact(tok.access_token)}\n`);

  const v = await verify(tok);
  if (v.ok) {
    process.stdout.write(`  user     : ${v.login}\n`);
    process.stdout.write(`  유효      : ✓\n`);
    process.exit(0);
  } else {
    process.stdout.write(`  유효      : ✗ (${v.status || v.error})\n`);
    process.exit(2);
  }
})();
