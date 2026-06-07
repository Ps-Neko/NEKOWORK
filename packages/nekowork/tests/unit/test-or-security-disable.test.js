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

test('Go t.Skip: high', () => {
  const f = scanFileContent('x_test.go', 't.Skip("flaky")\n');
  assert.equal(f[0].pattern, 'go-test-skip');
  assert.equal(f[0].severity, 'high');
});

test('Go //nolint: medium', () => {
  const f = scanFileContent('x.go', 'foo() //nolint:errcheck\n');
  assert.equal(f[0].pattern, 'go-nolint');
});

test('Rust #[allow(...)]: medium', () => {
  const f = scanFileContent('x.rs', '#[allow(dead_code)]\nfn f() {}\n');
  assert.equal(f[0].pattern, 'rust-allow');
});

test('tslint:disable: high', () => {
  const f = scanFileContent('x.ts', '// tslint:disable\nconst x: any = 1;\n');
  assert.ok(f.some(y => y.pattern === 'tslint-disable'));
});

test('biome-ignore: medium', () => {
  const f = scanFileContent('x.ts', '// biome-ignore lint/style/noVar: legacy\nvar x = 1;\n');
  assert.ok(f.some(y => y.pattern === 'biome-ignore'));
});

test('Python # noqa: medium', () => {
  const f = scanFileContent('x.py', 'import os  # noqa\n');
  assert.equal(f[0].pattern, 'python-noqa');
});

test('normal Go test (no skip): not flagged', () => {
  const f = scanFileContent('x_test.go', 'func TestAdd(t *testing.T) { if add(1,2)!=3 { t.Fatal() } }\n');
  assert.equal(f.length, 0);
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

// ---------- R2-6: JUnit / mypy / gosec / SuppressWarnings ----------

test('JUnit @Disabled / @Ignore: high', () => {
  assert.ok(scanFileContent('x.java', '@Disabled("flaky")\nvoid t() {}').some(x => x.pattern === 'junit-disabled-ignore' && x.severity === 'high'));
  assert.ok(scanFileContent('x.java', '@Ignore\nvoid t() {}').some(x => x.pattern === 'junit-disabled-ignore'));
});

test('mypy # type: ignore: medium', () => {
  const f = scanFileContent('x.py', 'x = f()  # type: ignore');
  assert.ok(f.some(x => x.pattern === 'mypy-type-ignore' && x.severity === 'medium'));
});

test('gosec #nosec: high', () => {
  const f = scanFileContent('x.go', 'cmd := exec.Command(a) // #nosec');
  assert.ok(f.some(x => x.pattern === 'gosec-nosec' && x.severity === 'high'));
});

test('Java @SuppressWarnings: medium', () => {
  const f = scanFileContent('x.java', '@SuppressWarnings("unchecked")\nList l = x;');
  assert.ok(f.some(x => x.pattern === 'java-suppresswarnings'));
});

test('normal test / prose mentions: not flagged (R2-6 FP guard)', () => {
  assert.equal(scanFileContent('x.java', 'void t() { assert ok; }').length, 0);
  assert.equal(scanFileContent('x.py', 'nosecond = v  # checks the type properly').length, 0);
});
