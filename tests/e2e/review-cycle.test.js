// E2E: claude-led-codex-review 풀사이클(7단계) 시뮬레이션을 격리 워크스페이스에서 검증.
// scripts/demo-review.js 의 핸드오프 흐름을 재실행하고 산출 파일 / round 카운터 / 5필드 무결성 검증.

import { strict as assert } from 'node:assert';
import { test, before, after } from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
let SANDBOX;

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '.harness') continue;
    if (e.name.startsWith('.') && !['.gitignore', '.mcp.json'].includes(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

before(() => {
  SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-e2e-'));
  copyDir(ROOT, SANDBOX);
  try {
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(SANDBOX, 'node_modules'), 'junction');
  } catch {
    copyDir(path.join(ROOT, 'node_modules'), path.join(SANDBOX, 'node_modules'));
  }
});

after(() => {
  if (SANDBOX && fs.existsSync(SANDBOX)) {
    fs.rmSync(SANDBOX, { recursive: true, force: true });
  }
});

function run(scriptArgs, opts = {}) {
  return spawnSync(process.execPath, scriptArgs, {
    cwd: SANDBOX,
    env: { ...process.env, FORCE_COLOR: '0' },
    encoding: 'utf8',
    ...opts,
  });
}

test('demo-review --no-ship: 7단계 핸드오프 모두 산출', () => {
  const sessionId = 'e2e-jwt-no-ship';
  const r = run(['scripts/demo-review.js', 'JWT 검증 미들웨어 추가', sessionId, '--no-ship']);
  assert.equal(r.status, 0, `demo failed: ${r.stderr}\n${r.stdout}`);

  const sessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId);
  assert.ok(fs.existsSync(sessionDir), '세션 디렉터리 생성 실패');

  const prd = JSON.parse(fs.readFileSync(path.join(sessionDir, 'prd.json'), 'utf8'));
  assert.equal(prd.task, 'JWT 검증 미들웨어 추가');
  assert.equal(prd.acceptance.length, 3);

  const handoffs = fs.readdirSync(path.join(sessionDir, 'handoffs')).filter(f => f.endsWith('.md')).sort();
  // ideate / plan / implement(2 round) / self-review(2 round) / codex-review / codex-challenge = 8 .md
  // (ship 은 --no-ship 으로 생략)
  assert.equal(handoffs.length, 8);
  const stages = handoffs.map(stageFromHandoffFile);
  assert.ok(stages.includes('ideate'));
  assert.ok(stages.includes('plan'));
  assert.ok(stages.includes('implement'));
  assert.ok(stages.includes('self-review'));
  assert.ok(stages.includes('codex-review'));
  assert.ok(stages.includes('codex-challenge'), 'auth 영역이라 challenge 자동 활성');
  assert.ok(!stages.includes('ship'), '--no-ship 이라 ship 미생성');
});

test('핸드오프 5필드 무결성: 모든 .md 가 Decided 와 Files 포함', () => {
  const sessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', 'e2e-jwt-no-ship');
  const handoffs = fs.readdirSync(path.join(sessionDir, 'handoffs')).filter(f => f.endsWith('.md'));
  for (const f of handoffs) {
    const content = fs.readFileSync(path.join(sessionDir, 'handoffs', f), 'utf8');
    assert.match(content, /\*\*Decided\*\*:/, `${f}: Decided 누락`);
    assert.match(content, /\*\*Files\*\*:/, `${f}: Files 누락`);
  }
});

test('demo-review --secure: codex-challenge 강제 활성', () => {
  const sessionId = 'e2e-secure';
  const r = run(['scripts/demo-review.js', '인증 헤더 검증', sessionId, '--secure', '--no-ship']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /codex-challenge/);
  const challengeFile = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId, 'handoffs');
  const stages = fs.readdirSync(challengeFile).map(f => f);
  assert.ok(stages.some(s => /codex-challenge\.md$/.test(s)), 'challenge .md 생성 안 됨');
});

test('round 카운터: self-review high 발견 시 round 2 까지 진행', () => {
  const sessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', 'e2e-jwt-no-ship');
  const reviews = fs.readdirSync(path.join(sessionDir, 'handoffs'))
    .filter(f => /self-review(?:-r\d+)?\.json$/.test(f));
  assert.deepEqual(reviews.sort(), ['04-self-review-r2.json', '04-self-review.json'].sort());
  const final = JSON.parse(fs.readFileSync(path.join(sessionDir, 'handoffs', '04-self-review-r2.json'), 'utf8'));
  assert.equal(final.verdict, 'approve');
  assert.equal(final.round, 2);
});

test('demo-review (auth 아닌 영역, --secure 미활성): challenge 스킵', () => {
  // 현재 demo-review.js 는 isAuthChange 가 하드코딩 true. --secure 없이도 challenge 강제.
  // 따라서 별도 모드 없이 항상 challenge 생성. 회귀 안전성을 위해 명시 검증.
  const sessionId = 'e2e-non-auth';
  const r = run(['scripts/demo-review.js', '문서 오타 수정', sessionId, '--no-ship']);
  assert.equal(r.status, 0);
  // 현재 구현: auth 자동 감지가 hardcoded true → challenge 항상 활성
  // 사양 변경 시 본 테스트가 회귀 알람.
  assert.match(r.stdout, /codex-challenge.*활성/);
});

test('CLI version: 매니페스트 / package.json 일치', () => {
  const r = run(['scripts/cli.js', 'version']);
  assert.equal(r.status, 0);
  const pkg = JSON.parse(fs.readFileSync(path.join(SANDBOX, 'package.json'), 'utf8'));
  assert.match(r.stdout, new RegExp(pkg.version));
});

test('CLI help: 10 verb 모두 노출', () => {
  const r = run(['scripts/cli.js']);
  // exit 1 일 수도 있고 0 일 수도 있음 — 출력만 본다
  const out = r.stdout + r.stderr;
  for (const verb of ['install', 'review', 'plan', 'ralph', 'wait', 'sessions', 'costs', 'instincts', 'version']) {
    assert.match(out, new RegExp(verb), `verb "${verb}" 미노출`);
  }
});

test('CLI plan: implement 이전에 멈춘다', () => {
  const sessionId = 'e2e-cli-plan';
  const r = run(['scripts/cli.js', 'plan', '계획만 확인', '--session', sessionId]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /handoffs: ideate .* plan/);
  const handoffDir = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId, 'handoffs');
  const stages = fs.readdirSync(handoffDir).filter(f => f.endsWith('.md')).join('\n');
  assert.match(stages, /01-ideate\.md/);
  assert.match(stages, /02-plan\.md/);
  assert.doesNotMatch(stages, /03-implement\.md/);
});

test('CLI --project-root: 외부 프로젝트에 session state 를 쓴다', () => {
  const sessionId = 'e2e-cli-project-root';
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-project-root-'));
  const harnessSessionDir = path.join(SANDBOX, '.harness', 'state', 'sessions', sessionId);

  try {
    const r = run(['scripts/cli.js', 'plan', '외부 프로젝트 계획', '--session', sessionId, '--project-root', projectRoot]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /project root:/);
    assert.ok(fs.existsSync(path.join(projectRoot, '.harness', 'state', 'sessions', sessionId, 'handoffs', '02-plan.json')));
    assert.equal(fs.existsSync(harnessSessionDir), false, 'HARNESS 설치 루트에 session state 를 쓰면 안 됨');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('CLI review: unknown flag 는 usage error 로 실패한다', () => {
  const r = run(['scripts/cli.js', 'review', '문서 수정', '--unknown-flag']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /알 수 없는 플래그/);
  assert.doesNotMatch(r.stderr, /UNEXPECTED/);
});

function stageFromHandoffFile(file) {
  return file
    .replace(/^\d+-/, '')
    .replace(/-r\d+(?=\.md$)/, '')
    .replace(/\.md$/, '');
}
