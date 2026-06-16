import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { buildDecision } from '@ps-neko/nekowork/scripts/lib/decision.js';
import { paint, usageStatusLine } from '../../lib/ui-format.js';

export async function runCockpitCommand({
  argv = [],
  cliPath,
  version,
  resolveProjectRoot,
  forceInteractive = false,
} = {}) {
  const opts = parseCockpitArgs(argv);
  const projectRoot = resolveProjectRoot(opts.projectRoot);
  const state = collectCockpitState({ projectRoot, version });

  if (opts.json) {
    console.log(JSON.stringify(cockpitJson(state), null, 2));
    return { exitCode: 0 };
  }

  const interactive = forceInteractive || opts.interactive || isInteractive();
  if (opts.preview || opts.noInteractive || !interactive) {
    renderCockpitPreview(state);
    return { exitCode: 0 };
  }

  return runInteractiveCockpit({ state, cliPath, projectRoot });
}

function parseCockpitArgs(argv) {
  const opts = {
    projectRoot: null,
    preview: false,
    noInteractive: false,
    interactive: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--preview') opts.preview = true;
    else if (a === '--no-interactive') opts.noInteractive = true;
    else if (a === '--interactive') opts.interactive = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw usageError('--project-root requires a value');
      opts.projectRoot = path.resolve(value);
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = path.resolve(a.slice('--project-root='.length));
    } else if (a === '--help' || a === '-h') {
      opts.preview = true;
    } else if (a.startsWith('--')) {
      throw usageError(`unknown cockpit option: ${a}`);
    }
  }

  return opts;
}

function usageError(message) {
  const e = new Error(message);
  e.cliUsage = true;
  return e;
}

function isInteractive() {
  if (process.env.CI) return false;
  if (process.env.NEKOWORK_NO_INTERACTIVE === '1') return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function collectCockpitState({ projectRoot, version }) {
  const sessions = listSessions(projectRoot);
  const latest = sessions[0] || null;
  const latestDecision = latest ? readDecisionForSession(latest.dir) : null;
  const git = gitState(projectRoot);
  const provider = process.env.HARNESS_PROVIDER_OVERRIDE || process.env.NEKOWORK_PROVIDER || 'mock';
  const usage = collectUsageStatus(process.env);

  return {
    version,
    projectRoot,
    installed: fs.existsSync(path.join(projectRoot, '.harness')),
    provider,
    usage,
    git,
    sessions,
    latest: latest ? {
      id: latest.id,
      age: relativeAge(latest.mtimeMs),
      decision: latestDecision,
    } : null,
    safeDefaults: [
      'No auto-apply',
      'No auto-commit',
      'No auto-push',
      'No deploy or publish',
      'One executor writes',
      'Codex verifies before apply',
    ],
  };
}

function listSessions(projectRoot) {
  const root = path.join(projectRoot, '.harness', 'state', 'sessions');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const dir = path.join(root, entry.name);
      return {
        id: entry.name,
        dir,
        mtimeMs: fs.statSync(dir).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.id.localeCompare(a.id));
}

function readDecisionForSession(sessionDir) {
  const file = path.join(sessionDir, 'decision.json');
  if (fs.existsSync(file)) return readJson(file);
  try {
    return buildDecision(sessionDir, { sessionId: path.basename(sessionDir), stage: 'cockpit' });
  } catch {
    return null;
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function gitState(projectRoot) {
  const r = spawnSync('git', ['-C', projectRoot, 'status', '--porcelain'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0) return { state: 'unknown', detail: 'not a git repository or git unavailable' };
  const lines = r.stdout.split(/\r?\n/).filter(Boolean);
  return {
    state: lines.length ? 'dirty' : 'clean',
    detail: lines.length ? `${lines.length} changed paths` : 'working tree clean',
  };
}

function collectUsageStatus(env) {
  const model = env.NEKOWORK_USAGE_MODEL || env.HARNESS_USAGE_MODEL;
  const sessionRemaining = env.NEKOWORK_SESSION_REMAINING_PERCENT || env.NEKOWORK_USAGE_SESSION_REMAINING_PERCENT;
  const weeklyRemaining = env.NEKOWORK_WEEKLY_REMAINING_PERCENT || env.NEKOWORK_USAGE_WEEKLY_REMAINING_PERCENT;

  if (!model && !sessionRemaining && !weeklyRemaining) return null;

  const usage = {
    model: model || 'unknown',
    session: sessionRemaining ? {
      windowHours: env.NEKOWORK_SESSION_WINDOW_HOURS || env.NEKOWORK_USAGE_SESSION_WINDOW_HOURS,
      remainingPercent: sessionRemaining,
      resetLabel: env.NEKOWORK_SESSION_RESET_LABEL || env.NEKOWORK_SESSION_RESET || env.NEKOWORK_USAGE_SESSION_RESET,
    } : null,
    weekly: weeklyRemaining ? {
      remainingPercent: weeklyRemaining,
      resetLabel: env.NEKOWORK_WEEKLY_RESET_LABEL || env.NEKOWORK_WEEKLY_RESET || env.NEKOWORK_USAGE_WEEKLY_RESET,
    } : null,
  };

  return { ...usage, line: usageStatusLine(usage) };
}

function cockpitJson(state) {
  return {
    version: state.version,
    projectRoot: state.projectRoot,
    installed: state.installed,
    provider: state.provider,
    usage: state.usage,
    git: state.git,
    latest: state.latest ? {
      id: state.latest.id,
      age: state.latest.age,
      status: state.latest.decision?.status || 'unknown',
      verdict: state.latest.decision?.verdict || null,
      applyAllowed: Boolean(state.latest.decision?.apply_allowed),
      humanGate: state.latest.decision?.human_gate || 'unknown',
      next: state.latest.decision?.next || null,
    } : null,
    choices: starterChoices().map(choice => choice.label),
    safeDefaults: state.safeDefaults,
  };
}

export function renderCockpitPreview(state) {
  const overview = [
    `Version : ${state.version}`,
    `Project : ${state.projectRoot}`,
    `Git     : ${state.git.state} (${state.git.detail})`,
    `Provider: ${state.provider}`,
    `Install : ${state.installed ? 'installed' : 'not installed'}`,
    `Sessions: ${state.sessions.length}`,
  ];
  if (state.usage) overview.push(`Usage  : ${state.usage.line}`);

  console.log('');
  console.log(box('NEKOWORK Cockpit', overview));
  console.log('');

  if (state.latest) {
    const d = state.latest.decision || {};
    console.log(box('Latest Session', [
      `Session       : ${state.latest.id}`,
      `Updated       : ${state.latest.age}`,
      `Status        : ${d.status || 'unknown'}`,
      `Verdict       : ${d.verdict || 'n/a'}`,
      `Human Gate    : ${d.human_gate || 'unknown'}`,
      `Apply allowed : ${d.apply_allowed ? 'yes' : 'no'}`,
      `Next          : ${d.next || 'inspect report or start a new task'}`,
    ]));
    console.log('');
  }

  console.log(paint('hint', 'Recommended next action'));
  const recommended = recommendAction(state);
  for (const choice of starterChoices()) {
    const marker = choice.id === recommended ? '>' : ' ';
    console.log(`  ${marker} ${choice.label.padEnd(27)} ${paint('dim', choice.note)}`);
  }
  console.log('');

  console.log(box('Safety Defaults Active', state.safeDefaults.map(item => `OK ${item}`)));
  console.log('');
  console.log(paint('dim', 'Run in a TTY for guided choices, or use direct commands: nekowork start "task" / report / apply.'));
  console.log('');
}

async function runInteractiveCockpit({ state, cliPath, projectRoot }) {
  renderCockpitPreview(state);

  const rl = createInterface({ input, output });
  try {
    const action = await choose(rl, 'Choose next action', starterChoices(), recommendAction(state));
    if (!action || action.id === 'exit') return { exitCode: 0 };
    if (action.id === 'start') return runStartFlow(rl, { cliPath, projectRoot });
    if (action.id === 'review') return runReviewFlow(rl, { cliPath, projectRoot });
    if (action.id === 'pr-prep') return runSessionCommandFlow(rl, {
      cliPath,
      projectRoot,
      verb: 'pr-prep',
      title: 'Prepare PR evidence',
      defaultSession: state.latest?.id || 'latest',
    });
    if (action.id === 'report') return runSessionCommandFlow(rl, {
      cliPath,
      projectRoot,
      verb: 'report',
      title: 'View report',
      defaultSession: state.latest?.id || 'latest',
    });
    if (action.id === 'apply') return runApplyFlow(rl, {
      cliPath,
      projectRoot,
      defaultSession: state.latest?.id || 'latest',
    });
    if (action.id === 'settings') {
      renderSettings();
      return { exitCode: 0 };
    }
    return { exitCode: 0 };
  } finally {
    rl.close();
  }
}

function starterChoices() {
  return [
    { id: 'start', label: 'Start safe AI work', note: 'route, build, verify, stop before apply' },
    { id: 'review', label: 'Review current changes', note: 'risk scan and evidence path for this tree' },
    { id: 'pr-prep', label: 'Prepare PR evidence', note: 'local PR artifacts; no branch or push' },
    { id: 'report', label: 'View latest report', note: 'inspect evidence before acting' },
    { id: 'apply', label: 'Apply verified diff', note: 'explicit boundary; asks again' },
    { id: 'settings', label: 'Settings / command list', note: 'provider, safety defaults, help' },
    { id: 'exit', label: 'Exit', note: 'leave without changes' },
  ];
}

function recommendAction(state) {
  const d = state.latest?.decision;
  if (!d) return 'start';
  if (d.apply_allowed) return 'apply';
  if (d.human_gate === 'required' || d.status === 'human_gate') return 'report';
  if (d.status === 'no_ship' || d.no_ship) return 'report';
  if (d.status === 'ship_ready') return 'report';
  return 'start';
}

async function runStartFlow(rl, { cliPath, projectRoot }) {
  const task = await askText(rl, 'Task', '');
  if (!task) return { exitCode: 0 };
  const mode = await choose(rl, 'How should NEKOWORK run it?', [
    { id: 'recommended', label: 'Use recommended auto mode', note: 'let Build Intelligence choose' },
    { id: 'dry-run', label: 'Dry-run only', note: 'show routing without writing a session' },
    { id: 'auto', label: 'Bounded auto with repair budget', note: 'repair fixable findings, stop before apply' },
    { id: 'cancel', label: 'Cancel', note: 'do nothing' },
  ], 'recommended');
  if (!mode || mode.id === 'cancel') return { exitCode: 0 };
  if (mode.id === 'auto') return spawnCli(cliPath, ['auto', task, '--explain', '--project-root', projectRoot]);
  const args = ['start', task, '--explain', '--project-root', projectRoot];
  if (mode.id === 'dry-run') args.splice(2, 0, '--dry-run');
  return spawnCli(cliPath, args);
}

async function runReviewFlow(rl, { cliPath, projectRoot }) {
  const task = await askText(rl, 'Review task', 'review current working tree changes before apply');
  if (!task) return { exitCode: 0 };
  return spawnCli(cliPath, ['start', task, '--dry-run', '--explain', '--project-root', projectRoot]);
}

async function runSessionCommandFlow(rl, { cliPath, projectRoot, verb, title, defaultSession }) {
  const session = await askText(rl, `${title} session`, defaultSession);
  if (!session) return { exitCode: 0 };
  return spawnCli(cliPath, [verb, '--session', session, '--project-root', projectRoot]);
}

async function runApplyFlow(rl, { cliPath, projectRoot, defaultSession }) {
  const session = await askText(rl, 'Apply session', defaultSession);
  if (!session) return { exitCode: 0 };
  console.log('');
  console.log(box('Apply Boundary', [
    `Session: ${session}`,
    'NEKOWORK will apply only a verified SHIP_READY live-work diff.',
    'It will not commit, push, deploy, publish, or open a PR.',
  ]));
  console.log('');
  const confirm = await askText(rl, 'Type "apply" to continue', '');
  if (confirm !== 'apply') {
    console.log('Cancelled. No files changed.');
    return { exitCode: 0 };
  }
  return spawnCli(cliPath, ['apply', '--session', session, '--project-root', projectRoot]);
}

function renderSettings() {
  console.log('');
  console.log(box('Command Surfaces', [
    'Guided:   nekowork',
    'Start:    nekowork start "task"',
    'Auto:     nekowork auto "task"',
    'Report:   nekowork report --session latest',
    'Apply:    nekowork apply --session <id>',
    'All help: nekowork help all',
  ]));
  console.log('');
}

async function choose(rl, title, choices, defaultId) {
  console.log('');
  console.log(title);
  choices.forEach((choice, index) => {
    const marker = choice.id === defaultId ? '>' : ' ';
    console.log(`  ${marker} ${index + 1}. ${choice.label} ${paint('dim', choice.note ? `- ${choice.note}` : '')}`);
  });
  const answer = await askText(rl, `Select [${indexOfChoice(choices, defaultId) + 1}]`, '');
  const index = answer ? Number(answer) - 1 : indexOfChoice(choices, defaultId);
  return choices[index] || choices[indexOfChoice(choices, defaultId)] || null;
}

function indexOfChoice(choices, id) {
  const index = choices.findIndex(choice => choice.id === id);
  return index >= 0 ? index : 0;
}

async function askText(rl, label, fallback) {
  const suffix = fallback ? ` [${fallback}]` : '';
  const answer = await rl.question(`${label}${suffix}: `);
  const value = answer.trim();
  return value || fallback;
}

function spawnCli(cliPath, args) {
  const r = spawnSync(process.execPath, [cliPath, ...args], {
    stdio: 'inherit',
    windowsHide: true,
  });
  return { exitCode: r.status ?? 1 };
}

function box(title, bodyLines) {
  const body = bodyLines.map(line => String(line));
  const width = Math.max(title.length + 4, ...body.map(line => line.length), 58);
  const top = `+-- ${title} ${'-'.repeat(Math.max(0, width - title.length - 5))}+`;
  const bottom = `+${'-'.repeat(width)}+`;
  const lines = [top];
  for (const line of body) {
    lines.push(`| ${line.padEnd(width - 2)} |`);
  }
  lines.push(bottom);
  return lines.join('\n');
}

function relativeAge(ms) {
  const delta = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
