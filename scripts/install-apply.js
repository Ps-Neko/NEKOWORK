#!/usr/bin/env node
// HARNESS install --apply : plan 단계 검증 → harness 별 빌드 (claude / codex) → install-state 기록 → 마커 검증.
// 멱등(idempotent). 실패 시 롤백은 git checkout 으로.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { profile: null, harness: null, force: false, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--profile') args.profile = argv[++i];
    else if (a === '--harness') args.harness = argv[++i];
    else if (a === '--force') args.force = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error(`알 수 없는 인자: ${a}`); process.exit(2); }
  }
  return args;
}

function printHelp() {
  console.log(`
HARNESS install --apply

사용법:
  install.sh --apply [--profile <name>] [--harness <name>] [--force] [--dry-run]

옵션:
  --profile <name>   프로파일 선택 (기본: agent.yaml profiles.default)
  --harness <name>   특정 하네스만 빌드 (claude | codex)
  --force            기존 .claude/ .codex/ 무시하고 재생성
  --dry-run          plan 만 다시 출력하고 종료
`);
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function runBuilder(name) {
  const script = path.join(__dirname, `build-${name}.js`);
  if (!fs.existsSync(script)) {
    console.error(`  [SKIP] build-${name}.js 없음`);
    return false;
  }
  const r = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  return r.status === 0;
}

function recordState(profile, builders) {
  const state = {
    $schema: 'schemas/install-state.schema.json',
    version: '0.0.1',
    harness_version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
    profile,
    installed_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    components: {},
  };

  // 빌드된 디렉터리의 핵심 파일들을 sha256 으로 기록
  for (const b of builders) {
    const outDir = path.join(ROOT, `.${b}`);
    if (!fs.existsSync(outDir)) continue;
    state.components[b] = {
      installed_at: new Date().toISOString(),
      source_sha256: '0'.repeat(64), // 다중 소스이므로 placeholder
      targets: [{ harness: b, path: outDir.replace(ROOT + path.sep, '') }],
    };
  }

  const stateFile = path.join(ROOT, '.harness', 'install-state.json');
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(`  state: ${stateFile.replace(ROOT + path.sep, '')}`);
}

async function main() {
  const args = parseArgs(process.argv);

  // 1. plan 먼저 (검증 + 결과 표시)
  console.log('=> plan 단계');
  const planResult = spawnSync(
    process.execPath,
    [path.join(__dirname, 'install-plan.js'), ...(args.profile ? ['--profile', args.profile] : []), ...(args.harness ? ['--harness', args.harness] : [])],
    { stdio: 'inherit' },
  );
  if (planResult.status !== 0) {
    console.error('plan 실패. apply 중단.');
    process.exit(1);
  }

  if (args.dryRun) {
    console.log('--dry-run: apply 안 함.');
    return;
  }

  // 2. .mcp.json 검증 (있으면 OK, 없으면 경고)
  if (!fs.existsSync(path.join(ROOT, '.mcp.json'))) {
    console.warn('WARN: .mcp.json 없음. bridge/mcp-server.js 등록 필요.');
  }

  // 3. 빌더 실행
  const builders = args.harness ? [args.harness] : ['claude', 'codex'];
  console.log('');
  console.log(`=> apply: ${builders.join(', ')}`);
  for (const b of builders) {
    console.log('');
    if (!runBuilder(b)) {
      console.error(`build-${b} 실패`);
      process.exit(1);
    }
  }

  // 4. state 기록
  console.log('');
  console.log('=> state 기록');
  recordState(args.profile || 'developer', builders);

  // 5. 마커 검증
  console.log('');
  console.log('=> 마커 검증');
  const markerCheck = spawnSync(process.execPath, [path.join(__dirname, 'ci', 'check-markers.js')], { stdio: 'inherit' });
  if (markerCheck.status !== 0) {
    console.warn('WARN: 마커 검증 실패. CLAUDE.md 영역 확인 필요.');
  }

  console.log('');
  console.log('apply 완료.');
}

main().catch((e) => {
  console.error('UNEXPECTED:', e?.stack || e);
  process.exit(1);
});
