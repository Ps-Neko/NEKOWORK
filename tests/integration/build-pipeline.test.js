// 통합: install plan → apply → 5개 빌더 산출 → state 영속 → repair 정합 까지의 풀체인.
// 별도 워크스페이스로 카피해서 실행. 본 레포의 .harness/install-state.json 은 안 건드림.

import { strict as assert } from 'node:assert';
import { test, before, after } from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ZERO_SHA = '0'.repeat(64);
let SANDBOX;

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '.harness') continue;
    if (e.name.startsWith('.') && !['.gitignore', '.mcp.json', '.claude-plugin'].includes(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function run(script, args = [], opts = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: SANDBOX,
    env: { ...process.env, FORCE_COLOR: '0' },
    encoding: 'utf8',
    ...opts,
  });
}

function readState() {
  return JSON.parse(fs.readFileSync(path.join(SANDBOX, '.harness', 'install-state.json'), 'utf8'));
}

function writeState(state) {
  fs.writeFileSync(path.join(SANDBOX, '.harness', 'install-state.json'), JSON.stringify(state, null, 2));
}

function assertValidInstallState(state) {
  const schema = JSON.parse(fs.readFileSync(path.join(SANDBOX, 'schemas', 'install-state.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(state), true, JSON.stringify(validate.errors));
}

before(() => {
  SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-it-'));
  copyDir(ROOT, SANDBOX);
  // node_modules 는 심볼릭으로 (Windows 일반 사용자 권한 부족하면 cp 폴백)
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

test('install plan: 매니페스트 검증 + 컴포넌트 표 출력', () => {
  const r = run('scripts/install-plan.js', ['--profile', 'developer']);
  assert.equal(r.status, 0, `plan failed: ${r.stderr}`);
  assert.match(r.stdout, /HARNESS install --plan/);
  assert.match(r.stdout, /developer/);
  assert.match(r.stdout, /modules \(/);
});

test('install plan: selective module/component/target filters', () => {
  const targetRoot = path.join(os.tmpdir(), 'harness-plan-target');
  const r = run('scripts/install-plan.js', [
    '--profile', 'core',
    '--target', 'claude',
    '--project-root', targetRoot,
    '--module', 'codex-loop',
    '--component', 'agent:research',
    '--without-component', 'hook:persistent-mode',
    '--json',
  ]);
  assert.equal(r.status, 0, `selective plan failed: ${r.stderr}`);
  const plan = JSON.parse(r.stdout);
  assert.equal(plan.harness_filter, 'claude');
  assert.equal(plan.target_root, path.resolve(targetRoot));
  assert.ok(plan.modules.includes('codex-loop'));
  assert.ok(plan.selected_components.includes('agent:research'));
  assert.ok(plan.components.every(c => c.harness === 'claude' || c.harness === '(builder)'));
  assert.ok(!plan.components.some(c => c.component === 'platform:codex'));
  assert.ok(!plan.components.some(c => c.component === 'hook:persistent-mode'));
});

test('install plan: --list exposes selectable catalog', () => {
  const r = run('scripts/install-plan.js', ['--list', '--json']);
  assert.equal(r.status, 0, `list failed: ${r.stderr}`);
  const catalog = JSON.parse(r.stdout);
  assert.equal(catalog.default_profile, 'developer');
  assert.ok(catalog.targets.some(t => t.name === 'claude'));
  assert.ok(catalog.packs.some(p => p.name === 'security' && p.profile === 'security'));
  assert.ok(catalog.packs.some(p => p.name === 'productivity' && p.profile === 'productivity'));
  assert.ok(catalog.profiles.some(p => p.name === 'security'));
  assert.ok(catalog.profiles.some(p => p.name === 'productivity'));
  assert.ok(catalog.modules.some(m => m.name === 'codex-loop'));
  assert.ok(catalog.components.some(c => c.name === 'skill:claude-led-codex-review'));
});

test('install plan: official pack aliases resolve to safe profiles', () => {
  const r = run('scripts/install-plan.js', ['--pack', 'productivity', '--json']);
  assert.equal(r.status, 0, `pack plan failed: ${r.stderr}`);
  const plan = JSON.parse(r.stdout);
  assert.equal(plan.pack, 'productivity');
  assert.equal(plan.profile, 'productivity');
  assert.match(plan.pack_workflow, /build/);
  assert.ok(plan.modules.includes('codex-loop'));
  assert.ok(plan.modules.includes('workflow-quality'));
});

test('install plan: unknown target/module/component filters fail fast', () => {
  const cases = [
    [['--target', 'nope'], /unknown target: nope/],
    [['--module', 'nope'], /unknown module: nope/],
    [['--without-module', 'nope'], /unknown module: nope/],
    [['--component', 'nope:thing'], /unknown component: nope:thing/],
    [['--without-component', 'nope:thing'], /unknown component: nope:thing/],
    [['--pack', 'nope'], /unknown pack: nope/],
    [['--profile', 'core', '--pack', 'security'], /--profile and --pack cannot be used together/],
  ];

  for (const [args, pattern] of cases) {
    const r = run('scripts/install-plan.js', args.some(arg => arg === '--profile' || arg === '--pack') ? args : ['--profile', 'core', ...args]);
    assert.equal(r.status, 1, `expected failure for ${args.join(' ')}`);
    assert.match(r.stderr, pattern);
  }
});

test('install apply: dry-run refuses unknown target through plan gate', () => {
  const r = run('scripts/install-apply.js', ['--target', 'nope', '--dry-run']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown target: nope/);
  assert.match(r.stderr, /plan 실패/);
});

test('install apply: --project-root 는 외부 대상에 출력과 state 를 기록한다', () => {
  const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-apply-target-'));

  try {
    const r = run('scripts/install-apply.js', ['--profile', 'core', '--target', 'codex', '--project-root', targetRoot]);
    assert.equal(r.status, 0, `external apply failed: ${r.stderr}\n${r.stdout}`);
    assert.match(r.stdout, /target root/);
    assert.ok(fs.existsSync(path.join(targetRoot, '.codex', 'config.toml')));
    assert.ok(fs.existsSync(path.join(targetRoot, '.harness', 'install-state.json')));
    assert.equal(fs.existsSync(path.join(SANDBOX, '.codex')), false, 'source root must not receive target output');

    const state = JSON.parse(fs.readFileSync(path.join(targetRoot, '.harness', 'install-state.json'), 'utf8'));
    assertValidInstallState(state);
    assert.ok(state.components.codex);
    assert.equal(state.components.claude, undefined);
    assert.equal(state.components.codex.targets[0].path, '.codex');
  } finally {
    fs.rmSync(targetRoot, { recursive: true, force: true });
  }
});

test('install apply: 5개 빌더 모두 실행 + state 기록', () => {
  const r = run('scripts/install-apply.js', ['--profile', 'developer']);
  assert.equal(r.status, 0, `apply failed: ${r.stderr}\n${r.stdout}`);
  assert.match(r.stdout, /apply: claude, codex, cursor, gemini, opencode/);
  assert.match(r.stdout, /apply 완료/);

  const state = readState();
  assertValidInstallState(state);
  assert.equal(state.profile, 'developer');
  for (const h of ['claude', 'codex', 'cursor', 'gemini', 'opencode']) {
    assert.ok(state.components[h], `${h} 컴포넌트 누락`);
    assert.match(state.components[h].source_sha256, /^[a-f0-9]{64}$/, `${h} source_sha256 invalid`);
    assert.notEqual(state.components[h].source_sha256, ZERO_SHA, `${h} source_sha256 placeholder`);
    assert.match(state.components[h].targets[0].sha256, /^[a-f0-9]{64}$/, `${h} target sha256 invalid`);
    assert.notEqual(state.components[h].targets[0].sha256, ZERO_SHA, `${h} target sha256 placeholder`);
  }
});

test('각 하네스 출력 디렉터리 존재 + 핵심 파일 포함', () => {
  for (const h of ['claude', 'codex', 'cursor', 'gemini', 'opencode']) {
    const dir = path.join(SANDBOX, `.${h}`);
    assert.ok(fs.existsSync(dir), `.${h}/ 누락`);
  }
  assert.ok(fs.existsSync(path.join(SANDBOX, '.claude', 'agents')));
  assert.ok(fs.existsSync(path.join(SANDBOX, '.codex', 'config.toml')));
  assert.ok(fs.existsSync(path.join(SANDBOX, '.cursor', '.cursorrules')));
  assert.ok(fs.existsSync(path.join(SANDBOX, '.gemini', 'GEMINI.md')));
  assert.ok(fs.existsSync(path.join(SANDBOX, '.opencode', 'config.json')));
});

test('repair --check: 변경 없으면 정합', () => {
  const r = run('scripts/repair.js', ['--check']);
  assert.equal(r.status, 0, `repair failed: ${r.stderr}\n${r.stdout}`);
  assert.match(r.stdout, /모든 하네스 정합/);
});

test('repair: source_sha256 placeholder 회수 후 state schema 유지', () => {
  const state = readState();
  state.components.gemini.source_sha256 = ZERO_SHA;
  writeState(state);

  const check = run('scripts/repair.js', ['--check', '--harness', 'gemini']);
  assert.equal(check.status, 1);
  assert.match(check.stdout, /gemini.*source_sha256 불일치/);

  const fix = run('scripts/repair.js', ['--harness', 'gemini']);
  assert.equal(fix.status, 0, `repair source fix failed: ${fix.stderr}\n${fix.stdout}`);

  const repaired = readState();
  assertValidInstallState(repaired);
  assert.notEqual(repaired.components.gemini.source_sha256, ZERO_SHA);
  assert.match(repaired.components.gemini.targets[0].sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(repaired.components.gemini.targets[0].sha256, ZERO_SHA);

  const recheck = run('scripts/repair.js', ['--check', '--harness', 'gemini']);
  assert.equal(recheck.status, 0, `repair recheck failed: ${recheck.stderr}\n${recheck.stdout}`);
});

test('repair: .cursor 삭제 후 재빌드 발견', () => {
  fs.rmSync(path.join(SANDBOX, '.cursor'), { recursive: true, force: true });

  const check = run('scripts/repair.js', ['--check']);
  assert.equal(check.status, 1);
  assert.match(check.stdout, /cursor.*\.cursor 없음/);

  const fix = run('scripts/repair.js');
  assert.equal(fix.status, 0, `repair fix failed: ${fix.stderr}\n${fix.stdout}`);
  assert.ok(fs.existsSync(path.join(SANDBOX, '.cursor')));

  const state = readState();
  assertValidInstallState(state);
  assert.notEqual(state.components.cursor.source_sha256, ZERO_SHA);
  assert.notEqual(state.components.cursor.targets[0].sha256, ZERO_SHA);

  const recheck = run('scripts/repair.js', ['--check', '--harness', 'cursor']);
  assert.equal(recheck.status, 0, `cursor recheck failed: ${recheck.stderr}\n${recheck.stdout}`);
});

test('repair: 출력 디렉터리 임의 변경 → sha256 불일치 검출', () => {
  // .codex 안에 임의 파일 추가 → sha256 변동
  fs.writeFileSync(path.join(SANDBOX, '.codex', 'TAMPERED.txt'), 'tamper');

  const check = run('scripts/repair.js', ['--check']);
  assert.equal(check.status, 1);
  assert.match(check.stdout, /codex.*sha256 불일치/);
});

test('sync-claude-md --check: 카탈로그와 마커 영역 정합', () => {
  // apply 직후라 정합. CLAUDE.md 의 카탈로그 요약이 매니페스트와 동일.
  const r = run('scripts/sync-claude-md.js', ['--check']);
  assert.equal(r.status, 0, `sync check failed: ${r.stderr}\n${r.stdout}`);
  assert.match(r.stdout, /동기화 OK/);
});

test('build-codemaps --check: 모든 영역 최신', () => {
  // codemap 은 아직 안 만들었으니 첫 호출 시 변경 발생. 한 번 빌드 후 check.
  const build = run('scripts/build-codemaps.js');
  assert.equal(build.status, 0);
  const check = run('scripts/build-codemaps.js', ['--check']);
  assert.equal(check.status, 0, `codemap check failed: ${check.stderr}\n${check.stdout}`);
});

test('validate:all 4개 모두 통과', () => {
  for (const v of ['validate-agents', 'validate-skills', 'validate-hooks', 'validate-manifests']) {
    const r = run(`scripts/ci/${v}.js`);
    assert.equal(r.status, 0, `${v} failed: ${r.stderr}\n${r.stdout}`);
    assert.match(r.stdout, /통과/);
  }
});

test('check-markers: CLAUDE.md 마커 OK', () => {
  const r = run('scripts/ci/check-markers.js');
  assert.equal(r.status, 0);
});
