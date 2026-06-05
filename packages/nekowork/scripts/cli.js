#!/usr/bin/env node
// @ps-neko/nekowork — slim CLI surface.
//
// Phase B (this version): verify-pr dispatches INTERNALLY using the
// orchestrator copied into this package. No delegation to nekowork-cli.
// check / report / apply are still TODO — they have wider dependencies
// (session-resolver, gate state machine, execution-workspace) that are
// pending Phase B follow-up. For now they redirect to nekowork-harness.
//
// Public verbs: verify-pr (live), check/report/apply (redirect),
// anything else → nekowork-harness redirect.

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
const VERBS_REDIRECT = new Set(['report', 'apply']); // Phase B follow-up
const META_FLAGS = new Set(['--version', '-v', '--help', '-h']);

const args = process.argv.slice(2);
const verb = args[0];

if (args.length === 0 || META_FLAGS.has(verb)) {
  if (verb === '--version' || verb === '-v') {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(pkg.version);
    process.exit(0);
  }
  console.log(`@ps-neko/nekowork — local verification gate for AI-written code

Usage:
  nekowork verify-pr [opts]  Scan working-tree diff. Produce REPORT.md + .nekowork/decision.json.

Phase B follow-up (currently delegated to @ps-neko/nekowork-harness):
  check     Probe environment readiness
  report    Render an existing decision.json
  apply     Apply a stored .diff iff apply_allowed=true

verify-pr options:
  --from-working-tree       (default) scan uncommitted changes
  --from-staged             scan staged diff
  --range <baseSha...head>  scan commit range
  --from-patch <file>       scan a patch file
  --include <path>          force-scan a path even if gitignored
  --comment-file <path>     write a PR-comment markdown
  --ci-exit-soft            NEEDS_HUMAN_REVIEW / INSUFFICIENT_EVIDENCE → exit 0
  --json                    machine-readable output
  --no-write                don't write REPORT.md / decision.json

Need legacy / harness commands (ask / plan / team / work / ship / build / auto / ...)?
  npm i -g @ps-neko/nekowork-harness
  nekowork-harness <verb>

Docs:
  https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/QUICKSTART.md
  https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/SCOPE-1.0.md
  https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/BENCHMARK.md`);
  process.exit(0);
}

if (VERBS_INTERNAL.has(verb)) {
  await runInternal(verb, args.slice(1));
} else if (VERBS_REDIRECT.has(verb)) {
  console.error(`@ps-neko/nekowork: \`${verb}\` is not yet implemented in the slim package (Phase B follow-up).

For now, use @ps-neko/nekowork-harness:
  npm i -g @ps-neko/nekowork-harness
  nekowork-harness ${verb} ${args.slice(1).join(' ')}

Status: only \`verify-pr\` runs natively in @ps-neko/nekowork as of this version.
This will close in the next alpha cycle.`);
  process.exit(1);
} else {
  console.error(`Unknown verb: \`${verb}\`.

The slim @ps-neko/nekowork currently supports:
  verify-pr (native)
  check / report / apply (redirect to @ps-neko/nekowork-harness)

For \`${verb}\` (a legacy / harness command), install @ps-neko/nekowork-harness:
  npm i -g @ps-neko/nekowork-harness
  nekowork-harness ${verb} ${args.slice(1).join(' ')}`);
  process.exit(1);
}

async function runInternal(verb, rest) {
  if (verb === 'check') {
    // Re-invoke check.js as a sub-script — it does its own arg parsing and exits.
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
