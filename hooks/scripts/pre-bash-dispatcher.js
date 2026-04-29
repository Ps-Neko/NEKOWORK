#!/usr/bin/env node
// PreToolUse(Bash) 디스패처. ECC pre-bash-dispatcher.js 패턴.
// 단일 진입점 → 매처 분기 → 모듈. ENV 토글로 개별 on/off.
// stdin JSON 으로 Claude Code hook 입력을 받고, 위험 패턴 발견 시 차단 메시지 출력.

import fs from 'node:fs';

if (process.env.HARNESS_HOOK_PRE_BASH === '0') process.exit(0);

let input = '';
try {
  input = fs.readFileSync(0, 'utf8');
} catch { /* TTY 호출도 허용 */ }

let payload;
try { payload = JSON.parse(input); } catch { payload = { tool_input: { command: '' } }; }

const cmd = String(payload?.tool_input?.command ?? '');

const RULES = [
  { re: /\bgit\s+push\s+(-f|--force)/i,         msg: '금지: git push --force. 사용자 확인 필요.' },
  { re: /\bgit\s+reset\s+--hard\b/i,            msg: '금지: git reset --hard 자동 실행. 사용자 확인 필요.' },
  { re: /\brm\s+-rf\b/,                         msg: '금지: rm -rf 자동 실행.' },
  { re: /--no-verify\b/,                        msg: '금지: --no-verify (hook 우회).' },
  { re: /\bicacls\b.*Everyone:F/i,              msg: '금지: 전체 권한 부여.' },
  { re: /\b(curl|wget)\b.*\|\s*(bash|sh)\b/,    msg: '금지: curl|bash 패턴 (공급망 위험).' },
  { re: /\b(npm|pip)\s+(install|publish)\b/i,   msg: '확인 필요: 패키지 설치/배포 (사용자 룰).' },
  { re: /\bshutdown\b|\breboot\b|\bformat\b/i,  msg: '금지: 시스템 명령.' },
];

const blocks = [];
for (const r of RULES) if (r.re.test(cmd)) blocks.push(r.msg);

// auth.policy.block_subscription_override 가드.
// agent.yaml: providers.<name>.disallow_env_keys 와 동기. 자세한 배경은 docs/AUTH-MIGRATION.md.
// LLM CLI 호출 직전 환경 변수에 long-lived API key 가 있으면 구독 OAuth 가 무시되어
// 종량제 과금으로 빠지는 사고를 막는다. HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1 로 명시 옵트아웃.
const SUBSCRIPTION_GUARDS = [
  { cli: /\bclaude\b/,             keys: ['ANTHROPIC_API_KEY'],                provider: 'Claude (Anthropic)' },
  { cli: /\bcodex\b/,               keys: ['OPENAI_API_KEY'],                   provider: 'Codex (OpenAI)' },
  { cli: /\bgemini\b|\bgcloud\b/,   keys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], provider: 'Gemini (Google)' },
];

if (process.env.HARNESS_AUTH_ALLOW_ENV_OVERRIDE !== '1') {
  for (const g of SUBSCRIPTION_GUARDS) {
    if (!g.cli.test(cmd)) continue;
    const set = g.keys.filter((k) => process.env[k]);
    if (!set.length) continue;
    blocks.push(
      `구독 보호: ${g.provider} CLI 호출 직전 ${set.join(', ')} 가 환경에 설정되어 있습니다. ` +
      `구독 OAuth 세션이 무시되어 종량제 과금으로 빠질 수 있습니다. ` +
      `\`unset ${set.join(' ')}\` 또는 HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1 로 명시 옵트아웃.`
    );
  }
}

if (blocks.length) {
  process.stderr.write('[pre-bash-dispatcher] 차단:\n');
  for (const b of blocks) process.stderr.write('  - ' + b + '\n');
  process.exit(2);
}

process.exit(0);
