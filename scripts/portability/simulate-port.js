#!/usr/bin/env node
// PoC 이식 시뮬레이터. PORTING.md 의 30분 절차를 dry-run 으로 검증.
//
// 입력: --target <대상 디렉터리>  (예: D:/claude/iljin-rag-poc)
//       --profile <name>           (기본: research)
//
// 출력: 대상 디렉터리에 어떤 파일이 새로 들어갈지 / 어떤 파일이 보존되는지 / 충돌 가능성 리포트.
// 실 변경 없음 (--apply 옵션 미존재).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HARNESS_ROOT = path.resolve(__dirname, '..', '..');

function args() {
  const a = { target: null, profile: 'research', verbose: false, json: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--target') a.target = argv[++i];
    else if (v === '--profile') a.profile = argv[++i];
    else if (v === '--verbose') a.verbose = true;
    else if (v === '--json') a.json = true;
    else if (v === '--help' || v === '-h') { help(); process.exit(0); }
    else { console.error(`알 수 없는: ${v}`); process.exit(2); }
  }
  return a;
}

function help() {
  console.log(`
HARNESS PoC 이식 시뮬레이터 (dry-run only).

사용법:
  node scripts/portability/simulate-port.js --target <dir> [--profile <name>] [--verbose] [--json]

예:
  node scripts/portability/simulate-port.js --target D:/claude/iljin-rag-poc --profile research
  node scripts/portability/simulate-port.js --target D:/claude/cad-api-bridge --profile developer
`);
}

function inspectTarget(dir) {
  const r = { exists: false, isGitRepo: false, hasClaudeMd: false, hasAgentsMd: false, hasMcpJson: false, files: [] };
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return r;
  r.exists = true;
  r.isGitRepo = fs.existsSync(path.join(dir, '.git'));
  r.hasClaudeMd = fs.existsSync(path.join(dir, 'CLAUDE.md'));
  r.hasAgentsMd = fs.existsSync(path.join(dir, 'AGENTS.md'));
  r.hasMcpJson = fs.existsSync(path.join(dir, '.mcp.json'));
  for (const p of ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'requirements.txt']) {
    if (fs.existsSync(path.join(dir, p))) r.files.push(p);
  }
  return r;
}

function recommendStrategy(insp) {
  // 가장 단순한 분류:
  if (!insp.exists) return { strategy: 'create', reason: '대상 디렉터리 없음 — 새로 만들고 결합' };
  if (!insp.isGitRepo) return { strategy: 'init+submodule', reason: 'git 미초기화 — git init 후 submodule 권장' };
  if (insp.hasClaudeMd || insp.hasAgentsMd) return { strategy: 'submodule', reason: 'CLAUDE/AGENTS.md 보존 + submodule 결합' };
  return { strategy: 'submodule', reason: '표준 결합' };
}

function loadHarnessPlan(profile) {
  const r = spawnSync(process.execPath, [
    path.join(HARNESS_ROOT, 'scripts', 'install-plan.js'),
    '--profile', profile, '--json',
  ], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`harness plan 실패: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

function detectConflicts(target, plan, insp) {
  const conflicts = [];
  // CLAUDE.md / AGENTS.md 마커 충돌 가능성
  if (insp.hasClaudeMd) {
    const text = fs.readFileSync(path.join(target, 'CLAUDE.md'), 'utf8');
    if (!/<!--\s*HARNESS:START/i.test(text)) {
      conflicts.push({
        severity: 'medium',
        file: 'CLAUDE.md',
        why: '기존 CLAUDE.md 가 있고 HARNESS:START/END 마커가 없다 → 마커 영역 추가 필요',
      });
    }
  }
  if (insp.hasMcpJson) {
    conflicts.push({
      severity: 'high',
      file: '.mcp.json',
      why: '기존 .mcp.json 존재 — harness 게이트웨이 추가 시 namespace 충돌 가능. 머지 필요.',
    });
  }
  // 새 파일 vs 기존 파일
  const wouldAdd = [];
  for (const c of plan.components || []) {
    if (c.harness !== 'claude' && c.harness !== 'codex') continue;
    if (!c.target) continue;
    const t = path.join(target, c.target);
    if (fs.existsSync(t)) {
      conflicts.push({
        severity: 'medium', file: c.target,
        why: `이미 존재 (${c.type}) — 덮어쓰기 위험. 백업 권장.`,
      });
    } else {
      wouldAdd.push(c.target);
    }
  }
  return { conflicts, wouldAdd };
}

function printReport(report, json, verbose) {
  if (json) { console.log(JSON.stringify(report, null, 2)); return; }
  const C = (s) => process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s;
  console.log('');
  console.log(C(`HARNESS PoC 이식 시뮬레이터`));
  console.log('  target            : ' + report.target);
  console.log('  exists            : ' + report.inspection.exists);
  console.log('  git repo          : ' + report.inspection.isGitRepo);
  console.log('  CLAUDE.md         : ' + report.inspection.hasClaudeMd);
  console.log('  AGENTS.md         : ' + report.inspection.hasAgentsMd);
  console.log('  .mcp.json         : ' + report.inspection.hasMcpJson);
  console.log('  package files     : ' + report.inspection.files.join(', '));
  console.log('  추천 전략         : ' + report.strategy.strategy + ' (' + report.strategy.reason + ')');
  console.log('  profile           : ' + report.profile);
  console.log('  components plan   : ' + report.plan.component_count);
  console.log('  새로 추가 (예상)  : ' + report.wouldAdd.length);
  console.log('  충돌 (예상)       : ' + report.conflicts.length);
  if (report.conflicts.length) {
    console.log('');
    console.log(C('충돌 / 주의:'));
    for (const c of report.conflicts) console.log(`  - [${c.severity}] ${c.file} — ${c.why}`);
  }
  if (verbose) {
    console.log('');
    console.log(C('새로 추가될 파일/디렉터리 (일부):'));
    for (const f of report.wouldAdd.slice(0, 20)) console.log('  + ' + f);
    if (report.wouldAdd.length > 20) console.log(`  ... (+${report.wouldAdd.length - 20}개)`);
  }
  console.log('');
  console.log('NOTE: 이 시뮬레이터는 변경하지 않는다. 실제 결합은 PORTING.md 의 절차를 따른다.');
  console.log('');
}

function main() {
  const a = args();
  if (!a.target) { console.error('--target 필요'); help(); process.exit(2); }
  const target = path.resolve(a.target);
  const insp = inspectTarget(target);
  const strategy = recommendStrategy(insp);
  const plan = loadHarnessPlan(a.profile);
  const { conflicts, wouldAdd } = detectConflicts(target, plan, insp);
  const report = {
    target, profile: a.profile,
    harness_version: plan.harness_version,
    inspection: insp,
    strategy,
    plan: { component_count: plan.component_count, modules: plan.modules },
    wouldAdd, conflicts,
    note: 'dry-run only',
  };
  printReport(report, a.json, a.verbose);
  if (conflicts.some(c => c.severity === 'high')) process.exit(1);
}

main();
