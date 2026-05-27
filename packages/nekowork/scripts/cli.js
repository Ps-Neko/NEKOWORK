#!/usr/bin/env node
// @ps-neko/nekowork — slim CLI surface.
//
// PHASE A SKELETON. Currently this is a guard layer that delegates the 4
// allowed verbs to @ps-neko/nekowork-cli via a relative path. This works in
// the monorepo for dev / smoke tests only.
//
// To publish this package on npm independently, the verify-pr orchestrator,
// its lib deps (decision.js, diff-parser.js, severity.js), the rule modules
// (lib/rules/*), schemas, and rule fixtures must be moved into THIS package.
// See HANDOFF-PACKAGE-SPLIT.md for the move list and hour estimate.
//
// Public verbs: check / verify-pr / report / apply.
// Everything else exits 1 with a redirect to @ps-neko/nekowork-harness.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HARNESS_CLI = path.resolve(__dirname, '..', '..', 'nekowork-cli', 'scripts', 'cli.js');

const ALLOWED_VERBS = new Set(['check', 'verify-pr', 'report', 'apply']);
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
  nekowork check        Probe environment readiness (node version, git repo, etc.)
  nekowork verify-pr    Scan working-tree diff, produce REPORT.md + decision.json
  nekowork report       Render an existing decision.json to a readable REPORT.md
  nekowork apply        Apply a stored .diff iff decision.json says apply_allowed=true

Need legacy / harness commands (ask / plan / team / work / ship / build / auto / ...)?
  npm i -g @ps-neko/nekowork-harness
  nekowork-harness <verb>

Docs:
  https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/QUICKSTART.md
  https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/SCOPE-1.0.md
  https://github.com/Ps-Neko/NEKOWORK/blob/main/packages/nekowork-cli/docs/BENCHMARK.md`);
  process.exit(0);
}

if (!ALLOWED_VERBS.has(verb)) {
  console.error(`Unknown verb: \`${verb}\`.

The slim @ps-neko/nekowork supports only the 4 verification verbs:
  check | verify-pr | report | apply

For \`${verb}\` (a legacy / harness command), install @ps-neko/nekowork-harness:
  npm i -g @ps-neko/nekowork-harness
  nekowork-harness ${verb} ${args.slice(1).join(' ')}`);
  process.exit(1);
}

if (!fs.existsSync(HARNESS_CLI)) {
  console.error(`@ps-neko/nekowork (Phase A skeleton): cannot find the sibling nekowork-cli at:
  ${HARNESS_CLI}

This Phase A skeleton requires running inside the monorepo with both packages
installed. To publish @ps-neko/nekowork as a standalone npm package, the
verify-pr code path must be moved into this package — see HANDOFF-PACKAGE-SPLIT.md.`);
  process.exit(1);
}

try {
  execFileSync(process.execPath, [HARNESS_CLI, ...args], { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status ?? 1);
}
