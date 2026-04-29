#!/usr/bin/env node
// HARNESS repair : install-state.json 과 실 디스크의 빌드 산출물을 비교해
// 누락 / sha256 불일치인 하네스만 다시 빌드한다. install-apply 의 경량판.
//
// - state 파일 없음 → 안내 후 종료.
// - 빌드 산출 디렉터리 누락 → 해당 빌더 재실행.
// - 디렉터리 존재하지만 산출 sha256 (전 디렉터리 합산) 가 다름 → 재빌드.
// - --check 면 변경 없음. 부정합만 보고하고 exit 1.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(ROOT, '.harness', 'install-state.json');

function parseArgs(argv) {
  const args = { check: false, harness: null, force: false, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--harness') args.harness = argv[++i];
    else if (a === '--force') args.force = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error(`알 수 없는 인자: ${a}`); process.exit(2); }
  }
  return args;
}

function printHelp() {
  console.log(`
HARNESS repair

사용법:
  node scripts/repair.js [--check] [--harness <name>] [--force] [--verbose]

옵션:
  --check          변경 없이 부정합만 보고. 부정합 있으면 exit 1.
  --harness <n>    특정 하네스만 검사 (claude | codex | cursor | gemini | opencode)
  --force          모든 하네스 강제 재빌드 (state 무시).
  --verbose        상세 로그.
`);
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

function runBuilder(name) {
  const script = path.join(__dirname, `build-${name}.js`);
  if (!fs.existsSync(script)) {
    console.error(`  [SKIP] build-${name}.js 없음`);
    return false;
  }
  const r = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  return r.status === 0;
}

function main() {
  const args = parseArgs(process.argv);

  const manifest = YAML.parse(fs.readFileSync(path.join(ROOT, 'agent.yaml'), 'utf8'));
  const harnessDefs = manifest.harnesses || [];

  let state = null;
  if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } else if (!args.force) {
    console.error('install-state.json 없음. 먼저 `install.sh --apply` 실행 필요.');
    console.error(`(${path.relative(ROOT, STATE_FILE)})`);
    process.exit(1);
  }

  const targets = harnessDefs.filter(h => !args.harness || h.name === args.harness);
  if (args.harness && targets.length === 0) {
    console.error(`알 수 없는 하네스: ${args.harness}`);
    process.exit(2);
  }

  const issues = []; // { harness, reason }
  for (const h of targets) {
    const outDir = path.join(ROOT, h.output_dir);
    const exists = fs.existsSync(outDir);
    const stateEntry = state?.components?.[h.name];

    if (args.force) {
      issues.push({ harness: h.name, reason: 'force 옵션' });
      continue;
    }

    if (!exists) {
      issues.push({ harness: h.name, reason: `${h.output_dir} 없음` });
      continue;
    }

    if (!stateEntry) {
      issues.push({ harness: h.name, reason: 'state 미기록 (install-apply 미실행 또는 외부 추가)' });
      continue;
    }

    // state 의 placeholder("0"*64) 는 비교 무의미 → 디렉터리만 검증
    const stateSha = stateEntry.targets?.[0]?.sha256 || null;
    if (stateSha && stateSha !== '0'.repeat(64)) {
      const actualSha = sha256OfDir(outDir);
      if (actualSha !== stateSha) {
        issues.push({ harness: h.name, reason: `sha256 불일치 (${actualSha?.slice(0, 12)} vs ${stateSha.slice(0, 12)})` });
        continue;
      }
    }

    if (args.verbose) console.log(`[OK]   ${h.name}: ${h.output_dir}`);
  }

  if (issues.length === 0) {
    console.log('모든 하네스 정합. 재빌드 불필요.');
    return;
  }

  console.log(`재빌드 필요 (${issues.length}):`);
  for (const i of issues) console.log(`  - ${i.harness.padEnd(10)} ${i.reason}`);
  console.log('');

  if (args.check) {
    console.error('--check 모드. 재빌드 안 함.');
    process.exit(1);
  }

  let failed = 0;
  for (const i of issues) {
    console.log(`=> rebuild ${i.harness}`);
    if (!runBuilder(i.harness)) {
      console.error(`  build-${i.harness} 실패`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n${failed}개 빌더 실패.`);
    process.exit(1);
  }

  // state 갱신: last_updated + 각 하네스의 sha256 (placeholder 였던 항목은 실 sha256 으로)
  if (state) {
    state.last_updated = new Date().toISOString();
    for (const i of issues) {
      const outDir = path.join(ROOT, harnessDefs.find(h => h.name === i.harness).output_dir);
      const sha = sha256OfDir(outDir) || '0'.repeat(64);
      state.components ??= {};
      state.components[i.harness] = {
        installed_at: state.components[i.harness]?.installed_at || new Date().toISOString(),
        source_sha256: '0'.repeat(64),
        targets: [{ harness: i.harness, path: harnessDefs.find(h => h.name === i.harness).output_dir, sha256: sha }],
      };
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`\nstate 갱신: ${path.relative(ROOT, STATE_FILE)}`);
  }

  console.log('repair 완료.');
}

main();
