#!/usr/bin/env node
// HARNESS install --apply : plan 단계 검증 → harness 별 빌드 (agent.yaml harnesses 전부) → install-state 기록 → 마커 검증.
// 멱등(idempotent). 실패 시 롤백은 git checkout 으로.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    profile: null,
    harness: null,
    force: false,
    dryRun: false,
    modules: [],
    withoutModules: [],
    components: [],
    withoutComponents: [],
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--profile') args.profile = takeValue(argv, i++, a);
    else if (a === '--harness' || a === '--target') args.harness = takeValue(argv, i++, a);
    else if (a === '--module' || a === '--with-module') args.modules.push(takeValue(argv, i++, a));
    else if (a === '--without-module') args.withoutModules.push(takeValue(argv, i++, a));
    else if (a === '--component' || a === '--with-component') args.components.push(takeValue(argv, i++, a));
    else if (a === '--without-component') args.withoutComponents.push(takeValue(argv, i++, a));
    else if (a === '--force') args.force = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error(`알 수 없는 인자: ${a}`); process.exit(2); }
  }
  return args;
}

function takeValue(argv, i, flag) {
  const value = argv[i + 1];
  if (!value || value.startsWith('--')) {
    console.error(`${flag} value required`);
    process.exit(2);
  }
  return value;
}

function printHelp() {
  console.log(`
HARNESS install --apply

사용법:
  install.sh --apply [--profile <name>] [--harness <name>] [--module <id>] [--component <id>] [--force] [--dry-run]

옵션:
  --profile <name>          프로파일 선택 (기본: agent.yaml profiles.default)
  --harness <name>          특정 하네스만 빌드 (claude | codex | cursor | gemini | opencode)
  --target <name>           --harness alias
  --module <id>             include an additional module, repeatable
  --without-module <id>     exclude a module, repeatable
  --component <id>          include a direct component, repeatable
  --without-component <id>  exclude a component, repeatable
  --force                   기존 출력 무시하고 재생성
  --dry-run                 plan 만 다시 출력하고 종료
`);
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256OfDir(dir) {
  if (!fs.existsSync(dir)) return null;
  const entries = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const rel = path.relative(dir, p).replace(/\\/g, '/');
        const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        entries.push(`${rel} ${h}`);
      }
    }
  }
  walk(dir);
  if (entries.length === 0) return null;
  return crypto.createHash('sha256').update(entries.join('\n')).digest('hex');
}

function sha256OfCatalog() {
  // 빌더 입력의 정전(canon): agent.yaml + agents/ + skills/ + commands/ + hooks/ + manifests/
  const parts = [];
  const inputs = ['agent.yaml', 'agents', 'skills', 'commands', 'hooks', 'manifests'];
  for (const inp of inputs) {
    const p = path.join(ROOT, inp);
    if (!fs.existsSync(p)) continue;
    const stat = fs.statSync(p);
    if (stat.isFile()) parts.push(`${inp}\t${sha256(p)}`);
    else parts.push(`${inp}/\t${sha256OfDir(p) || ''}`);
  }
  return crypto.createHash('sha256').update(parts.join('\n')).digest('hex');
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
  const sourceSha = sha256OfCatalog();
  const now = new Date().toISOString();
  const state = {
    $schema: 'schemas/install-state.schema.json',
    version: '0.0.1',
    harness_version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
    profile,
    installed_at: now,
    last_updated: now,
    components: {},
  };

  // 각 하네스의 출력 디렉터리 sha256 을 targets[].sha256 에 기록.
  // source_sha256 은 카탈로그 전체의 단일 해시 (변경 추적용).
  for (const b of builders) {
    const outDir = path.join(ROOT, `.${b}`);
    if (!fs.existsSync(outDir)) continue;
    const targetSha = sha256OfDir(outDir) || '0'.repeat(64);
    state.components[b] = {
      installed_at: now,
      source_sha256: sourceSha,
      targets: [{
        harness: b,
        path: outDir.replace(ROOT + path.sep, ''),
        sha256: targetSha,
      }],
    };
  }

  const stateFile = path.join(ROOT, '.harness', 'install-state.json');
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(`  state: ${stateFile.replace(ROOT + path.sep, '')}`);
  console.log(`  source_sha256: ${sourceSha.slice(0, 12)}…`);
}

async function main() {
  const args = parseArgs(process.argv);

  // 1. plan 먼저 (검증 + 결과 표시)
  console.log('=> plan 단계');
  const planResult = spawnSync(
    process.execPath,
    [path.join(__dirname, 'install-plan.js'), ...planArgs(args)],
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

  // 3. 빌더 실행 (agent.yaml harnesses 의 name 그대로)
  const manifest = JSON.parse(JSON.stringify(
    (await import('yaml')).default.parse(fs.readFileSync(path.join(ROOT, 'agent.yaml'), 'utf8'))
  ));
  const allBuilders = (manifest.harnesses || []).map(h => h.name);
  const builders = args.harness ? [args.harness] : allBuilders;
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

function planArgs(args) {
  return [
    ...(args.profile ? ['--profile', args.profile] : []),
    ...(args.harness ? ['--target', args.harness] : []),
    ...args.modules.flatMap(v => ['--module', v]),
    ...args.withoutModules.flatMap(v => ['--without-module', v]),
    ...args.components.flatMap(v => ['--component', v]),
    ...args.withoutComponents.flatMap(v => ['--without-component', v]),
  ];
}

main().catch((e) => {
  console.error('UNEXPECTED:', e?.stack || e);
  process.exit(1);
});
