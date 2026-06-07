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

// --- Python ---

test('python subprocess.run shell=True + f-string command: critical', () => {
  const f = scanFileContent('x.py', 'subprocess.run(f"git checkout {branch}", shell=True)');
  assert.ok(f.some(t => t.pattern === 'py-subprocess-shell-true' && t.severity === 'critical'));
});

test('python subprocess.call/Popen shell=True + concat/variable: critical', () => {
  assert.ok(scanFileContent('x.py', 'subprocess.call("rm -rf " + path, shell=True)').some(t => t.pattern === 'py-subprocess-shell-true'));
  assert.ok(scanFileContent('x.py', 'subprocess.Popen(cmd, shell=True)').some(t => t.pattern === 'py-subprocess-shell-true'));
});

test('python os.system with dynamic command: critical', () => {
  assert.ok(scanFileContent('x.py', 'os.system(f"rm -rf {path}")').some(t => t.pattern === 'py-os-system' && t.severity === 'critical'));
  assert.ok(scanFileContent('x.py', 'os.system("tar " + name)').some(t => t.pattern === 'py-os-system'));
});

test('python os.popen with dynamic command: high', () => {
  assert.ok(scanFileContent('x.py', 'os.popen(f"ls {dir}")').some(t => t.pattern === 'py-os-popen'));
  assert.ok(scanFileContent('x.py', 'os.popen("grep " + pat)').some(t => t.pattern === 'py-os-popen'));
  assert.ok(scanFileContent('x.py', 'result = os.popen(cmd)').some(t => t.pattern === 'py-os-popen'));
});

test('python subprocess list args / shell=False: not flagged', () => {
  assert.equal(scanFileContent('x.py', 'subprocess.run(["ls", "-la", dir])').length, 0);
  assert.equal(scanFileContent('x.py', 'subprocess.run("ls", shell=False)').length, 0);
});

test('python os.system with static literal: not flagged', () => {
  assert.equal(scanFileContent('x.py', 'os.system("ls -la")').length, 0);
  assert.equal(scanFileContent('x.py', 'os.popen("ls -la")').length, 0);
});

// --- Go ---

test('go exec.Command sh/bash -c with dynamic command: critical', () => {
  assert.ok(scanFileContent('x.go', 'exec.Command("sh", "-c", "tar " + name)').some(t => t.pattern === 'go-exec-shell-c' && t.severity === 'critical'));
  assert.ok(scanFileContent('x.go', 'exec.Command("bash", "-c", fmt.Sprintf("rm %s", path))').some(t => t.pattern === 'go-exec-shell-c'));
  assert.ok(scanFileContent('x.go', 'exec.Command("sh", "-c", cmd)').some(t => t.pattern === 'go-exec-shell-c'));
});

test('go exec.Command with arg array (no shell): not flagged', () => {
  assert.equal(scanFileContent('x.go', 'exec.Command("ls", "-la")').length, 0);
  assert.equal(scanFileContent('x.go', 'exec.Command("git", "checkout", branch)').length, 0);
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
