import path from 'node:path';
import { buildCycle } from '../../orchestrators/build.js';
import { buildDecision } from '@ps-neko/nekowork/scripts/lib/decision.js';

export function parseBuildArgs(argv, usageError) {
  const opts = {
    task: '',
    mode: 'auto',
    sessionId: null,
    projectRoot: null,
    profile: null,
    live: false,
    secure: false,
    strictQuality: false,
    team: false,
    workers: null,
    apply: false,
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
    else if (a === '--mode') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--mode requires a value');
      opts.mode = value;
    } else if (a.startsWith('--mode=')) {
      opts.mode = a.slice('--mode='.length);
    } else if (a === '--profile') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--profile requires a value');
      opts.profile = value;
    } else if (a.startsWith('--profile=')) {
      opts.profile = a.slice('--profile='.length);
    } else if (a === '--workers') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--workers requires a value');
      opts.workers = value;
    } else if (a.startsWith('--workers=')) {
      opts.workers = a.slice('--workers='.length);
    } else if (a === '--apply') opts.apply = true;
    else if (a === '--allow-dirty') opts.allowDirty = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--session') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--session requires a value');
      opts.sessionId = value;
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = path.resolve(value);
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = path.resolve(a.slice('--project-root='.length));
    } else if (a.startsWith('--')) {
      unknown.push(a);
    } else if (!opts.task) {
      opts.task = a;
    } else {
      opts.task += ' ' + a;
    }
  }
  if (unknown.length) throw usageError(`unknown flag: ${unknown.join(', ')}`);
  return opts;
}

export async function runBuildCommand({ argv, harnessRoot, resolveProjectRoot, usageError }) {
  const opts = parseBuildArgs(argv, usageError);
  if (!opts.task) {
    console.error('task is required. Example: nekowork build "implement and verify dashboard"');
    return { exitCode: 2 };
  }

  let result;
  try {
    result = await buildCycle({
      ...opts,
      harnessRoot,
      projectRoot: resolveProjectRoot(opts.projectRoot),
    });
  } catch (e) {
    if (/^(build requires|unknown build mode|run requires|verify requires|ship requires|apply requires|team worker|git apply failed|task appears)/.test(e?.message || '')) {
      throw usageError(e.message);
    }
    throw e;
  }

  if (opts.json) {
    console.log(JSON.stringify(buildJsonOutput(result), null, 2));
  } else if (result.dryRun) {
    printBuildPlan(result);
  } else {
    printBuildResult(result, opts);
  }

  if (!result.dryRun && (result.humanGate || (opts.apply && (result.noShip || result.run?.applySkippedReason)))) {
    return { exitCode: 3 };
  }
  return { exitCode: 0 };
}

function buildJsonOutput(result) {
  if (result.dryRun) {
    return {
      dryRun: true,
      sessionId: result.sessionId,
      task: result.task,
      mode: result.mode,
      requestedMode: result.requestedMode,
      autoMode: result.autoMode,
      modeDescription: result.modeDescription,
      intelligence: result.intelligence,
      modeOverride: result.modeOverride,
      profile: result.profile,
      strictQuality: result.strictQuality,
      secure: result.secure,
      live: result.live,
      applyRequested: result.applyRequested,
      teamRun: result.teamRun,
      teamWorkers: result.teamWorkers,
      stages: result.stages,
      safetyInvariants: result.safetyInvariants,
      nextStep: result.nextStep,
    };
  }

  return {
    sessionId: result.sessionId,
    mode: result.mode,
    requestedMode: result.requestedMode,
    autoMode: result.autoMode,
    intelligence: result.intelligence,
    modeOverride: result.modeOverride,
    profile: result.profile,
    strictQuality: result.strictQuality,
    secure: result.secure,
    teamRun: Boolean(result.team),
    stoppedAt: result.run?.stoppedAt,
    verdict: result.verdict,
    humanGate: result.humanGate,
    noShip: result.noShip,
    shipReady: result.shipReady,
    applied: result.applied,
    decision: safeDecision(result.sessionDir),
  };
}

function printBuildPlan(result) {
  console.log('=== build dry-run ===');
  console.log('  session    : ' + result.sessionId);
  console.log('  mode       : ' + (result.autoMode ? `${result.mode} (auto)` : result.mode));
  console.log('  profile    : ' + (result.profile || 'none'));
  console.log('  strict     : ' + (result.strictQuality ? 'yes' : 'no'));
  console.log('  secure     : ' + (result.secure ? 'yes' : 'no'));
  console.log('  live       : ' + (result.live ? 'yes' : 'no'));
  console.log('  apply      : ' + (result.applyRequested ? 'requested, still gated' : 'not requested'));
  if (result.intelligence) {
    console.log('  task type  : ' + result.intelligence.taskType);
    console.log('  risk       : ' + result.intelligence.risk + (result.intelligence.tags.length ? ` (${result.intelligence.tags.join(',')})` : ''));
  }
  if (result.modeOverride?.forced) {
    console.log('  override   : forced despite recommendation ' + result.modeOverride.recommendedMode);
  }
  console.log('');
  console.log('Stages:');
  for (const stage of result.stages) {
    const status = stage.runs ? 'run' : 'skip';
    const details = stage.workers?.length
      ? ` (${stage.workers.join(',')})`
      : stage.challenge
        ? ' (with challenge)'
        : '';
    console.log(`  - ${stage.stage}: ${status}${details}`);
  }
  console.log('');
  if (result.intelligence) {
    printBuildExplanation(result.intelligence);
    console.log('');
  } else if (result.modeOverride?.forced) {
    printBuildOverrideExplanation(result.modeOverride);
    console.log('');
  }
  console.log('Safety:');
  for (const invariant of result.safetyInvariants) {
    console.log('  - ' + invariant);
  }
  console.log('');
  console.log('Next: ' + result.nextStep);
}

function printBuildResult(result, opts) {
  const decision = safeDecision(result.sessionDir);
  if (decision) {
    const runtime = decision.runtime || { mode: 'mock', providers: [] };
    const liveProviders = (runtime.providers || []).filter(provider => provider && provider !== 'mock');
    let runtimeLabel = runtime.mode || 'mock';
    if (runtime.mode === 'live' && liveProviders.length) runtimeLabel = `live (${liveProviders.join(', ')})`;
    else if (runtime.mode === 'mixed' && liveProviders.length) runtimeLabel = `mixed (mock + ${liveProviders.join(', ')})`;
    console.log('Verdict: ' + String(decision.verdict || 'unknown').toUpperCase());
    console.log('Reason: ' + (decision.reason || 'none'));
    console.log('Provider Mode: ' + runtimeLabel);
    console.log('Human Gate: ' + decision.human_gate);
    console.log('Ship ready: ' + String(decision.ship_ready));
    console.log('Apply allowed: ' + String(decision.apply_allowed));
    console.log('');
  }
  console.log('=== build ===');
  console.log('  session    : ' + result.sessionId);
  console.log('  mode       : ' + (result.autoMode ? `${result.mode} (auto)` : result.mode));
  if (result.intelligence) {
    console.log('  task type  : ' + result.intelligence.taskType);
    console.log('  risk       : ' + result.intelligence.risk + (result.intelligence.tags.length ? ` (${result.intelligence.tags.join(',')})` : ''));
  }
  if (result.modeOverride?.forced) {
    console.log('  override   : forced despite recommendation ' + result.modeOverride.recommendedMode);
  }
  console.log('  profile    : ' + (result.profile || 'none'));
  console.log('  team       : ' + (result.team ? `read-only (${result.team.workers.join(',')})` : 'off'));
  console.log('  stopped at : ' + result.run?.stoppedAt);
  console.log('  verdict    : ' + result.verdict);
  console.log('  human gate : ' + (result.humanGate ? 'YES' : 'no'));
  console.log('  no ship    : ' + (result.noShip ? 'YES' : 'no'));
  console.log('  ship ready : ' + (result.shipReady ? 'yes' : 'no'));
  console.log('  apply      : ' + (result.applied ? 'applied' : result.run?.applyRequested ? `skipped (${result.run.applySkippedReason || 'not needed'})` : 'not requested'));
  if (opts.explain && (result.intelligence || result.modeOverride?.forced)) {
    console.log('');
    if (result.intelligence) printBuildExplanation(result.intelligence);
    else printBuildOverrideExplanation(result.modeOverride);
    console.log('');
    printBuildEvidence(result);
  }
}

function safeDecision(sessionDir) {
  try {
    return sessionDir ? buildDecision(sessionDir, { stage: 'build-output' }) : null;
  } catch {
    return null;
  }
}

function printBuildExplanation(intelligence) {
  console.log('Why:');
  const explanation = intelligence.explanation?.length ? intelligence.explanation : intelligence.reasons;
  for (const [index, line] of explanation.entries()) {
    if (index === 0 && line.endsWith(':')) console.log('  ' + line);
    else console.log(line.startsWith('- ') ? '  ' + line : '  - ' + line);
  }
}

function printBuildOverrideExplanation(modeOverride) {
  console.log('Override:');
  console.log('  ' + modeOverride.reason);
  for (const [index, line] of (modeOverride.explanation || []).entries()) {
    if (index === 0 && line.endsWith(':')) console.log('  ' + line);
    else console.log(line.startsWith('- ') ? '  ' + line : '  - ' + line);
  }
}

function printBuildEvidence(result) {
  console.log('Evidence written:');
  const files = [];
  if (result.intelligence) {
    files.push('build-intelligence.json', 'acceptance-criteria.json', 'build-plan.json');
  }
  files.push('build-summary.json', 'run-summary.json', 'work-summary.json', 'verify-summary.json');
  if (result.run?.ship) files.push('ship-summary.json');
  for (const file of [...new Set(files)]) console.log('  - ' + file);
}
