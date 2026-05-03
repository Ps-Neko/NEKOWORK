#!/usr/bin/env node
// NEKOWORK/HARNESS CLI entrypoint.
// Public verbs: doctor, plan, review, install, validate, version.
// Advanced verbs: self-review, codex-review, ralph, wait, sessions, costs, instincts.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const verb = process.argv[2];
const rest = process.argv.slice(3);

function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

function resolveProjectRoot(value) {
  return path.resolve(value || process.env.HARNESS_PROJECT_ROOT || process.cwd());
}

function help() {
  console.log(`
harness <verb> [args]

Install / verify
  install --plan [--profile <name>] [--target <name>] [--module <id>] [--component <id>] [--project-root <dir>]
                                         selective manifest dry-run
  install --plan --list [--json]         list profile/module/component/target catalog
  install --apply [--profile <name>] [--project-root <dir>]
                                         apply generated harness outputs and state
  validate                               validate catalog and core profile
  doctor [--project-root <dir>] [--quick] [--gemini-smoke] [--json]
                                         local environment health check
  version

Review loop
  review "<task>" [--secure] [--fast] [--no-ship] [--no-codex] [--live] [--session <id>] [--project-root <dir>]
                                         claude-led-codex-review workflow
  plan "<task>" [--project-root <dir>]   ideate + plan only
  self-review                            reserved; use review for now
  codex-review                           reserved; use review for now

Options:
  --live      use local CLI sessions. Claude uses claude auth, Codex uses codex login.
              API keys are not needed for the default delegated CLI path.
  --project-root <dir>
              target project root for session/state/git work. Agents/schemas are read
              from the HARNESS install root.
  default     mock provider; no API keys or provider CLIs required

Advanced
  ralph "<task>" [--max-iter 5] [--secure] [--live] [--project-root <dir>]
                                         repeat until PRD acceptance criteria pass
  team-lite "<task>" [--live] [--session <id>] [--project-root <dir>]
                                         OMC-style staged team pipeline
  wait start                             start persistent daemon
  wait stop                              stop persistent daemon
  wait status                            daemon status

Sessions / cost / learning
  sessions                               list sessions
  costs --since=7d [--rows] [--json]     summarize cost estimates
  instincts list [--kind <k>] [--min-confidence <n>] [--json]
  instincts show <id>
  instincts ready [--max-stale-days N] [--min-diversity X] [--blocked]
                                         list promotion candidates; human confirmation required
  instincts promote <id>                 promote only at confidence 1.0
  instincts prune [--older-days N] [--dry-run]

Other
  validate, doctor, version, help
`);
}

async function dynamicReview(opts) {
  const { reviewCycle } = await import('./orchestrators/review.js');
  const result = await reviewCycle({
    ...opts,
    harnessRoot: ROOT,
    projectRoot: resolveProjectRoot(opts.projectRoot),
  });

  console.log('');
  console.log('=== result ===');
  console.log('  session    : ' + result.sessionId);
  console.log('  handoffs   : ' + result.handoffs.length);
  console.log('  human gate : ' + (result.humanGate ? `YES (${result.reason})` : 'no'));
  console.log('  secure     : ' + (result.secureActive ? 'active' : 'off'));
  if (result.humanGate) process.exit(3);
}

function usageError(message) {
  const err = new Error(message);
  err.cliUsage = true;
  return err;
}

function parseReviewArgs(argv) {
  const opts = {
    task: '',
    live: false,
    secure: false,
    fast: false,
    noShip: false,
    noCodex: false,
    sessionId: null,
    projectRoot: null,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') opts.live = true;
    else if (a === '--secure') opts.secure = true;
    else if (a === '--fast') opts.fast = true;
    else if (a === '--no-ship') opts.noShip = true;
    else if (a === '--no-codex') opts.noCodex = true;
    else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = value;
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a === '--max-iter') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--max-iter requires a value');
      opts.maxIter = Number(value);
    } else if (a.startsWith('--max-iter=')) {
      opts.maxIter = Number(a.slice('--max-iter='.length));
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else if (!opts.task) {
      opts.task = a;
    } else {
      opts.task += ' ' + a;
    }
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  if (opts.secure && opts.fast) throw usageError('--secure and --fast cannot be used together');
  if (opts.noCodex && opts.secure) throw usageError('--no-codex and --secure cannot be used together');
  if (opts.maxIter != null && (!Number.isFinite(opts.maxIter) || opts.maxIter < 1)) {
    throw usageError('--max-iter must be a number >= 1');
  }

  return opts;
}

function optionValue(argv, flag, fallback = undefined) {
  const i = argv.indexOf(flag);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  for (const a of argv) {
    if (a.startsWith(`${flag}=`)) return a.slice(flag.length + 1);
  }
  return fallback;
}

function optionNumber(argv, flag, fallback = undefined) {
  const value = optionValue(argv, flag, undefined);
  return value == null ? fallback : Number(value);
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

    case 'doctor':
      run('doctor.js', rest);
      break;

    case 'review': {
      const opts = parseReviewArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: harness review "add JWT validation"');
        process.exit(2);
      }
      await dynamicReview(opts);
      break;
    }

    case 'ralph': {
      const opts = parseReviewArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: harness ralph "feature X" --max-iter 5');
        process.exit(2);
      }
      const { ralphLoop } = await import('./orchestrators/ralph.js');
      const r = await ralphLoop({
        ...opts,
        harnessRoot: ROOT,
        projectRoot: resolveProjectRoot(opts.projectRoot),
      });
      console.log('=== ralph done ===');
      console.log(JSON.stringify(r, null, 2));
      if (r.reason === 'human_gate') process.exit(3);
      break;
    }

    case 'team-lite': {
      const opts = parseReviewArgs(rest);
      if (!opts.task) {
        console.error('task is required. Example: harness team-lite "refactor auth guard"');
        process.exit(2);
      }
      const { teamLiteCycle } = await import('./orchestrators/team-lite.js');
      const r = await teamLiteCycle({
        ...opts,
        harnessRoot: ROOT,
        projectRoot: resolveProjectRoot(opts.projectRoot),
      });
      console.log('=== team-lite done ===');
      console.log('  session  : ' + r.sessionId);
      console.log('  tasks    : ' + r.tasks.map(t => `${t.id}:${t.status}`).join(', '));
      console.log('  handoffs : ' + r.handoffs.length);
      console.log('  verdict  : ' + r.verdict);
      break;
    }

    case 'wait':
      run('daemon/wait.js', rest.length ? rest : ['status']);
      break;

    case 'plan': {
      const opts = parseReviewArgs(rest);
      opts.fast = false;
      opts.noShip = true;
      const { reviewCycle } = await import('./orchestrators/review.js');
      const result = await reviewCycle({
        ...opts,
        harnessRoot: ROOT,
        projectRoot: resolveProjectRoot(opts.projectRoot),
        stopAfter: 'plan',
      });
      console.log('handoffs:', result.handoffs.map(h => h.stage).join(' -> '));
      break;
    }

    case 'self-review':
    case 'codex-review':
      console.error(`${verb} is reserved. Use the review workflow for now.`);
      process.exit(2);

    case 'instincts': {
      const sub = rest[0] || 'list';
      const { list: iList, get: iGet, promote: iPromote, prune: iPrune } = await import('./lib/instincts.js');

      if (sub === 'list') {
        const minConfidence = optionNumber(rest, '--min-confidence', 0);
        const kind = optionValue(rest, '--kind', undefined);
        const rows = iList({ kind, minConfidence });

        if (rest.includes('--json')) {
          console.log(JSON.stringify(rows, null, 2));
        } else {
          console.log(`total=${rows.length} (kind=${kind || 'any'}, min-confidence=${minConfidence})`);
          for (const r of rows) {
            const mark = r.promoted ? '[PROMOTED]' : (r.confidence >= 1 ? '[READY]' : '');
            console.log(`  ${r.id}  ${r.kind.padEnd(15)} count=${String(r.count).padStart(3)} conf=${r.confidence.toFixed(2)} ${mark} ${r.key}`);
          }
        }
      } else if (sub === 'show') {
        const id = rest[1];
        if (!id) {
          console.error('id is required');
          process.exit(2);
        }
        const inst = iGet(id);
        if (!inst) {
          console.error('not found');
          process.exit(1);
        }
        console.log(JSON.stringify(inst, null, 2));
      } else if (sub === 'ready') {
        const { ready: iReady } = await import('./lib/instincts.js');
        const maxStaleDays = optionNumber(rest, '--max-stale-days', 14);
        const minDiversity = optionNumber(rest, '--min-diversity', 0.5);
        const r = iReady({ maxStaleDays, minDiversity });

        if (rest.includes('--json')) {
          console.log(JSON.stringify(r, null, 2));
        } else {
          console.log(`promotion candidates=${r.ready.length} (max-stale-days=${maxStaleDays}, min-diversity=${minDiversity})`);
          for (const x of r.ready) {
            console.log(`  ${x.id}  ${x.kind.padEnd(15)} count=${x.count} div=${x.diversity}  ${x.key}`);
          }
          if (rest.includes('--blocked')) {
            console.log(`\nblocked=${r.blocked.length}`);
            for (const x of r.blocked) console.log(`  ${x.id}  ${x.reason}  ${x.key}`);
          }
          console.log('\nPromotion requires explicit command: harness instincts promote <id>');
        }
      } else if (sub === 'promote') {
        const id = rest[1];
        if (!id) {
          console.error('id is required');
          process.exit(2);
        }
        const r = iPromote(id);
        console.log(`promoted: ${r.id} (${r.key})`);
      } else if (sub === 'prune') {
        const dryRun = rest.includes('--dry-run');
        const olderDays = optionNumber(rest, '--older-days', undefined);
        const r = iPrune({ olderDays, dryRun });
        console.log(`removed=${r.removed.length}, kept=${r.kept}, dry_run=${r.dry_run}`);
        if (rest.includes('--rows')) {
          for (const x of r.removed) console.log(`  - ${x.id} ${x.kind} ${x.key}`);
        }
      } else {
        console.error(`unknown subverb: ${sub}. list | show <id> | ready | promote <id> | prune`);
        process.exit(2);
      }
      break;
    }

    case 'costs': {
      const since = optionValue(rest, '--since', '7d');
      const { list, summarize } = await import('./lib/costs.js');
      const rows = list({ since });
      const sum = summarize(rows);
      console.log(`since=${since}, rows=${sum.rows}, total=$${sum.total_usd}`);
      console.log('by_provider:', JSON.stringify(sum.by_provider));
      console.log('by_model   :', JSON.stringify(sum.by_model));
      if (rest.includes('--json')) {
        console.log(JSON.stringify({ since, summary: sum, rows }, null, 2));
      } else if (rest.includes('--rows')) {
        for (const r of rows.slice(-20)) console.log('  ' + JSON.stringify(r));
      }
      break;
    }

    case 'sessions': {
      const sessionsProjectRoot = optionValue(rest, '--project-root', null);
      const dir = path.join(resolveProjectRoot(sessionsProjectRoot), '.harness', 'state', 'sessions');
      if (!fs.existsSync(dir)) {
        console.log('(no sessions)');
        break;
      }
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
      console.error(`unknown verb: ${verb}`);
      help();
      process.exit(2);
  }
})().catch((e) => {
  if (e?.cliUsage) {
    console.error(e.message);
    process.exit(2);
  }
  console.error('UNEXPECTED:', e?.stack || e);
  process.exit(1);
});
