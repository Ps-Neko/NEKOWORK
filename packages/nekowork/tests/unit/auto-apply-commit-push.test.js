import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanFileContent,
  scanAddedLines,
  scanDiff,
} from '../../scripts/lib/rules/auto-apply-commit-push.js';
import { parseDiff } from '../../scripts/lib/diff-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'auto-apply-commit-push');

// ---------- direct API ----------

test('git push --force: critical', () => {
  const f = scanFileContent('deploy.sh', 'git push --force origin main\n');
  assert.ok(f.find(x => x.pattern === 'git-push-force'));
  assert.equal(f[0].severity, 'critical');
});

test('git push --force-with-lease: high (not critical)', () => {
  const f = scanFileContent('deploy.sh', 'git push --force-with-lease origin main\n');
  assert.ok(!f.find(x => x.pattern === 'git-push-force'));
  const lineFinding = f.find(x => x.pattern === 'git-push-line');
  assert.ok(lineFinding);
  assert.equal(lineFinding.severity, 'high');
});

test('plain git push: high', () => {
  const f = scanFileContent('deploy.sh', 'git push origin main\n');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'high');
  assert.equal(f[0].pattern, 'git-push-line');
});

test('git commit -m: high', () => {
  const f = scanFileContent('deploy.sh', 'git commit -m "auto bump"\n');
  assert.equal(f[0].pattern, 'git-commit-auto');
  assert.equal(f[0].severity, 'high');
});

test('spawnSync git push: critical', () => {
  const f = scanFileContent('release.js', "spawnSync('git', ['push', 'origin', 'main']);\n");
  assert.equal(f[0].pattern, 'subprocess-git-push');
  assert.equal(f[0].severity, 'critical');
});

test('rm -rf with $VAR: critical', () => {
  const f = scanFileContent('clean.sh', 'rm -rf ${WORK}/cache\n');
  assert.equal(f[0].pattern, 'rm-rf-variable');
  assert.equal(f[0].severity, 'critical');
});

test('rm -rf /tmp/build: not flagged (stoplist)', () => {
  const f = scanFileContent('clean.sh', 'rm -rf /tmp/build-cache\n');
  assert.equal(f.length, 0);
});

test('rm -rf /usr/local: critical (rm-rf-system)', () => {
  const f = scanFileContent('install.sh', 'rm -rf /usr/local/lib/node_modules\n');
  assert.equal(f[0].pattern, 'rm-rf-system');
  assert.equal(f[0].severity, 'critical');
});

test('rm -r -f with $VAR (separated flags): critical', () => {
  const f = scanFileContent('clean.sh', 'rm -r -f ${WORK}/cache\n');
  assert.equal(f[0].pattern, 'rm-rf-variable');
  assert.equal(f[0].severity, 'critical');
});

test('rm -fr with $VAR (reversed flags): critical', () => {
  const f = scanFileContent('clean.sh', 'rm -fr ${WORK}/cache\n');
  assert.equal(f[0].pattern, 'rm-rf-variable');
  assert.equal(f[0].severity, 'critical');
});

test('rm -r -f /usr/local (separated flags, system path): critical', () => {
  const f = scanFileContent('install.sh', 'rm -r -f /usr/local/lib/node_modules\n');
  assert.equal(f[0].pattern, 'rm-rf-system');
  assert.equal(f[0].severity, 'critical');
});

test('rm without -rf flags (rm foo $VAR): not flagged', () => {
  const f = scanFileContent('clean.sh', 'rm foo ${WORK}\n');
  assert.equal(f.length, 0);
});

test('auto-merge: true: critical', () => {
  const f = scanFileContent('dependabot.yml', 'auto-merge: true\n');
  assert.equal(f[0].pattern, 'auto-merge-config');
  assert.equal(f[0].severity, 'critical');
});

test('auto-merge: false: not flagged', () => {
  const f = scanFileContent('dependabot.yml', 'auto-merge: false\n');
  assert.equal(f.length, 0);
});

test('comment stripping: # comment 안 git push 는 무시', () => {
  const f = scanFileContent('clean.sh', '# manual step: git push origin main\necho ok\n');
  assert.equal(f.length, 0);
});

test('comment stripping: // 안 git push 는 무시', () => {
  const f = scanFileContent('release.js', '// reminder: git push --force was banned\nconst x = 1;\n');
  assert.equal(f.length, 0);
});

test('scanDiff: parseDiff 출력으로 git push 탐지', () => {
  const diff = `diff --git a/deploy.sh b/deploy.sh
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/deploy.sh
@@ -0,0 +1,2 @@
+#!/bin/sh
+git push --force origin main
`;
  const parsed = parseDiff(diff);
  const f = scanDiff(parsed);
  assert.ok(f.length >= 1);
  assert.equal(f[0].file, 'deploy.sh');
  assert.equal(f[0].severity, 'critical');
});

test('finding 스키마: 필수 필드', () => {
  const f = scanFileContent('x.sh', 'git push --force\n');
  assert.equal(f.length, 1);
  for (const key of ['id', 'rule', 'pattern', 'severity', 'category', 'file', 'line', 'title', 'description', 'recommendation', 'blocks_apply']) {
    assert.ok(key in f[0], `missing field: ${key}`);
  }
  assert.equal(f[0].rule, 'auto-apply-commit-push');
  assert.equal(f[0].category, 'automation-safety');
});

// ---------- C1: non-JS subprocess git push ----------

test('Python subprocess git push: critical', () => {
  const f = scanFileContent('deploy.py', "subprocess.run(['git', 'push', 'origin', 'main'])\n");
  assert.ok(f.some(x => x.pattern === 'python-subprocess-git-push' && x.severity === 'critical'));
});

test('Python subprocess git status: not critical', () => {
  const f = scanFileContent('check.py', "subprocess.run(['git', 'status'])\n");
  assert.equal(f.filter(x => x.severity === 'critical').length, 0);
});

test('Go exec.Command git push: critical', () => {
  const f = scanFileContent('deploy.go', 'exec.Command("git", "push", "origin", "HEAD")\n');
  assert.ok(f.some(x => x.pattern === 'go-exec-git-push' && x.severity === 'critical'));
});

test('Ruby system git push: critical', () => {
  const f = scanFileContent('deploy.rb', "system('git push origin main')\n");
  assert.ok(f.some(x => x.pattern === 'ruby-system-git-push' && x.severity === 'critical'));
});

// ---------- fixture manifest measurement ----------

test('fixture manifest: any-detection recall + CRITICAL FP gate', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, 'manifest.json'), 'utf8'));

  let posCaught = 0;
  let posTotal = 0;
  let criticalFp = 0;
  let negTotal = 0;
  const missed = [];
  const criticalFps = [];

  for (const entry of manifest.entries) {
    const filePath = path.join(FIXTURE_ROOT, entry.file);
    const content = fs.readFileSync(filePath, 'utf8');
    const findings = scanFileContent(entry.file, content);

    if (entry.label === 'positive') {
      posTotal++;
      if (findings.length > 0) posCaught++;
      else missed.push(entry.id);
    } else {
      negTotal++;
      const criticals = findings.filter(f => f.severity === 'critical');
      if (criticals.length > 0) {
        criticalFp++;
        criticalFps.push({ id: entry.id, count: criticals.length, pattern: criticals[0].pattern });
      }
    }
  }

  const recall = posCaught / posTotal;
  const fpRate = criticalFp / negTotal;

  // Phase 0 baseline (any-detection recall >= 0.90, CRITICAL FP <= 0.10)
  assert.ok(recall >= 0.90, `any-detection recall ${recall.toFixed(2)} below 0.90; missed: ${missed.join(', ')}`);
  assert.ok(fpRate <= 0.10, `CRITICAL FP rate ${fpRate.toFixed(2)} above 0.10; FPs: ${JSON.stringify(criticalFps)}`);

  console.log(`[auto-apply-commit-push] synthetic seed: any-detection recall=${(recall * 100).toFixed(0)}% (${posCaught}/${posTotal}), CRITICAL FP=${(fpRate * 100).toFixed(0)}% (${criticalFp}/${negTotal})`);
});

// ---------- R2-5: gh pr merge --auto ----------

test('gh pr merge --auto: critical', () => {
  const f = scanFileContent('x.sh', 'gh pr merge 42 --auto --squash');
  assert.ok(f.some(x => x.pattern === 'gh-pr-merge-auto' && x.severity === 'critical'));
});

test('gh pr merge --auto with flag after ref: critical', () => {
  const f = scanFileContent('x.sh', 'gh pr merge "$PR" --auto');
  assert.ok(f.some(x => x.pattern === 'gh-pr-merge-auto'));
});

test('gh pr merge without --auto: not flagged as auto-merge', () => {
  const f = scanFileContent('x.sh', 'gh pr merge 42 --squash');
  assert.ok(!f.some(x => x.pattern === 'gh-pr-merge-auto'));
});
