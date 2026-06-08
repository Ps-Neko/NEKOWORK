#!/usr/bin/env node
// @ps-neko/nekowork — slim CLI surface.
//
// All 4 public verbs run LOCALLY in this package. No delegation to any other package.
//
// Public verbs: check, verify-pr, report, apply
// Anything else → error: harness verbs live in the internal (unpublished) @ps-neko/nekowork-harness; use a source checkout.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifyPrCycle,
  parseVerifyPrArgs,
  printVerifyPrSummary,
} from './orchestrators/verify-pr.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VERBS_INTERNAL = new Set(['verify-pr', 'check', 'report', 'apply']);
const META_FLAGS = new Set(['--version', '-v', '--help', '-h']);

const args = process.argv.slice(2);
const verb = args[0];

const USAGE = `@ps-neko/nekowork — local verification gate for AI-written code

Usage:
  nekowork check                  Probe environment readiness
  nekowork verify-pr [opts]       Scan working-tree diff. Produce REPORT.md + .nekowork/decision.json.
  nekowork report --session <id>  Render session evidence into REPORT.md (session-based workflow)
  nekowork apply --session <id>   Apply a stored .diff iff SHIP_READY (session-based workflow)

verify-pr options:
  --from-working-tree       (default) scan uncommitted changes
  --from-staged             scan staged diff
  --range <baseSha...head>  scan commit range
  --from-patch <file>       scan a patch file
  --full-scan               scan the whole tree (onboarding; no PR/diff yet)
  --include <path>          force-scan a path even if gitignored
  --run-checks              run the project's test/lint/typecheck commands and
                            require them to pass (a source change without this is
                            NEEDS_HUMAN_REVIEW — a risk scan alone is not full
                            verification). Skipped if the diff tampers with the
                            run surface (build/test scripts, critical finding).
  --checks-timeout <ms>     per-check timeout for --run-checks (default 300000)
  --comment-file <path>     write a PR-comment markdown
  --ci-exit-soft            NEEDS_HUMAN_REVIEW / INSUFFICIENT_EVIDENCE → exit 0
  --json                    machine-readable output
  --no-write                don't write REPORT.md / decision.json
  (flags also accept --flag=value)

Need legacy / harness commands (ask / plan / team / work / ship / build / auto / ...)?
  They live in the internal @ps-neko/nekowork-harness runtime, which is NOT
  published to npm. Run them from a source checkout:
  https://github.com/Ps-Neko/NEKOWORK

Docs:
  https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/QUICKSTART.md
  https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/SCOPE-1.0.md
  https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/BENCHMARK.md`;

if (args.length === 0 || META_FLAGS.has(verb)) {
  if (verb === '--version' || verb === '-v') {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(pkg.version);
    process.exit(0);
  }
  console.log(USAGE);
  process.exit(0);
}

if (VERBS_INTERNAL.has(verb)) {
  await runInternal(verb, args.slice(1));
} else {
  console.error(`Unknown verb: \`${verb}\`.

The slim @ps-neko/nekowork supports:
  check, verify-pr, report, apply

\`${verb}\` is a harness command. The harness runtime (@ps-neko/nekowork-harness)
is internal and NOT published to npm — run harness verbs from a source checkout:
  https://github.com/Ps-Neko/NEKOWORK`);
  process.exit(1);
}

async function runInternal(verb, rest) {
  if (rest.includes('--help') || rest.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }

  if (verb === 'check') {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, [path.resolve(__dirname, 'check.js'), ...rest], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }

  if (verb === 'verify-pr') {
    let opts;
    try {
      opts = parseVerifyPrArgs(rest);
    } catch (e) {
      // Usage error (e.g. unknown option / missing value): one clean line + a
      // pointer to --help, exit 2. Never leak a raw stack trace for bad input.
      console.error(String(e?.message || e));
      console.error('Run `nekowork verify-pr --help` for supported options.');
      process.exit(2);
    }
    let result;
    try {
      result = await verifyPrCycle(opts);
    } catch (e) {
      const msg = String(e?.message || e);
      if (/not a git repository/i.test(msg)) {
        console.error('verify-pr could not find a git repository here.');
        console.error('  Run it inside a git repo, or scan a patch file instead:');
        console.error('    nekowork verify-pr --from-patch <file>');
        process.exit(2);
      }
      console.error(msg);
      process.exit(1);
    }
    if (opts.json) {
      console.log(JSON.stringify({
        decision: result.decision,
        findings: result.findings,
        evidence: result.evidence,
        writtenPaths: result.writtenPaths,
      }, null, 2));
    } else {
      printVerifyPrSummary(result);
    }
    // Single source of truth: verifyPrCycle already computed exitCode and
    // honored --ci-exit-soft. Do not recompute here.
    process.exit(result.exitCode ?? 1);
  }

  if (verb === 'report') {
    const { reportSession } = await import('./orchestrators/report.js');
    const opts = parseReportArgs(rest);
    if (!opts.sessionId) {
      console.error('report requires --session <id>');
      process.exit(2);
    }
    let result;
    try {
      result = reportSession({
        ...opts,
        projectRoot: opts.projectRoot || process.cwd(),
      });
    } catch (e) {
      console.error(String(e.message || e));
      process.exit(1);
    }
    if (opts.json) {
      console.log(JSON.stringify({
        sessionId: result.sessionId,
        status: result.status,
        verdict: result.verdict,
        shipReady: result.shipReady,
        reportPath: result.reportPath,
      }, null, 2));
    } else {
      console.log('=== report ===');
      console.log('  session    : ' + result.sessionId);
      console.log('  status     : ' + result.status);
      console.log('  verdict    : ' + (result.verdict || 'n/a'));
      console.log('  ship ready : ' + (result.shipReady ? 'yes' : 'no'));
      if (result.reportPath) console.log('  report     : ' + result.reportPath);
    }
    process.exit(0);
  }

  if (verb === 'apply') {
    const { applyCycle } = await import('./orchestrators/apply.js');
    const opts = parseApplyArgs(rest);
    if (!opts.sessionId) {
      console.error('apply requires --session <id>');
      process.exit(2);
    }
    let result;
    try {
      result = applyCycle({
        ...opts,
        projectRoot: opts.projectRoot || process.cwd(),
      });
    } catch (e) {
      console.error(String(e.message || e));
      process.exit(1);
    }
    if (opts.json) {
      console.log(JSON.stringify({
        sessionId: result.sessionId,
        applied: result.applied,
        alreadyApplied: result.alreadyApplied,
        humanGate: result.humanGate,
        noShip: result.noShip,
        reason: result.reason,
        diffPath: result.diffPath,
        files: result.files,
      }, null, 2));
    } else {
      console.log('=== apply ===');
      console.log('  session    : ' + result.sessionId);
      console.log('  applied    : ' + (result.applied ? 'yes' : 'no'));
      console.log('  already    : ' + (result.alreadyApplied ? 'yes' : 'no'));
      console.log('  human gate : ' + (result.humanGate ? 'YES' : 'no'));
      console.log('  no ship    : ' + (result.noShip ? 'YES' : 'no'));
      console.log('  diff       : ' + (result.diffPath || '(none)'));
      if (result.reason) console.log('  reason     : ' + result.reason);
    }
    if (result.humanGate || result.noShip) process.exit(3);
    process.exit(0);
  }
}

function parseReportArgs(argv) {
  const opts = {
    sessionId: null,
    projectRoot: null,
    outputPath: null,
    stdoutOnly: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--stdout') opts.stdoutOnly = true;
    else if (a === '--session' || a === '--session-id') {
      opts.sessionId = argv[++i];
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      opts.projectRoot = argv[++i];
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    } else if (a === '--output') {
      opts.outputPath = argv[++i];
    } else if (a.startsWith('--output=')) {
      opts.outputPath = a.slice('--output='.length);
    }
  }
  return opts;
}

function parseApplyArgs(argv) {
  const opts = {
    sessionId: null,
    projectRoot: null,
    allowDirty: false,
    force: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--allow-dirty') opts.allowDirty = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--session') {
      opts.sessionId = argv[++i];
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    } else if (a === '--project-root') {
      opts.projectRoot = argv[++i];
    } else if (a.startsWith('--project-root=')) {
      opts.projectRoot = a.slice('--project-root='.length);
    }
  }
  return opts;
}
