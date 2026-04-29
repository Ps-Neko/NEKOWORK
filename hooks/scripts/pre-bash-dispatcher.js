#!/usr/bin/env node
// PreToolUse(Bash) 디스패처. ECC pre-bash-dispatcher.js 패턴.
// 단일 진입점 → 매처 분기 → 모듈. ENV 토글로 개별 on/off.
//
// Day 3 stub: 입력 cmd 를 검사하고 위험 패턴이 있으면 차단 메시지 출력.
// 실제 Claude Code hook 인터페이스 (stdin JSON) 는 Day 5 에 정식 통합.

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

if (blocks.length) {
  process.stderr.write('[pre-bash-dispatcher] 차단:\n');
  for (const b of blocks) process.stderr.write('  - ' + b + '\n');
  process.exit(2);
}

process.exit(0);
