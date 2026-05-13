import path from 'node:path';
import { autoCycle } from '../../orchestrators/auto.js';

export function parseAutoArgs(argv, usageError) {
  const opts = {
    task: '',
    level: 'normal',
    budget: null,
    maxRounds: null,
    maxFilesChanged: null,
    maxDiffLines: null,
    parallelCandidates: null,
    mode: 'auto',
    sessionId: null,
    projectRoot: null,
    profile: null,
    live: false,
    secure: false,
    strictQuality: false,
    team: false,
    workers: null,
    allowDirty: false,
    force: false,
    forceMode: false,
    explain: false,
    dryRun: false,
    json: false,
  };
  const unknown = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--live') opts.live = true;
    else if (a === '--secure') opts.secure = true;
    else if (a === '--strict-quality') opts.strictQuality = true;
    else if (a === '--team') opts.team = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--force-mode') opts.forceMode = true;
    else if (a === '--explain') opts.explain = true;
    else if (a === '--allow-dirty') opts.allowDirty = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--apply') throw usageError('auto never accepts --apply; run apply explicitly after verified ship-ready evidence');
    else if (a === '--level') opts.level = takeValue(argv, ++i, '--level', usageError);
    else if (a.startsWith('--level=')) opts.level = a.slice('--level='.length);
    else if (a === '--budget') opts.budget = takeValue(argv, ++i, '--budget', usageError);
    else if (a.startsWith('--budget=')) opts.budget = a.slice('--budget='.length);
    else if (a === '--max-rounds') opts.maxRounds = takeValue(argv, ++i, '--max-rounds', usageError);
    else if (a.startsWith('--max-rounds=')) opts.maxRounds = a.slice('--max-rounds='.length);
    else if (a === '--max-files') opts.maxFilesChanged = takeValue(argv, ++i, '--max-files', usageError);
    else if (a.startsWith('--max-files=')) opts.maxFilesChanged = a.slice('--max-files='.length);
    else if (a === '--max-diff-lines') opts.maxDiffLines = takeValue(argv, ++i, '--max-diff-lines', usageError);
    else if (a.startsWith('--max-diff-lines=')) opts.maxDiffLines = a.slice('--max-diff-lines='.length);
    else if (a === '--parallel-candidates') opts.parallelCandidates = takeValue(argv, ++i, '--parallel-candidates', usageError);
    else if (a.startsWith('--parallel-candidates=')) opts.parallelCandidates = a.slice('--parallel-candidates='.length);
    else if (a === '--mode') opts.mode = takeValue(argv, ++i, '--mode', usageError);
    else if (a.startsWith('--mode=')) opts.mode = a.slice('--mode='.length);
    else if (a === '--profile') opts.profile = takeValue(argv, ++i, '--profile', usageError);
    else if (a.startsWith('--profile=')) opts.profile = a.slice('--profile='.length);
    else if (a === '--workers') opts.workers = takeValue(argv, ++i, '--workers', usageError);
    else if (a.startsWith('--workers=')) opts.workers = a.slice('--workers='.length);
    else if (a === '--session') opts.sessionId = takeValue(argv, ++i, '--session', usageError);
    else if (a.startsWith('--session=')) opts.sessionId = a.slice('--session='.length);
    else if (a === '--project-root') opts.projectRoot = path.resolve(takeValue(argv, ++i, '--project-root', usageError));
    else if (a.startsWith('--project-root=')) opts.projectRoot = path.resolve(a.slice('--project-root='.length));
    else if (a.startsWith('--')) unknown.push(a);
    else if (!opts.task) opts.task = a;
    else opts.task += ' ' + a;
  }

  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  return opts;
}

export async function runAutoCommand({ argv, harnessRoot, resolveProjectRoot, usageError }) {
  const opts = parseAutoArgs(argv, usageError);
  if (!opts.task) {
    console.error('task is required. Example: nekowork auto "fix failing tests safely"');
    return { exitCode: 2 };
  }

  let result;
  try {
    result = await autoCycle({
      ...opts,
      harnessRoot,
      projectRoot: resolveProjectRoot(opts.projectRoot),
    });
  } catch (e) {
    if (/^(auto requires|unknown autonomy level|unknown build mode|build requires|run requires|verify requires|ship requires|team worker|task appears|--parallel-candidates requires|parallel candidates require)/.test(e?.message || '')) {
      throw usageError(e.message);
    }
    throw e;
  }

  if (opts.json) {
    console.log(JSON.stringify(autoJsonOutput(result), null, 2));
  } else if (result.dryRun) {
    printAutoPlan(result);
  } else {
    printAutoResult(result, opts);
  }

  if (!result.dryRun && result.humanGate) return { exitCode: 3 };
  return { exitCode: 0 };
}

function takeValue(argv, index, flag, usageError) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw usageError(`${flag} requires a value`);
  return value;
}

function autoJsonOutput(result) {
  if (result.dryRun) {
    return {
      dryRun: true,
      sessionId: result.sessionId,
      task: result.task,
      level: result.level,
      policy: result.policy,
      mode: result.mode,
      requestedMode: result.requestedMode,
      build: result.build,
      parallelCandidates: result.parallelCandidates,
      stages: result.stages,
      applyRequested: false,
      safetyInvariants: result.safetyInvariants,
      nextStep: result.nextStep,
    };
  }

  return {
    sessionId: result.sessionId,
    level: result.level,
    policy: result.policy,
    mode: result.mode,
    requestedMode: result.requestedMode,
    rounds: result.rounds,
    parallelCandidates: result.parallelCandidates,
    stopReason: result.stopReason,
    reportPath: result.report?.reportPath,
    humanGate: result.humanGate,
    noShip: result.noShip,
    shipReady: result.shipReady,
    applied: false,
    nextStep: result.nextStep,
  };
}

function printAutoPlan(result) {
  console.log('=== auto dry-run ===');
  console.log('  session    : ' + result.sessionId);
  console.log('  level      : ' + result.level);
  console.log('  budget     : ' + result.policy.maxRounds + ' round(s)');
  console.log('  mode       : ' + result.mode);
  if (result.parallelCandidates?.enabled) {
    console.log('  candidates : ' + result.parallelCandidates.count + ' isolated evidence candidate(s)');
  }
  console.log('  apply      : never automatic');
  console.log('');
  console.log('Stages:');
  for (const stage of result.stages) {
    const status = stage.runs ? 'run' : 'skip';
    const detail = stage.budget ? ` (budget ${stage.budget})` : '';
    console.log(`  - ${stage.stage}: ${status}${detail}`);
  }
  console.log('');
  printSafety(result.safetyInvariants);
  console.log('');
  console.log('Next: ' + result.nextStep);
}

function printAutoResult(result, opts) {
  console.log('=== auto ===');
  console.log('  session    : ' + result.sessionId);
  console.log('  level      : ' + result.level);
  console.log('  mode       : ' + (result.mode || 'n/a'));
  console.log('  rounds     : ' + result.rounds.length + '/' + result.policy.maxRounds);
  console.log('  stop       : ' + result.stopReason);
  if (result.parallelCandidates) {
    console.log('  candidates : ' + result.parallelCandidates.count + ' captured; canonical diff not selected in preview');
  }
  console.log('  human gate : ' + (result.humanGate ? 'YES' : 'no'));
  console.log('  no ship    : ' + (result.noShip ? 'YES' : 'no'));
  console.log('  ship ready : ' + (result.shipReady ? 'yes' : 'no'));
  console.log('  apply      : not requested');
  console.log('  report     : ' + result.report?.reportPath);
  if (opts.explain) {
    console.log('');
    printRounds(result.rounds);
    console.log('');
    printSafety(result.safetyInvariants);
  }
  console.log('');
  console.log('Next: ' + result.nextStep);
}

function printRounds(rounds) {
  console.log('Rounds:');
  for (const round of rounds) {
    console.log(`  - ${round.round}: verdict=${round.verdict}, ship_ready=${round.ship_ready}, no_ship=${round.no_ship}, human_gate=${round.human_gate}`);
  }
}

function printSafety(invariants) {
  console.log('Safety:');
  for (const invariant of invariants) console.log('  - ' + invariant);
}
