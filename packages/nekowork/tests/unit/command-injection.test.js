import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFileContent } from '../../scripts/lib/rules/command-injection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'command-injection');

test('exec concat: high', () => {
  const f = scanFileContent('x.js', 'exec("ping " + host);');
  assert.ok(f.some(t => t.pattern === 'exec-concat' && t.severity === 'high'));
});

test('execSync template: high', () => {
  const f = scanFileContent('x.js', 'execSync(`rm -rf ${path}`);');
  assert.ok(f.some(t => t.pattern === 'exec-template'));
});

test('spawn shell:true + dynamic command: critical', () => {
  const f = scanFileContent('x.js', 'spawn(`sh -c ${cmd}`, { shell: true });');
  assert.ok(f.some(t => t.pattern === 'spawn-shell-true-concat' && t.severity === 'critical'));
});

test('spawn with array args: not flagged', () => {
  assert.equal(scanFileContent('x.js', 'spawn("ls", ["-la", dir]);').length, 0);
});

test('execFile with array args: not flagged', () => {
  assert.equal(scanFileContent('x.js', 'execFile("git", ["status"]);').length, 0);
});

test('static-literal exec: not flagged', () => {
  assert.equal(scanFileContent('x.js', 'exec("ls -la");').length, 0);
  assert.equal(scanFileContent('x.js', 'execSync(`node --version`);').length, 0);
});

test('RegExp.exec / parser.exec: not flagged', () => {
  assert.equal(scanFileContent('x.js', '/(\\d+)/.exec(input);').length, 0);
  assert.equal(scanFileContent('x.js', 'parser.exec(input);').length, 0);
});

test('bare-variable exec (out of scope): not flagged', () => {
  assert.equal(scanFileContent('x.js', 'exec(safeCommand);').length, 0);
});

test('finding schema: required fields', () => {
  const f = scanFileContent('x.js', 'exec("ping " + host);')[0];
  for (const key of ['id', 'rule', 'severity', 'category', 'file', 'line', 'title', 'blocks_apply']) {
    assert.ok(key in f, `missing field ${key}`);
  }
  assert.equal(f.rule, 'command-injection');
});

test('fixture manifest: recall + FP gate', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, 'manifest.json'), 'utf8'));
  let posCaught = 0, posTotal = 0, fp = 0, negTotal = 0;
  const missed = [];
  for (const e of manifest.entries) {
    const content = fs.readFileSync(path.join(FIXTURE_ROOT, e.file), 'utf8');
    const findings = scanFileContent(e.file, content);
    if (e.label === 'positive') { posTotal++; if (findings.length > 0) posCaught++; else missed.push(e.id); }
    else { negTotal++; if (findings.length > 0) fp++; }
  }
  assert.ok(posCaught / posTotal >= 0.95, `recall below 0.95; missed: ${missed.join(', ')}`);
  assert.ok(fp / negTotal <= 0.10, `FP rate above 0.10`);
});
