import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFileContent as scanSecretFallback } from '@ps-neko/nekowork/scripts/lib/rules/secret-fallback.js';
import { scanFileContent as scanAutoApply } from '@ps-neko/nekowork/scripts/lib/rules/auto-apply-commit-push.js';
import { scanFileContent as scanHardcodedCredential } from '@ps-neko/nekowork/scripts/lib/rules/hardcoded-credential.js';
import { scanFileContent as scanTestDisable } from '@ps-neko/nekowork/scripts/lib/rules/test-or-security-disable.js';
import { scanFileContent as scanPackageRisk } from '@ps-neko/nekowork/scripts/lib/rules/package-lockfile-risk.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'oss-negatives');

const RULES = [
  ['secret-fallback', scanSecretFallback],
  ['auto-apply-commit-push', scanAutoApply],
  ['hardcoded-credential', scanHardcodedCredential],
  ['test-or-security-disable', scanTestDisable],
  ['package-lockfile-risk', scanPackageRisk],
];

test('OSS negative corpus: real Express examples 모두 CRITICAL FP 0', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, 'manifest.json'), 'utf8'));
  const fps = [];

  for (const entry of manifest.entries) {
    const filePath = path.join(FIXTURE_ROOT, entry.file);
    const content = fs.readFileSync(filePath, 'utf8');
    for (const [ruleName, scan] of RULES) {
      const findings = scan(entry.file, content);
      const criticals = findings.filter(f => f.severity === 'critical');
      if (criticals.length > 0) {
        fps.push({
          fixture: entry.id,
          rule: ruleName,
          count: criticals.length,
          examples: criticals.slice(0, 3).map(f => ({ pattern: f.pattern, line: f.line, match: f.match })),
        });
      }
    }
  }

  if (fps.length > 0) {
    console.error('OSS negative CRITICAL FPs:', JSON.stringify(fps, null, 2));
  }
  assert.equal(fps.length, 0, `${fps.length} CRITICAL FP(s) on real OSS code`);
  console.log(`[oss-negatives] ${manifest.entries.length} real OSS files × ${RULES.length} rules → 0 CRITICAL FP`);
});
