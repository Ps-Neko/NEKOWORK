#!/usr/bin/env node
// CLAUDE.md / .claude/CLAUDE.md 의 HARNESS:START~HARNESS:END 영역을
// agent.yaml + package.json + manifests 에서 다시 생성해 갈아낀다.
// 사용자 작성 영역(마커 바깥)은 그대로 보존한다.
// 멱등(idempotent). 마커가 없으면 "## 자동 갱신 영역" 헤딩 다음에 삽입한다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
  path.join(ROOT, 'CLAUDE.md'),
  path.join(ROOT, '.claude', 'CLAUDE.md'),
];

const START_RE = /<!--\s*HARNESS:START(?:\s+version=\S+)?\s*-->/;
const END_RE = /<!--\s*HARNESS:END\s*-->/;
const AUTO_HEADING_RE = /^##\s*자동 갱신 영역\s*$/m;

function parseArgs(argv) {
  const args = { check: false, dryRun: false, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error(`알 수 없는 인자: ${a}`); process.exit(2); }
  }
  return args;
}

function printHelp() {
  console.log(`
HARNESS sync-claude-md

사용법:
  node scripts/sync-claude-md.js [--check] [--dry-run] [--verbose]

옵션:
  --check    변경이 필요한지만 검사 (CI 용). 변경 필요하면 exit 1.
  --dry-run  렌더링 결과만 stdout 으로 출력하고 파일은 건드리지 않음.
  --verbose  대상 파일별 상세 로그.
`);
}

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function readYaml(rel) { return YAML.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }

function buildAutoSection() {
  const manifest = readYaml('agent.yaml');
  const pkg = readJson('package.json');
  const profilesDoc = readJson('manifests/install-profiles.json');

  const agentNames = manifest.agents || [];
  const skillNames = manifest.skills || [];
  const commandNames = manifest.commands || [];
  const hookList = manifest.hooks?.active || [];
  const profileNames = Object.keys(profilesDoc.profiles || {});
  const harnessNames = (manifest.harnesses || []).map(h => h.name);

  // agents/<name>.md frontmatter 에서 provider/model/sandbox 추출
  const rows = [];
  for (const a of agentNames) {
    const file = path.join(ROOT, 'agents', `${a}.md`);
    if (!fs.existsSync(file)) {
      rows.push({ name: a, provider: '?', model: '?', sandbox: '?' });
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    const fm = fmMatch ? YAML.parse(fmMatch[1]) : {};
    rows.push({
      name: a,
      provider: fm.provider || '?',
      model: fm.model || '?',
      sandbox: fm.sandbox || (Array.isArray(fm.disallowedTools) && fm.disallowedTools.length ? 'read-only' : 'full'),
    });
  }

  const lines = [];
  lines.push(`<!-- HARNESS:START version=${pkg.version} -->`);
  lines.push('<!-- 이 영역은 scripts/sync-claude-md.js 가 자동 갱신한다. 직접 편집 금지. -->');
  lines.push('');
  lines.push('## 카탈로그 요약');
  lines.push('');
  lines.push(`- agents: ${agentNames.length}`);
  lines.push(`- skills: ${skillNames.length}`);
  lines.push(`- commands: ${commandNames.length}${commandNames.length ? ' (legacy compat)' : ''}`);
  lines.push(`- hooks: ${hookList.length}${hookList.length ? ' (' + hookList.join(', ') + ')' : ''}`);
  lines.push(`- profiles: ${profileNames.join(', ')}`);
  lines.push(`- harnesses: ${harnessNames.join(', ')}`);
  lines.push('');

  lines.push('## 에이전트 → 모델 매트릭스');
  lines.push('');
  lines.push('| Agent | Provider | Model | Sandbox |');
  lines.push('|---|---|---|---|');
  for (const r of rows) {
    lines.push(`| ${r.name} | ${r.provider} | ${r.model} | ${r.sandbox} |`);
  }
  lines.push('');

  lines.push('## 핵심 명령어');
  lines.push('');
  lines.push('```bash');
  lines.push('harness install --plan --profile core      # 설치 dry-run');
  lines.push('harness ask "<task>"                       # question gate, no project mutation');
  lines.push('harness team "<task>"                      # read-only worker handoffs');
  lines.push('harness work "<task>"                      # single executor implement handoff');
  lines.push('harness verify "<task>" --session <id>     # Codex-only verification');
  lines.push('harness gate status --session <id>         # inspect or resolve HUMAN_GATE state');
  lines.push('harness ship "<task>" --session <id>       # ship/no-ship readiness handoff');
  lines.push('harness apply --session <id>               # apply verified SHIP_READY live-work diff');
  lines.push('harness run "<task>" --session <id>        # work -> verify -> ship, optional --apply');
  lines.push('harness review "<task>" [--secure|--fast|--no-ship]  # legacy full cycle');
  lines.push('harness review-cycle "<task>" [--secure|--fast|--no-ship]  # explicit legacy alias');
  lines.push('harness plan "<task>"');
  lines.push('harness self-review');
  lines.push('harness codex-review                       # 단계 5 단독');
  lines.push('harness sessions');
  lines.push('harness costs --since=7d');
  lines.push('```');
  lines.push('');

  lines.push('## State 경로');
  lines.push('');
  const st = manifest.state || {};
  lines.push(`- 세션: \`${st.session_dir || '.harness/state/sessions'}/<id>/{prd.json,progress.txt,notepad.md,handoffs/}\``);
  lines.push(`- 프로젝트: \`${st.project_memory || '.harness/project-memory.json'}\` + \`WORKING-CONTEXT.md\``);
  lines.push(`- 글로벌: \`${st.global_instincts || '~/.harness/instincts'}/\` + \`${st.costs || '.harness/costs.jsonl'}\``);
  lines.push('');

  lines.push('## 매직 키워드 → 스킬 (명시 옵트인만)');
  lines.push('');
  lines.push('자동 활성 키워드 감지는 **사용**하지 않는다. 사용자 룰("확인 후 실행") 우선. 모든 스킬은 슬래시 명령(`/claude-led-codex-review`) 또는 CLI(`harness review`) 로 명시 호출.');
  lines.push('');

  lines.push('## 핸드오프 5필드');
  lines.push('');
  lines.push('Decided / Rejected / Risks / Files / Remaining — 10~20줄.');
  lines.push('');
  lines.push('<!-- HARNESS:END -->');

  return lines.join('\n') + '\n';
}

function applyToContent(content, autoSection) {
  const sIdx = content.search(START_RE);
  const eIdx = content.search(END_RE);

  if (sIdx !== -1 && eIdx !== -1 && sIdx < eIdx) {
    // 두 마커 사이를 통째로 교체. 끝 마커 라인 끝까지 포함.
    const endLineEnd = content.indexOf('\n', eIdx);
    const tail = endLineEnd === -1 ? '' : content.slice(endLineEnd + 1);
    return content.slice(0, sIdx) + autoSection + (tail.length ? tail : '');
  }

  // 마커 없음 → "## 자동 갱신 영역" 다음 줄부터 EOF 까지 자동 컨텐츠로 본다.
  // 그 영역을 통째로 새 마커 블록으로 갈아낀다 (사용자 작성 영역은 헤딩 위쪽이므로 보존).
  const headingMatch = AUTO_HEADING_RE.exec(content);
  if (headingMatch) {
    const headingEnd = content.indexOf('\n', headingMatch.index);
    const before = content.slice(0, headingEnd + 1);
    return before + '\n' + autoSection;
  }

  // 헤딩도 없으면 파일 끝에 추가
  return content.replace(/\s*$/, '\n\n## 자동 갱신 영역\n\n') + autoSection;
}

function processFile(file, autoSection, args) {
  if (!fs.existsSync(file)) {
    if (args.verbose) console.log(`[SKIP] ${path.relative(ROOT, file)} 없음`);
    return { changed: false, skipped: true };
  }
  const before = fs.readFileSync(file, 'utf8');
  const after = applyToContent(before, autoSection);
  const changed = before !== after;
  if (args.verbose || changed) {
    console.log(`[${changed ? 'DIFF' : ' OK '}] ${path.relative(ROOT, file)}`);
  }
  if (changed && !args.dryRun && !args.check) {
    fs.writeFileSync(file, after);
  }
  return { changed, skipped: false };
}

function main() {
  const args = parseArgs(process.argv);
  const autoSection = buildAutoSection();

  if (args.dryRun) {
    process.stdout.write(autoSection);
    return;
  }

  let anyChanged = false;
  for (const f of TARGETS) {
    const r = processFile(f, autoSection, args);
    if (r.changed) anyChanged = true;
  }

  if (args.check) {
    if (anyChanged) {
      console.error('CLAUDE.md 자동 영역이 카탈로그와 어긋남. `node scripts/sync-claude-md.js` 실행 필요.');
      process.exit(1);
    }
    console.log('CLAUDE.md 자동 영역 동기화 OK.');
    return;
  }

  console.log(anyChanged ? '동기화 완료.' : '변경 없음.');
}

main();
