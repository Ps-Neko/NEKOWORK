#!/usr/bin/env node
// claude-led-codex-review 풀사이클 시뮬레이션 (Week 1 데모).
// 실제 LLM 호출은 안 함 — 7단계의 핸드오프 파일 / 상태 / round 카운터가 잘 흐르는지만 검증.
// 사용자 룰("git push 사용자 확인") 우선이라 실 ship 은 안 함.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TASK = process.argv[2] || 'JWT 검증 미들웨어 추가';
const SESSION_ID = process.argv[3] || `demo-${Date.now()}`;
const SECURE = process.argv.includes('--secure');
const NO_SHIP = process.argv.includes('--no-ship');

const SESSION_DIR = path.join(ROOT, '.harness', 'state', 'sessions', SESSION_ID);
fs.mkdirSync(path.join(SESSION_DIR, 'handoffs'), { recursive: true });

console.log(`\n=== claude-led-codex-review demo ===`);
console.log(`session : ${SESSION_ID}`);
console.log(`task    : ${TASK}`);
console.log(`flags   : ${SECURE ? '--secure ' : ''}${NO_SHIP ? '--no-ship' : ''}`);
console.log('');

function callMcp(tool, args) {
  // 단순 시뮬레이션: 직접 디스크에 쓰기.
  if (tool === 'state_write') {
    const file = path.join(SESSION_DIR, args.key === 'prd' ? 'prd.json' : args.key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof args.value === 'string' ? args.value : JSON.stringify(args.value, null, 2));
  } else if (tool === 'handoff_write') {
    const stageOrder = ['ideate', 'plan', 'implement', 'self-review', 'codex-review', 'codex-challenge', 'ship'];
    const nn = String(stageOrder.indexOf(args.stage) + 1).padStart(2, '0');
    const base = handoffBase(nn, args);
    const md = renderHandoff(args);
    fs.writeFileSync(path.join(SESSION_DIR, 'handoffs', `${base}.md`), md);
    fs.writeFileSync(path.join(SESSION_DIR, 'handoffs', `${base}.json`),
      JSON.stringify({ ...args, timestamp: new Date().toISOString() }, null, 2));
  }
}

function handoffBase(nn, args) {
  const round = Number(args.round || 1);
  return `${nn}-${args.stage}${round > 1 ? `-r${round}` : ''}`;
}

function renderHandoff(a) {
  const L = [];
  L.push(`# Handoff: ${a.stage}  (round ${a.round || 1}, agent: ${a.agent})`);
  L.push('');
  L.push(`**Decided**: ${a.decided}`);
  if (a.rejected)  L.push(`**Rejected**: ${a.rejected}`);
  if (a.risks)     L.push(`**Risks**: ${a.risks}`);
  L.push(`**Files**: ${(a.files || []).join(', ')}`);
  if (a.remaining) L.push(`**Remaining**: ${a.remaining}`);
  if (a.verdict)   L.push(`**Verdict**: ${a.verdict}`);
  if (a.issues?.length) {
    L.push(''); L.push('## Issues');
    for (const i of a.issues) L.push(`- [${i.severity}/${i.category}] ${i.file || ''} — ${i.summary}`);
  }
  return L.join('\n') + '\n';
}

function step(n, name, fn) {
  console.log(`[${n}] ${name} …`);
  fn();
  console.log(`    ✓ handoff ${path.relative(ROOT, path.join(SESSION_DIR, 'handoffs')).replace(/\\/g, '/')}/...`);
}

// ---- 1. ideate ----
step(1, 'ideate (research, planner)', () => {
  callMcp('handoff_write', {
    stage: 'ideate', agent: 'planner', round: 1,
    decided: `${TASK} 의 후보 접근 3개 비교 후 표준 lib jose 채택`,
    rejected: 'jsonwebtoken (CVE 이력), 자체 구현 (유지보수 부담)',
    risks: '키 회전 정책 미정',
    files: ['src/auth/jwt.ts (예정)'],
    remaining: 'planner 에 PRD 시드',
  });
});

// ---- 2. plan ----
step(2, 'plan (planner)', () => {
  callMcp('state_write', { key: 'prd', value: {
    task: TASK,
    acceptance: [
      { id: 'AC-001', desc: 'verifyJwt 가 유효한 토큰을 통과시킨다', passes: false },
      { id: 'AC-002', desc: 'verifyJwt 가 만료 토큰을 거절한다', passes: false },
      { id: 'AC-003', desc: 'verifyJwt 가 잘못된 서명을 거절한다', passes: false },
    ],
    non_goals: ['키 회전', '리프레시 토큰'],
  }});
  callMcp('handoff_write', {
    stage: 'plan', agent: 'planner', round: 1,
    decided: 'AC 3개로 분해. jose 라이브러리. 단계 4 에서 security-reviewer 추가 강제 (auth 영역)',
    files: ['prd.json'], remaining: 'executor 에 핸드오프',
  });
});

// ---- 3. implement ----
step(3, 'implement (executor + test-engineer, TDD)', () => {
  callMcp('handoff_write', {
    stage: 'implement', agent: 'executor', round: 1,
    decided: 'TDD 3 사이클. AC-001/002/003 모두 GREEN. quality-gate 통과.',
    files: ['src/auth/jwt.ts', 'tests/unit/jwt.test.ts'],
    remaining: 'self-review',
  });
});

// ---- 4. self-review ----
let round = 1;
let block = false;
step(4, `self-review (code-reviewer, opus, ro) round ${round}`, () => {
  const issues = [
    { severity: 'high', category: 'security', file: 'src/auth/jwt.ts', line: 23,
      summary: 'iat / nbf 검증 누락', why: '토큰의 발급 시각 검증 없음. 미래 토큰 허용 가능' },
    { severity: 'medium', category: 'test', file: 'tests/unit/jwt.test.ts',
      summary: 'audience claim 케이스 부족', why: 'aud 미스매치 테스트 없음' },
  ];
  callMcp('handoff_write', {
    stage: 'self-review', agent: 'code-reviewer', round,
    decided: 'high 1, medium 1 발견. fix loop 진입.',
    files: ['src/auth/jwt.ts'], remaining: '단계 3a fix-loop',
    issues, verdict: 'approve_with_fixes', confidence: 0.85,
  });
  block = issues.some(i => i.severity === 'critical');
});

// ---- 3a. fix loop (high 발견 → executor 재호출) ----
console.log('[3a] fix-loop: executor 재호출 (high 수정) …');
round = 2;
callMcp('handoff_write', {
  stage: 'implement', agent: 'executor', round,
  decided: 'iat/nbf 검증 추가. audience claim 테스트 추가.',
  files: ['src/auth/jwt.ts', 'tests/unit/jwt.test.ts'],
  remaining: 'self-review 재실행',
});
console.log(`    ✓ round ${round} 진입`);

step(4, `self-review round ${round}`, () => {
  callMcp('handoff_write', {
    stage: 'self-review', agent: 'code-reviewer', round,
    decided: '이전 high 해결. 신규 발견 0건.',
    files: ['src/auth/jwt.ts'], remaining: 'codex-review',
    verdict: 'approve', confidence: 0.92,
  });
});

// ---- 5. codex-review ----
round = 1;
step(5, 'codex-review (Codex CLI 별도 세션)', () => {
  callMcp('handoff_write', {
    stage: 'codex-review', agent: 'codex-reviewer', round,
    decided: 'Claude self-review 와 일치. 추가 발견 medium 1 (네트워크 timeout 미설정).',
    rejected: '없음',
    files: ['src/auth/jwt.ts'],
    remaining: '--secure 가 활성이면 단계 6, 아니면 단계 7',
    issues: [{ severity: 'medium', category: 'correctness', file: 'src/auth/jwt.ts',
      summary: 'JWKS fetch timeout 미설정', why: 'fetch 가 무한 대기 가능' }],
    verdict: 'approve_with_fixes', confidence: 0.88,
  });
});

// ---- 6. codex-challenge (--secure 자동 활성: auth/ 디렉터리 변경) ----
const isAuthChange = true;
const wantChallenge = SECURE || isAuthChange;
if (wantChallenge) {
  step(6, 'codex-challenge (auth 영역 자동 활성)', () => {
    callMcp('handoff_write', {
      stage: 'codex-challenge', agent: 'codex-challenger', round: 1,
      decided: '적대적 시나리오 5건 검토. 신규 critical 0, high 0, info 1 (replay 방어 권장).',
      files: ['src/auth/jwt.ts'],
      remaining: 'ship',
      issues: [{ severity: 'info', category: 'security', summary: 'jti / replay cache 권장 (현 PRD 비목표)' }],
      verdict: 'approve', confidence: 0.95,
    });
  });
} else {
  console.log('[6] codex-challenge skipped (--secure 미활성, auth 영역 아님)');
}

// ---- 7. ship ----
if (NO_SHIP) {
  console.log('[7] ship skipped (--no-ship)');
} else {
  step(7, 'ship (doc-writer + git-master)', () => {
    callMcp('handoff_write', {
      stage: 'ship', agent: 'doc-writer', round: 1,
      decided: 'CHANGELOG 갱신. PR 본문 한국어 초안. 자동 push 안 함 (사용자 룰).',
      files: ['docs/CHANGELOG.md', 'WORKING-CONTEXT.md'],
      remaining: '사용자 검토 후 gh pr create 또는 git push 수동 실행',
    });
  });
}

console.log('\n=== 결과 ===');
const handoffs = fs.readdirSync(path.join(SESSION_DIR, 'handoffs')).filter(f => f.endsWith('.md')).sort();
for (const f of handoffs) console.log('  - handoffs/' + f);
console.log('\n=== prd.json ===');
console.log(fs.readFileSync(path.join(SESSION_DIR, 'prd.json'), 'utf8'));
console.log('=== 데모 종료 ===\n');
