#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveProviderCli } from './core/cli-resolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');

const BLOCKED_ENV = {
  claude: ['ANTHROPIC_API_KEY'],
  codex: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
};

const STATUS_RANK = { PASS: 0, WARN: 1, FAIL: 2 };

export function parseDoctorArgs(argv = []) {
  const opts = {
    json: false,
    geminiSmoke: false,
    projectRoot: null,
    quick: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') opts.json = true;
    else if (arg === '--gemini-smoke') opts.geminiSmoke = true;
    else if (arg === '--quick') opts.quick = true;
    else if (arg === '--project-root') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error('--project-root requires a value');
      opts.projectRoot = value;
    } else if (arg.startsWith('--project-root=')) {
      opts.projectRoot = arg.slice('--project-root='.length);
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else {
      throw new Error(`unknown doctor option: ${arg}`);
    }
  }

  return opts;
}

export function buildDoctorReport(options = {}) {
  const harnessRoot = path.resolve(options.harnessRoot || DEFAULT_ROOT);
  const projectRoot = path.resolve(options.projectRoot || process.env.HARNESS_PROJECT_ROOT || process.cwd());
  const env = options.env || process.env;
  const runCommand = options.runCommand || defaultRunCommand;
  const nodeVersion = options.nodeVersion || process.versions.node;
  const quick = Boolean(options.quick);
  const geminiSmoke = Boolean(options.geminiSmoke);

  const checks = [];

  checks.push(checkNodeVersion(nodeVersion));
  checks.push(checkPackageMetadata(harnessRoot));
  checks.push(checkGitWorktree(projectRoot, runCommand));
  checks.push(checkApiKeyEnvironment(env));

  checks.push(...checkProviderClis({ harnessRoot, projectRoot, env, runCommand, geminiSmoke }));

  if (geminiSmoke) {
    checks.push(checkCommand('gemini live smoke', 'node scripts/verify/gemini-live.js', runCommand, harnessRoot, [
      process.execPath,
      ['scripts/verify/gemini-live.js'],
    ]));
  }

  if (!quick) {
    checks.push(checkCommand('repair freshness', 'node scripts/repair.js --check', runCommand, harnessRoot, [
      process.execPath,
      ['scripts/repair.js', '--check'],
    ]));
    checks.push(checkCommand('CLAUDE.md sync', 'node scripts/sync-claude-md.js --check', runCommand, harnessRoot, [
      process.execPath,
      ['scripts/sync-claude-md.js', '--check'],
    ]));
    checks.push(checkCommand('codemaps freshness', 'node scripts/build-codemaps.js --check', runCommand, harnessRoot, [
      process.execPath,
      ['scripts/build-codemaps.js', '--check'],
    ]));
  }

  const summary = summarize(checks);
  return {
    name: 'NEKOWORK doctor',
    harnessRoot,
    projectRoot,
    quick,
    geminiSmoke,
    summary,
    checks,
  };
}

export function renderDoctorReport(report) {
  const lines = [];
  lines.push('NEKOWORK doctor');
  lines.push(`harness root : ${report.harnessRoot}`);
  lines.push(`project root : ${report.projectRoot}`);
  lines.push('');
  lines.push(`${pad('STATUS', 6)}  ${pad('CHECK', 22)}  MESSAGE`);
  lines.push(`${'-'.repeat(6)}  ${'-'.repeat(22)}  ${'-'.repeat(50)}`);
  for (const check of report.checks) {
    lines.push(`${pad(check.status, 6)}  ${pad(check.name, 22)}  ${check.message}`);
  }
  lines.push('');
  lines.push(`summary: ${report.summary.status} (${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail)`);
  return lines.join('\n');
}

function checkNodeVersion(version) {
  const major = Number(String(version).split('.')[0]);
  if (major >= 22) return pass('node', `Node ${version}`);
  return fail('node', `Node ${version}; required >= 22`);
}

function checkPackageMetadata(root) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (pkg.name !== '@ps-neko/nekowork') {
      return fail('package metadata', `unexpected package name: ${pkg.name}`);
    }
    if (!pkg.version) return fail('package metadata', 'missing package version');
    if (pkg.private === true) {
      return pass('package metadata', `${pkg.name}@${pkg.version}; private publish disabled`);
    }
    if (pkg.private === false && isPublicAlphaVersion(pkg.version)) {
      return pass('package metadata', `${pkg.name}@${pkg.version}; public alpha package`);
    }
    return warn('package metadata', `${pkg.name}@${pkg.version}; publish guard is not explicit`);
  } catch (error) {
    return fail('package metadata', `cannot read package.json: ${error.message}`);
  }
}

function isPublicAlphaVersion(version) {
  return /^\d+\.\d+\.\d+-alpha\.\d+$/.test(String(version));
}

function checkGitWorktree(projectRoot, runCommand) {
  const result = runCommand('git', ['rev-parse', '--is-inside-work-tree'], { cwd: projectRoot, timeoutMs: 5000 });
  if (result.status === 0 && result.stdout.trim() === 'true') {
    return pass('git worktree', 'project root is inside a git worktree');
  }
  return warn('git worktree', 'project root is not a git worktree; reviews still run, but git-aware guards are limited');
}

function checkApiKeyEnvironment(env) {
  const found = [];
  for (const keys of Object.values(BLOCKED_ENV)) {
    for (const key of keys) if (env[key]) found.push(key);
  }
  if (!found.length) return pass('api key env', 'no delegated-provider API key overrides detected');
  if (env.HARNESS_AUTH_ALLOW_ENV_OVERRIDE === '1') {
    return warn('api key env', `explicit metered opt-in is enabled for: ${found.join(', ')}`);
  }
  return warn('api key env', `will be blocked before delegated CLI calls: ${found.join(', ')}`);
}

function checkProviderClis({ harnessRoot, projectRoot, env, runCommand, geminiSmoke }) {
  return [
    checkProviderCli('claude', ['auth', 'status'], { harnessRoot, projectRoot, env, runCommand }),
    checkProviderCli('codex', ['login', 'status'], { harnessRoot, projectRoot, env, runCommand }),
    checkProviderCli('gemini', null, { harnessRoot, projectRoot, env, runCommand, geminiSmoke }),
  ];
}

function checkProviderCli(provider, authArgs, { harnessRoot, projectRoot, env, runCommand, geminiSmoke }) {
  let resolved;
  try {
    resolved = resolveProviderCli(provider, {
      root: projectRoot,
      roots: [projectRoot, harnessRoot],
      env,
    });
  } catch (error) {
    return fail(`${provider} cli`, error.message.split('\n')[0]);
  }

  if (!resolved) return warn(`${provider} cli`, `${provider} CLI not found on PATH; mock mode still works`);

  if (!authArgs) {
    if (provider === 'gemini' && geminiSmoke) {
      return pass(`${provider} cli`, `${resolved}; installed; live smoke requested`);
    }
    return warn(`${provider} cli`, `${resolved}; installed; auth status is not checked non-interactively; run --gemini-smoke or npm run verify:gemini`);
  }

  const auth = runCommand(resolved, authArgs, { cwd: projectRoot, timeoutMs: 10000 });
  if (auth.status === 0) return pass(`${provider} cli`, `${resolved}; auth status OK`);

  const detail = firstNonEmptyLine(auth.stderr) || firstNonEmptyLine(auth.stdout) || `exit ${auth.status}`;
  return warn(`${provider} cli`, `${resolved}; auth status not ready (${detail})`);
}

function checkCommand(name, label, runCommand, cwd, command) {
  const [bin, args] = command;
  const result = runCommand(bin, args, { cwd, timeoutMs: 30000 });
  if (result.status === 0) return pass(name, `${label} passed`);
  const detail = firstNonEmptyLine(result.stderr) || firstNonEmptyLine(result.stdout) || `exit ${result.status}`;
  return fail(name, `${label} failed: ${detail}`);
}

function summarize(checks) {
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const check of checks) counts[check.status.toLowerCase()]++;
  const status = counts.fail ? 'FAIL' : (counts.warn ? 'WARN' : 'PASS');
  return { status, ...counts };
}

function pass(name, message) {
  return { status: 'PASS', name, message };
}

function warn(name, message) {
  return { status: 'WARN', name, message };
}

function fail(name, message) {
  return { status: 'FAIL', name, message };
}

function pad(value, width) {
  return String(value).padEnd(width);
}

function firstNonEmptyLine(value = '') {
  return String(value).split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function defaultRunCommand(command, args, options = {}) {
  const invocation = normalizeSpawnInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd,
    env: { ...process.env, FORCE_COLOR: '0' },
    encoding: 'utf8',
    timeout: options.timeoutMs || 10000,
  });
  return {
    status: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout || '',
    stderr: result.stderr || (result.error ? result.error.message : ''),
  };
}

function normalizeSpawnInvocation(command, args) {
  const ext = path.extname(command).toLowerCase();
  if (process.platform === 'win32' && (ext === '.cmd' || ext === '.bat')) {
    return { command: 'cmd.exe', args: ['/d', '/c', command, ...args] };
  }
  return { command, args };
}

function printHelp() {
  console.log(`NEKOWORK doctor

Usage:
  harness doctor [--project-root <dir>] [--quick] [--gemini-smoke] [--json]

Checks:
  - Node.js version
  - package metadata and publish guard
  - git worktree
  - delegated-provider API key environment overrides
  - Claude/Codex/Gemini CLI presence and auth where non-interactive status exists
  - Gemini live smoke when --gemini-smoke is set
  - repair, CLAUDE.md sync, and codemap freshness unless --quick is set
`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = parseDoctorArgs(process.argv.slice(2));
    if (opts.help) {
      printHelp();
      process.exit(0);
    }
    const report = buildDoctorReport({
      harnessRoot: DEFAULT_ROOT,
      projectRoot: opts.projectRoot,
      quick: opts.quick,
      geminiSmoke: opts.geminiSmoke,
    });
    if (opts.json) console.log(JSON.stringify(report, null, 2));
    else console.log(renderDoctorReport(report));
    process.exit(STATUS_RANK[report.summary.status] === 2 ? 1 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}
