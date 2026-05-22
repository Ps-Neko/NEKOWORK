#!/usr/bin/env node
// Internal benchmark for verify-pr risk rules.
//
// Reads each rule's fixture manifest, runs the rule, computes recall and
// (CRITICAL) FP rate, prints a table, and exits non-zero if any rule fails
// its 1.0 gate. Use in CI to catch regressions in detection quality.
//
// Usage:
//   node scripts/benchmark/rules.js               # console table + exit code
//   node scripts/benchmark/rules.js --json        # JSON to stdout
//   node scripts/benchmark/rules.js --rule <id>   # single rule

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_ROOT = path.join(ROOT, 'tests', 'fixtures');

const RULES = [
  {
    id: 'secret-fallback',
    module: '../lib/rules/secret-fallback.js',
    fixtureDir: 'secret-fallback',
    fpMode: 'any', // negative = ANY finding counts as FP
    targets: { recall: 0.90, fp: 0.10 },
  },
  {
    id: 'auto-apply-commit-push',
    module: '../lib/rules/auto-apply-commit-push.js',
    fixtureDir: 'auto-apply-commit-push',
    fpMode: 'critical', // negative = CRITICAL findings only count as FP
    targets: { recall: 0.90, fp: 0.10 },
  },
  {
    id: 'hardcoded-credential',
    module: '../lib/rules/hardcoded-credential.js',
    fixtureDir: 'hardcoded-credential',
    fpMode: 'critical',
    targets: { recall: 0.90, fp: 0.10 },
  },
  {
    id: 'test-or-security-disable',
    module: '../lib/rules/test-or-security-disable.js',
    fixtureDir: 'test-or-security-disable',
    fpMode: 'critical',
    targets: { recall: 0.90, fp: 0.10 },
  },
  {
    id: 'package-lockfile-risk',
    module: '../lib/rules/package-lockfile-risk.js',
    fixtureDir: 'package-lockfile-risk',
    fpMode: 'critical',
    targets: { recall: 0.90, fp: 0.10 },
  },
];

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const ruleFilter = (() => {
  const i = args.indexOf('--rule');
  return i >= 0 ? args[i + 1] : null;
})();

async function run() {
  const results = [];
  for (const rule of RULES) {
    if (ruleFilter && rule.id !== ruleFilter) continue;
    results.push(await benchmarkRule(rule));
  }

  if (jsonOut) {
    console.log(JSON.stringify({ generated_at: new Date().toISOString(), rules: results }, null, 2));
  } else {
    printTable(results);
  }

  const failed = results.filter(r => !r.passed);
  if (failed.length) {
    if (!jsonOut) {
      console.error(`\nFAIL: ${failed.length} rule(s) below 1.0 gate:`);
      for (const r of failed) console.error(`  - ${r.id}: ${r.failures.join(', ')}`);
    }
    process.exit(1);
  }
}

async function benchmarkRule(rule) {
  const fixtureDir = path.join(FIXTURE_ROOT, rule.fixtureDir);
  const manifestPath = path.join(fixtureDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return {
      id: rule.id,
      passed: false,
      failures: ['manifest.json missing'],
      stats: null,
    };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const mod = await import(rule.module);
  const scan = mod.scanFileContent;

  let posCaught = 0, posTotal = 0, fpCount = 0, negTotal = 0;
  const missed = [];
  const falsePositives = [];

  for (const entry of manifest.entries) {
    const filePath = path.join(fixtureDir, entry.file);
    const content = fs.readFileSync(filePath, 'utf8');
    const findings = scan(entry.file, content);

    if (entry.label === 'positive') {
      posTotal++;
      if (findings.length > 0) posCaught++;
      else missed.push(entry.id);
    } else {
      negTotal++;
      const fps = rule.fpMode === 'critical'
        ? findings.filter(f => f.severity === 'critical')
        : findings;
      if (fps.length > 0) {
        fpCount++;
        falsePositives.push({ id: entry.id, count: fps.length, pattern: fps[0]?.pattern });
      }
    }
  }

  const recall = posTotal > 0 ? posCaught / posTotal : 0;
  const fpRate = negTotal > 0 ? fpCount / negTotal : 0;

  const failures = [];
  if (recall < rule.targets.recall) failures.push(`recall ${(recall * 100).toFixed(0)}% < ${(rule.targets.recall * 100).toFixed(0)}%`);
  if (fpRate > rule.targets.fp) failures.push(`FP ${(fpRate * 100).toFixed(0)}% > ${(rule.targets.fp * 100).toFixed(0)}%`);

  return {
    id: rule.id,
    passed: failures.length === 0,
    failures,
    fpMode: rule.fpMode,
    stats: {
      recall: { caught: posCaught, total: posTotal, ratio: recall },
      fp: { count: fpCount, total: negTotal, rate: fpRate },
    },
    missed,
    falsePositives,
    targets: rule.targets,
  };
}

function printTable(results) {
  console.log('');
  console.log('NEKOWORK verify-pr rule benchmark');
  console.log('');
  const header = ['rule', 'recall', 'FP', 'mode', 'gate'];
  const widths = [30, 14, 10, 8, 6];
  console.log(header.map((h, i) => h.padEnd(widths[i])).join(''));
  console.log(widths.map(w => '-'.repeat(w - 1)).join(' '));
  for (const r of results) {
    const recall = `${r.stats.recall.caught}/${r.stats.recall.total} (${(r.stats.recall.ratio * 100).toFixed(0)}%)`;
    const fp = `${r.stats.fp.count}/${r.stats.fp.total} (${(r.stats.fp.rate * 100).toFixed(0)}%)`;
    const gate = r.passed ? 'PASS' : 'FAIL';
    console.log(
      r.id.padEnd(widths[0]) +
      recall.padEnd(widths[1]) +
      fp.padEnd(widths[2]) +
      r.fpMode.padEnd(widths[3]) +
      gate.padEnd(widths[4]),
    );
  }
  console.log('');
  const passed = results.filter(r => r.passed).length;
  console.log(`${passed}/${results.length} rules passing 1.0 gate.`);
}

run().catch(err => {
  console.error(err);
  process.exit(2);
});
