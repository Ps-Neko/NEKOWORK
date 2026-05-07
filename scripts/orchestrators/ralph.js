// Persistent Ralph loop. It repeats an execution engine until PRD acceptance
// criteria pass, a human gate stops the run, cost cap is hit, or max-iter ends.

import fs from 'node:fs';
import path from 'node:path';
import { reviewCycle } from './review.js';
import { runCycle } from './run.js';
import { list as costList, summarize as costSummarize } from '../lib/costs.js';

const DEFAULT_MAX_ITER = Number(process.env.HARNESS_RALPH_MAX_ITER || 5);
const DAILY_CAP_USD = Number(process.env.HARNESS_DAILY_COST_CAP_USD || 0);
const VALID_ENGINES = new Set(['review', 'legacy-review', 'run']);

export async function ralphLoop(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  const sessionId = opts.sessionId || `ralph-${Date.now()}`;
  const maxIter = Math.max(1, Number(opts.maxIter || DEFAULT_MAX_ITER));
  const engine = normalizeEngine(opts.engine || 'review');

  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, 'active'), renderActiveFile({
    started_at: new Date().toISOString(),
    mode: 'ralph',
    engine,
    task: opts.task,
    max_iter: maxIter,
    live: Boolean(opts.live),
    secure: Boolean(opts.secure),
  }));

  const log = (m) => console.log(`[ralph:${sessionId}] ${m}`);
  const progress = (line) => fs.appendFileSync(path.join(sessionDir, 'progress.txt'), `[${new Date().toISOString()}] ${line}\n`);

  log(`start: max-iter=${maxIter}, engine=${engine}, task="${opts.task}"`);

  let iter = 0;
  let result;
  const iterationSessions = [];
  while (iter < maxIter) {
    iter++;
    log(`iter ${iter}/${maxIter}`);
    progress(`iter ${iter} start (${engine})`);

    if (DAILY_CAP_USD > 0) {
      const today = costList({ since: '24h' });
      const sum = costSummarize(today);
      if (sum.total_usd >= DAILY_CAP_USD) {
        log(`STOP: daily cost cap $${DAILY_CAP_USD} reached (current $${sum.total_usd})`);
        progress('STOP cost_cap');
        try { fs.unlinkSync(path.join(sessionDir, 'active')); } catch {}
        return finish(sessionDir, 'cost_cap', { engine, iter, iteration_sessions: iterationSessions, sum });
      }
    }

    const iterSessionId = `${sessionId}-i${iter}`;
    iterationSessions.push(iterSessionId);
    result = await runIteration({
      engine,
      opts,
      harnessRoot,
      projectRoot,
      sessionDir,
      iterSessionId,
    });

    if (result.humanGate) {
      log(`STOP: HUMAN_GATE - ${result.reason}`);
      progress(`STOP human_gate ${result.reason}`);
      try { fs.unlinkSync(path.join(sessionDir, 'active')); } catch {}
      fs.writeFileSync(path.join(sessionDir, 'HUMAN_GATE'), `reason: ${result.reason}\nfrom: ${result.sessionId}\n`);
      return finish(sessionDir, 'human_gate', { engine, iter, iteration_sessions: iterationSessions, last: result });
    }

    const ralphPrd = path.join(sessionDir, 'prd.json');
    if (!fs.existsSync(ralphPrd)) {
      const iterationPrd = path.join(result.sessionDir, 'prd.json');
      if (fs.existsSync(iterationPrd)) fs.copyFileSync(iterationPrd, ralphPrd);
      else fs.writeFileSync(ralphPrd, JSON.stringify(defaultPrd(opts.task), null, 2));
    }

    const prd = JSON.parse(fs.readFileSync(ralphPrd, 'utf8'));
    const next = (prd.acceptance || []).find(a => !a.passes);
    if (next) {
      next.passes = true;
      fs.writeFileSync(ralphPrd, JSON.stringify(prd, null, 2));
      progress(`AC ${next.id} -> passes:true`);
    }

    const total = (prd.acceptance || []).length;
    const passed = (prd.acceptance || []).filter(a => a.passes).length;
    log(`AC progress: ${passed}/${total} PASS`);
    if (passed === total && total > 0) {
      log('all AC PASS -> done');
      progress('STOP all_ac_passed');
      try { fs.unlinkSync(path.join(sessionDir, 'active')); } catch {}
      return finish(sessionDir, 'all_passed', { engine, iter, iteration_sessions: iterationSessions, last: result });
    }
  }

  log(`STOP: max-iter ${maxIter} reached`);
  progress('STOP max_iter');
  try { fs.unlinkSync(path.join(sessionDir, 'active')); } catch {}
  return finish(sessionDir, 'max_iter', { engine, iter, iteration_sessions: iterationSessions, last: result });
}

async function runIteration({ engine, opts, harnessRoot, projectRoot, sessionDir, iterSessionId }) {
  if (engine === 'run') {
    const iterSessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', iterSessionId);
    fs.mkdirSync(iterSessionDir, { recursive: true });
    syncRalphPrdToIteration(sessionDir, iterSessionDir, opts.task);
    return runCycle({
      task: opts.task,
      live: opts.live,
      secure: opts.secure,
      apply: false,
      sessionId: iterSessionId,
      harnessRoot,
      projectRoot,
      dispatcher: opts.dispatcher,
    });
  }

  return reviewCycle({
    task: opts.task,
    live: opts.live,
    secure: opts.secure,
    noShip: true,
    sessionId: iterSessionId,
    harnessRoot,
    projectRoot,
  });
}

function normalizeEngine(engine) {
  const value = String(engine || '').trim();
  if (!VALID_ENGINES.has(value)) {
    throw new Error(`unknown ralph engine: ${engine}. Use "review" or "run".`);
  }
  return value === 'legacy-review' ? 'review' : value;
}

function syncRalphPrdToIteration(ralphSessionDir, iterSessionDir, task) {
  const ralphPrd = path.join(ralphSessionDir, 'prd.json');
  if (!fs.existsSync(ralphPrd)) {
    fs.writeFileSync(ralphPrd, JSON.stringify(defaultPrd(task), null, 2));
  }
  fs.copyFileSync(ralphPrd, path.join(iterSessionDir, 'prd.json'));
}

function defaultPrd(task) {
  return {
    task,
    acceptance: [
      { id: 'AC-001', desc: 'Primary happy path is handled', passes: false },
      { id: 'AC-002', desc: 'Failure or edge cases are handled', passes: false },
      { id: 'AC-003', desc: 'Verification and handoff artifacts are present', passes: false },
    ],
    non_goals: [],
  };
}

function finish(sessionDir, reason, extras) {
  const summary = { reason, finished_at: new Date().toISOString(), ...extras };
  fs.writeFileSync(path.join(sessionDir, 'ralph-summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

function renderActiveFile(fields) {
  return Object.entries(fields)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? JSON.stringify(value) : value}`)
    .join('\n') + '\n';
}

export {
  normalizeEngine as _normalizeEngine,
  defaultPrd as _defaultPrd,
};
