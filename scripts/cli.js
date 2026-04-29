#!/usr/bin/env node
// HARNESS CLI 진입점.
// Day 6 부터: review / plan / self-review / codex-review wiring.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const verb = process.argv[2];
const rest = process.argv.slice(3);

function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

function help() {
  console.log(`
harness <verb> [args]

설치 / 검증
  install --plan [--profile <name>]      매니페스트 dry-run
  install --apply [--profile <name>]     실제 적용 (.claude/, .codex/ 빌드 + state 기록)
  validate                               카탈로그 + 마커 검증
  version

리뷰 풀사이클
  review "<task>" [--secure] [--fast] [--no-ship] [--live] [--session <id>]
                                         claude-led-codex-review 7단계
  plan "<task>"                          단계 1·2 만 (ideate + plan)
  self-review                            단계 4 만 (Claude self-review)
  codex-review                           단계 5 만 (Codex 독립 리뷰)

Day 6 시점 옵션:
  --live      실 LLM 호출 (ANTHROPIC_API_KEY + codex CLI 필요)
  (기본)      mock provider — API 키 / CLI 없이 풀사이클 검증

세션 / 비용
  sessions                               목록
  costs --since=7d                       (Day 7 이후)

기타
  validate, version, help
`);
}

async function dynamicReview(opts) {
  const { reviewCycle } = await import('./orchestrators/review.js');
  const result = await reviewCycle({ ...opts, harnessRoot: ROOT });
  console.log('');
  console.log('=== 결과 ===');
  console.log('  session    : ' + result.sessionId);
  console.log('  handoffs   : ' + result.handoffs.length);
  console.log('  human gate : ' + (result.humanGate ? `YES (${result.reason})` : 'no'));
  console.log('  secure     : ' + (result.secureActive ? 'active' : 'off'));
  if (result.humanGate) process.exit(3);
}

function parseReviewArgs(argv) {
  const opts = { task: '', live: false, secure: false, fast: false, noShip: false, sessionId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') opts.live = true;
    else if (a === '--secure') opts.secure = true;
    else if (a === '--fast') opts.fast = true;
    else if (a === '--no-ship') opts.noShip = true;
    else if (a === '--session') opts.sessionId = argv[++i];
    else if (!opts.task) opts.task = a;
    else opts.task += ' ' + a;
  }
  return opts;
}

(async () => {
  switch (verb) {
    case 'install': {
      const mode = rest.includes('--apply') ? 'apply' : 'plan';
      const filtered = rest.filter(a => a !== '--apply' && a !== '--plan');
      run(`install-${mode}.js`, filtered);
      break;
    }
    case 'validate':
      run('install-plan.js', ['--profile', 'core', '--verbose']);
      break;
    case 'review': {
      const opts = parseReviewArgs(rest);
      if (!opts.task) { console.error('task 가 비어있다. 예: harness review "JWT 검증 추가"'); process.exit(2); }
      await dynamicReview(opts);
      break;
    }
    case 'plan': {
      const opts = parseReviewArgs(rest);
      opts.fast = false;          // ideate + plan 둘 다 보고 싶을 때
      opts.noShip = true;
      // 임시 stop-after: implement 이전에 멈추기. Day 7 에 정식 분리.
      const { reviewCycle } = await import('./orchestrators/review.js');
      const result = await reviewCycle({ ...opts, harnessRoot: ROOT });
      console.log('handoffs:', result.handoffs.map(h => h.stage).join(' → '));
      break;
    }
    case 'self-review':
    case 'codex-review':
      console.error(`${verb} 단독 호출은 Day 7 에 분리 구현. 지금은 'review' 풀사이클을 쓰세요.`);
      process.exit(2);
    case 'sessions': {
      const dir = path.join(ROOT, '.harness', 'state', 'sessions');
      if (!fs.existsSync(dir)) { console.log('(세션 없음)'); break; }
      for (const s of fs.readdirSync(dir)) {
        const sd = path.join(dir, s);
        const handoffs = fs.existsSync(path.join(sd, 'handoffs'))
          ? fs.readdirSync(path.join(sd, 'handoffs')).filter(f => f.endsWith('.md')).length
          : 0;
        const gate = fs.existsSync(path.join(sd, 'HUMAN_GATE')) ? ' [HUMAN_GATE]' : '';
        console.log(`  ${s}  handoffs=${handoffs}${gate}`);
      }
      break;
    }
    case 'version':
    case '--version':
    case '-v': {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      console.log(`harness ${pkg.version}`);
      break;
    }
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      help();
      break;
    default:
      console.error(`알 수 없는 verb: ${verb}`);
      help();
      process.exit(2);
  }
})().catch((e) => { console.error('UNEXPECTED:', e?.stack || e); process.exit(1); });
