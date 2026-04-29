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

영속 / ralph (Day 8)
  ralph "<task>" [--max-iter 5] [--secure] [--live]
                                         PRD AC 가 모두 passes 될 때까지 반복
  wait start                             영속 데몬 시작 (background)
  wait stop                              데몬 정지
  wait status                            데몬 상태

세션 / 비용 / 인스팅트
  sessions                               목록
  costs --since=7d [--rows] [--json]     비용 합산
  instincts list [--kind <k>] [--min-confidence <n>] [--json]
  instincts show <id>
  instincts ready [--max-stale-days N] [--min-diversity X] [--blocked]
                                         자동 promote 후보 (사용자가 confirm 필요)
  instincts promote <id>                 신뢰도 1.0 도달 시만
  instincts prune [--older-days N] [--dry-run]

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
    else if (a === '--max-iter') { opts.maxIter = Number(argv[++i]); }
    else if (a.startsWith('--max-iter=')) { opts.maxIter = Number(a.slice('--max-iter='.length)); }
    else if (a.startsWith('--')) { /* 알 수 없는 플래그 무시 */ }
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
    case 'ralph': {
      const opts = parseReviewArgs(rest);
      const i = rest.indexOf('--max-iter');
      if (i >= 0 && rest[i + 1]) opts.maxIter = Number(rest[i + 1]);
      else for (const a of rest) if (a.startsWith('--max-iter=')) opts.maxIter = Number(a.slice('--max-iter='.length));
      if (!opts.task) { console.error('--task 필요. 예: harness ralph "기능 X" --max-iter 5'); process.exit(2); }
      const { ralphLoop } = await import('./orchestrators/ralph.js');
      const r = await ralphLoop({ ...opts, harnessRoot: ROOT });
      console.log('=== ralph 종료 ===');
      console.log(JSON.stringify(r, null, 2));
      if (r.reason === 'human_gate') process.exit(3);
      break;
    }
    case 'wait': {
      run('daemon/wait.js', rest.length ? rest : ['status']);
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
    case 'instincts': {
      const sub = rest[0] || 'list';
      const { list: iList, get: iGet, promote: iPromote, prune: iPrune } = await import('./lib/instincts.js');
      if (sub === 'list') {
        const minConfArg = (() => {
          const i = rest.indexOf('--min-confidence');
          if (i >= 0) return Number(rest[i + 1]);
          for (const a of rest) if (a.startsWith('--min-confidence=')) return Number(a.slice('--min-confidence='.length));
          return 0;
        })();
        const kindArg = (() => {
          const i = rest.indexOf('--kind');
          if (i >= 0) return rest[i + 1];
          for (const a of rest) if (a.startsWith('--kind=')) return a.slice('--kind='.length);
          return undefined;
        })();
        const rows = iList({ kind: kindArg, minConfidence: minConfArg });
        if (rest.includes('--json')) console.log(JSON.stringify(rows, null, 2));
        else {
          console.log(`총 ${rows.length}건 (kind=${kindArg || 'any'}, min-confidence=${minConfArg})`);
          for (const r of rows) {
            const mark = r.promoted ? '[PROMOTED]' : (r.confidence >= 1 ? '[READY]' : '');
            console.log(`  ${r.id}  ${r.kind.padEnd(15)} count=${String(r.count).padStart(3)} conf=${r.confidence.toFixed(2)} ${mark} ${r.key}`);
          }
        }
      } else if (sub === 'show') {
        const id = rest[1];
        if (!id) { console.error('id 필요'); process.exit(2); }
        const inst = iGet(id);
        if (!inst) { console.error('없음'); process.exit(1); }
        console.log(JSON.stringify(inst, null, 2));
      } else if (sub === 'ready') {
        const { ready: iReady } = await import('./lib/instincts.js');
        const maxStaleArg = (() => {
          const i = rest.indexOf('--max-stale-days');
          if (i >= 0) return Number(rest[i + 1]);
          for (const a of rest) if (a.startsWith('--max-stale-days=')) return Number(a.slice('--max-stale-days='.length));
          return 14;
        })();
        const minDivArg = (() => {
          const i = rest.indexOf('--min-diversity');
          if (i >= 0) return Number(rest[i + 1]);
          for (const a of rest) if (a.startsWith('--min-diversity=')) return Number(a.slice('--min-diversity='.length));
          return 0.5;
        })();
        const r = iReady({ maxStaleDays: maxStaleArg, minDiversity: minDivArg });
        if (rest.includes('--json')) console.log(JSON.stringify(r, null, 2));
        else {
          console.log(`자동 promote 후보 ${r.ready.length}건  (max-stale-days=${maxStaleArg}, min-diversity=${minDivArg})`);
          for (const x of r.ready) console.log(`  ✓ ${x.id}  ${x.kind.padEnd(15)} count=${x.count} div=${x.diversity}  ${x.key}`);
          if (rest.includes('--blocked')) {
            console.log(`\n차단 ${r.blocked.length}건:`);
            for (const x of r.blocked) console.log(`  ✗ ${x.id}  ${x.reason}  ${x.key}`);
          }
          console.log(`\n실 promote 는 'harness instincts promote <id>' 명시 호출 (사용자 룰).`);
        }
      } else if (sub === 'promote') {
        const id = rest[1];
        if (!id) { console.error('id 필요'); process.exit(2); }
        const r = iPromote(id);
        console.log(`promoted: ${r.id} (${r.key})`);
      } else if (sub === 'prune') {
        const dryRun = rest.includes('--dry-run');
        const olderArg = (() => {
          const i = rest.indexOf('--older-days');
          if (i >= 0) return Number(rest[i + 1]);
          for (const a of rest) if (a.startsWith('--older-days=')) return Number(a.slice('--older-days='.length));
          return undefined;
        })();
        const r = iPrune({ olderDays: olderArg, dryRun });
        console.log(`removed=${r.removed.length}, kept=${r.kept}, dry_run=${r.dry_run}`);
        if (rest.includes('--rows')) for (const x of r.removed) console.log(`  - ${x.id} ${x.kind} ${x.key}`);
      } else {
        console.error(`알 수 없는 subverb: ${sub}. list | show <id> | promote <id> | prune`);
        process.exit(2);
      }
      break;
    }
    case 'costs': {
      const since = (() => {
        const i = rest.indexOf('--since');
        if (i >= 0 && rest[i + 1]) return rest[i + 1];
        for (const a of rest) if (a.startsWith('--since=')) return a.slice('--since='.length);
        return '7d';
      })();
      const { list, summarize } = await import('./lib/costs.js');
      const rows = list({ since });
      const sum = summarize(rows);
      console.log(`since=${since}, rows=${sum.rows}, total=$${sum.total_usd}`);
      console.log('by_provider:', JSON.stringify(sum.by_provider));
      console.log('by_model   :', JSON.stringify(sum.by_model));
      if (rest.includes('--json')) console.log(JSON.stringify({ since, summary: sum, rows }, null, 2));
      else if (rest.includes('--rows')) for (const r of rows.slice(-20)) console.log('  ' + JSON.stringify(r));
      break;
    }
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
