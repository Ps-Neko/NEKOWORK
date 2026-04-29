#!/usr/bin/env node
// GitHub OAuth Device Flow.
// 사전 조건: HARNESS_GITHUB_CLIENT_ID 환경변수 (사용자가 자기 OAuth App 등록 후 받은 client_id).
// 자세한 절차는 docs/AUTH-MIGRATION.md §5.3.

import { save, audit } from '../lib/token-vault.js';

const CLIENT_ID = process.env.HARNESS_GITHUB_CLIENT_ID;
const SCOPES = (process.env.HARNESS_GITHUB_SCOPES || 'repo workflow').replace(/,/g, ' ');

if (!CLIENT_ID) {
  process.stderr.write('환경변수 HARNESS_GITHUB_CLIENT_ID 가 필요합니다.\n');
  process.stderr.write('  1) https://github.com/settings/developers → New OAuth App\n');
  process.stderr.write('  2) "Enable Device Flow" 체크\n');
  process.stderr.write('  3) export HARNESS_GITHUB_CLIENT_ID=<your_client_id>\n');
  process.exit(2);
}

async function startDevice() {
  const r = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPES }),
  });
  if (!r.ok) throw new Error(`device/code 실패 ${r.status}: ${await r.text()}`);
  return r.json();
}

async function poll(deviceCode, intervalSec) {
  let interval = intervalSec || 5;
  while (true) {
    await new Promise((res) => setTimeout(res, interval * 1000));
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const data = await r.json();
    if (data.access_token) return data;
    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') { interval += 5; continue; }
    if (data.error === 'expired_token' || data.error === 'access_denied') {
      throw new Error(`인증 실패: ${data.error}`);
    }
    throw new Error(`알 수 없는 응답: ${JSON.stringify(data)}`);
  }
}

(async () => {
  try {
    audit('auth.token_issued.requested', { provider: 'github', scopes: SCOPES });
    const dev = await startDevice();
    process.stdout.write('\n=== GitHub OAuth Device Flow ===\n');
    process.stdout.write(`URL  : ${dev.verification_uri}\n`);
    process.stdout.write(`코드 : ${dev.user_code}\n`);
    process.stdout.write(`만료 : ${Math.floor((dev.expires_in || 900) / 60)}분\n`);
    process.stdout.write('\n브라우저에서 위 URL 을 열고 코드를 입력하세요. 완료될 때까지 폴링합니다...\n\n');

    const tok = await poll(dev.device_code, dev.interval || 5);
    const file = save('github', {
      access_token: tok.access_token,
      token_type: tok.token_type || 'bearer',
      scope: tok.scope,
    });
    audit('auth.token_issued', { provider: 'github', scope: tok.scope, token_type: tok.token_type });

    process.stdout.write(`✓ 저장됨: ${file}\n`);
    process.stdout.write(`  scope: ${tok.scope}\n`);
    process.exit(0);
  } catch (e) {
    audit('auth.token_issued.failed', { provider: 'github', error: String(e.message || e) });
    process.stderr.write(`✗ ${e.message || e}\n`);
    process.exit(1);
  }
})();
