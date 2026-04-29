#!/usr/bin/env node
// PreToolUse(Edit|Write) config-protection.
// .env / *.pem / *.key / credentials 등 시크릿 파일 직접 편집 차단.

import fs from 'node:fs';

if (process.env.HARNESS_HOOK_GATEGUARD === '0') process.exit(0);

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch { /* TTY */ }
let payload;
try { payload = JSON.parse(input); } catch { payload = {}; }

const targetPath = String(payload?.tool_input?.file_path ?? payload?.tool_input?.path ?? '');
if (!targetPath) process.exit(0);

const PROTECTED = [
  /(^|[\\\/])\.env(\..+)?$/,
  /\.(pem|key|crt|p12|pfx)$/i,
  /(^|[\\\/])credentials([._-]|$)/i,
  /id_rsa(\.pub)?$/,
  /\.aws[\\\/]credentials/i,
  /\.kube[\\\/]config/i,
];

for (const re of PROTECTED) {
  if (re.test(targetPath)) {
    process.stderr.write(`[config-protection] 차단: ${targetPath}\n`);
    process.stderr.write('  사용자 룰 위반: 시크릿 / 인증 파일 직접 편집 금지.\n');
    process.exit(2);
  }
}

process.exit(0);
