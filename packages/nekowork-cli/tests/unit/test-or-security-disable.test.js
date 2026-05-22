import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFileContent } from '../../scripts/lib/rules/test-or-security-disable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'test-or-security-disable');

test('it.skip: high', () => {
  const f = scanFileContent('x.test.ts', "test.skip('x', () => {});");
  assert.equal(f[0].pattern, 'js-test-skip');
  assert.equal(f[0].severity, 'high');
});

test('describe.skip: high', () => {
  const f = scanFileContent('x.test.ts', "describe.skip('x', () => {});");
  assert.equal(f[0].pattern, 'js-test-skip');
});

test('xit / xdescribe: high', () => {
  const f = scanFileContent('x.test.ts', 'xit("a", () => {});\nxdescribe("b", () => {});');
  assert.equal(f.length, 2);
});

test('@ts-nocheck: critical', () => {
  const f = scanFileContent('x.ts', '// @ts-nocheck\nconst x = 1;');
  assert.equal(f[0].pattern, 'ts-nocheck-file');
  assert.equal(f[0].severity, 'critical');
});

test('@ts-ignore: medium', () => {
  const f = scanFileContent('x.ts', '// @ts-ignore\nconst x: number = "wrong";');
  assert.equal(f[0].pattern, 'ts-ignore-line');
  assert.equal(f[0].severity, 'medium');
});

test('@ts-expect-error: not flagged', () => {
  const f = scanFileContent('x.ts', '// @ts-expect-error\nconst x: number = "wrong";');
  assert.equal(f.length, 0);
});

test('file-wide eslint-disable: critical (raw pattern bypasses comment strip)', () => {
  const f = scanFileContent('x.ts', '/* eslint-disable */\nconst x = 1;');
  assert.equal(f[0].pattern, 'eslint-disable-file');
  assert.equal(f[0].severity, 'critical');
});

test('pytest skip: high', () => {
  const f = scanFileContent('x.py', '@pytest.mark.skip(reason="x")\ndef test_a():\n    pass');
  assert.equal(f[0].pattern, 'python-pytest-skip');
});

test('it.only: not flagged (focus, not skip)', () => {
  const f = scanFileContent('x.test.ts', "it.only('focused', () => {});");
  assert.equal(f.length, 0);
});

test('eslint-disable-next-line: medium (raw)', () => {
  const f = scanFileContent('x.ts', '// eslint-disable-next-line no-console\nconsole.log("x");');
  assert.equal(f[0].pattern, 'eslint-disable-next');
  assert.equal(f[0].severity, 'medium');
});

test('fixture manifest: recall + critical FP gate', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, 'manifest.json'), 'utf8'));
  let posCaught = 0, posTotal = 0, criticalFp = 0, negTotal = 0;
  const missed = [], fps = [];
  for (const e of manifest.entries) {
    const content = fs.readFileSync(path.join(FIXTURE_ROOT, e.file), 'utf8');
    const findings = scanFileContent(e.file, content);
    if (e.label === 'positive') {
      posTotal++;
      if (findings.length > 0) posCaught++;
      else missed.push(e.id);
    } else {
      negTotal++;
      const cr = findings.filter(f => f.severity === 'critical');
      if (cr.length > 0) {
        criticalFp++;
        fps.push({ id: e.id, pattern: cr[0].pattern });
      }
    }
  }
  const recall = posCaught / posTotal;
  const fpRate = criticalFp / negTotal;
  assert.ok(recall >= 0.90, `recall ${recall.toFixed(2)} below 0.90; missed: ${missed.join(', ')}`);
  assert.ok(fpRate <= 0.10, `CRITICAL FP rate ${fpRate.toFixed(2)} above 0.10; FPs: ${JSON.stringify(fps)}`);
  console.log(`[test-or-security-disable] synthetic seed: recall=${(recall * 100).toFixed(0)}% (${posCaught}/${posTotal}), CRITICAL FP=${(fpRate * 100).toFixed(0)}% (${criticalFp}/${negTotal})`);
});
