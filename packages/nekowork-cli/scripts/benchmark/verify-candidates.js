#!/usr/bin/env node
// Verify scraped OSS candidates against a rule.
//
// Runs the rule scanner against each candidate file under
// `tests/fixtures/<rule>/positive/candidates/`. Updates `candidates.json`
// with the scan result so the human reviewer can quickly see which
// candidates the rule actually catches (and which it misses — those are
// recall-gap signal).
//
// Usage:
//   node scripts/benchmark/verify-candidates.js --rule secret-fallback
//
// Output: prints a table; rewrites candidates.json in place adding
// `scan_findings` field per entry.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_ROOT = path.join(ROOT, 'tests', 'fixtures');

const RULE_MODULES = {
  'secret-fallback': '@ps-neko/nekowork/scripts/lib/rules/secret-fallback.js',
  'auto-apply-commit-push': '@ps-neko/nekowork/scripts/lib/rules/auto-apply-commit-push.js',
  'hardcoded-credential': '@ps-neko/nekowork/scripts/lib/rules/hardcoded-credential.js',
  'test-or-security-disable': '@ps-neko/nekowork/scripts/lib/rules/test-or-security-disable.js',
  'package-lockfile-risk': '@ps-neko/nekowork/scripts/lib/rules/package-lockfile-risk.js',
};

const args = parseArgs(process.argv.slice(2));
if (!args.rule || !RULE_MODULES[args.rule]) {
  console.error(`--rule required; one of: ${Object.keys(RULE_MODULES).join(', ')}`);
  process.exit(1);
}

const rule = args.rule;
const candidatesIndex = path.join(FIXTURE_ROOT, rule, 'positive', 'candidates', 'candidates.json');
if (!fs.existsSync(candidatesIndex)) {
  console.error(`No candidates index at ${candidatesIndex}`);
  console.error(`Run scrape-oss-positives.js first.`);
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync(candidatesIndex, 'utf8'));
const mod = await import(RULE_MODULES[rule]);
const scan = mod.scanFileContent;

let hit = 0;
let miss = 0;

console.log(`\nVerifying ${index.candidates.length} candidates against rule "${rule}"\n`);
console.log('candidate                                                   findings  severity');
console.log('--------------------------------------------------------- --------- --------');

for (const c of index.candidates) {
  const filePath = path.join(FIXTURE_ROOT, rule, c.file);
  if (!fs.existsSync(filePath)) {
    c.scan_findings = { error: 'file missing' };
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const findings = scan(c.file, content);
  c.scan_findings = {
    count: findings.length,
    severities: findings.reduce((acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; }, {}),
    patterns: [...new Set(findings.map(f => f.pattern || f.id).filter(Boolean))],
    sample_lines: findings.slice(0, 3).map(f => f.line),
  };
  if (findings.length > 0) {
    hit++;
    const sev = findings.find(f => f.severity === 'critical') ? 'CRITICAL'
      : findings.find(f => f.severity === 'high') ? 'HIGH'
      : findings[0]?.severity || '?';
    console.log(`${c.id.padEnd(58)} ${String(findings.length).padStart(8)} ${sev}`);
  } else {
    miss++;
    console.log(`${c.id.padEnd(58)} ${'0'.padStart(8)} (miss)`);
  }
}

console.log();
console.log(`Total: ${index.candidates.length}   Caught: ${hit}   Missed: ${miss}`);
console.log(`Rule recall on this OSS slice: ${index.candidates.length > 0 ? (hit / index.candidates.length * 100).toFixed(0) : 0}%`);

index.last_verified_at = new Date().toISOString();
index.verification_summary = {
  total: index.candidates.length,
  rule_caught: hit,
  rule_missed: miss,
  recall_on_slice: index.candidates.length > 0 ? hit / index.candidates.length : 0,
};

fs.writeFileSync(candidatesIndex, JSON.stringify(index, null, 2));
console.log(`\nUpdated ${candidatesIndex}`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else { out[key] = true; }
    }
  }
  return out;
}
