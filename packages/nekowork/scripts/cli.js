#!/usr/bin/env node
// @ps-neko/nekowork slim CLI surface.
//
// Two verbs:
//   check       Probe environment readiness (node, git, repo).
//   verify-pr   Scan a diff, emit verdict + REPORT.md + .nekowork/decision.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifyPrCycle,
  parseVerifyPrArgs,
  printVerifyPrSummary,
  EXIT_CODE,
  VERDICT,
} from './orchestrators/verify-pr.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VERBS_INTERNAL = new Set(['verify-pr', 'check']);
const META_FLAGS = new Set(['--version', '-v', '--help', '-h']);

const args = process.argv.slice(2);
const verb = args[0];

if (args.length === 0 || META_FLAGS.has(verb)) {
  if (isVersionFlag(verb)) {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(pkg.version);
    process.exit(0);
  }
  printHelp();
  process.exit(0);
}

if (isHelpFlag(args[1])) {
  printHelp(verb);
  process.exit(0);
}

if (VERBS_INTERNAL.has(verb)) {
  await runInternal(verb, args.slice(1));
} else {
  console.error(`Unknown verb: \`${verb}\`.

@ps-neko/nekowork supports two verbs:
  check       Probe environment readiness
  verify-pr   Scan a diff and emit verdict + REPORT.md + .nekowork/decision.json

Run \`nekowork verify-pr --help\` for verification options.`);
  process.exit(1);
}

function isHelpFlag(value) {
  return value === '--help' || value === '-h';
}

function isVersionFlag(value) {
  return value === '--version' || value === '-v';
}

function printHelp(requestedVerb = null) {
  if (requestedVerb === 'verify-pr') {
    console.log(`@ps-neko/nekowork verify-pr

Usage:
  nekowork verify-pr [opts]  Scan working-tree diff. Produce REPORT.md + .nekowork/decision.json.

Options:
  --from-working-tree       (default) scan uncommitted changes
  --from-staged             scan staged diff
  --range <baseSha...head>  scan commit range
  --from-patch <file>       scan a patch file
  --include <path>          force-scan a path even if gitignored
  --comment-file <path>     write a PR-comment markdown
  --ci-exit-soft            NEEDS_HUMAN_REVIEW / INSUFFICIENT_EVIDENCE exits 0
  --json                    machine-readable output
  --no-write                don't write REPORT.md / decision.json`);
    return;
  }

  console.log(`@ps-neko/nekowork - local verification gate for AI-written code

Usage:
  nekowork check             Probe environment readiness (node, git, repo)
  nekowork verify-pr [opts]  Scan working-tree diff. Produce REPORT.md + .nekowork/decision.json.

Run \`nekowork verify-pr --help\` for verification options.`);
}

async function runInternal(verb, rest) {
  if (verb === 'check') {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, [path.resolve(__dirname, 'check.js'), ...rest], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }
  if (verb === 'verify-pr') {
    const opts = parseVerifyPrArgs(rest);
    const result = await verifyPrCycle(opts);
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
    let exitCode = EXIT_CODE[result.decision.verdict] ?? 1;
    if (opts.ciExitSoft && (result.decision.verdict === VERDICT.NEEDS_HUMAN_REVIEW || result.decision.verdict === VERDICT.INSUFFICIENT_EVIDENCE)) {
      exitCode = 0;
    }
    process.exit(exitCode);
  }
}
