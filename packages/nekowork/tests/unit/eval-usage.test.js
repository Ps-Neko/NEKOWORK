import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFileContent } from '../../scripts/lib/rules/eval-usage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'eval-usage');

test('eval(variable): high', () => {
  const f = scanFileContent('x.js', 'export const r = eval(userInput);');
  assert.equal(f.length, 1);
  assert.equal(f[0].pattern, 'eval-call');
  assert.equal(f[0].severity, 'high');
});

test('eval(concatenation): high', () => {
  const f = scanFileContent('x.js', 'const r = eval("return " + expr);');
  assert.equal(f[0].pattern, 'eval-call');
});

test('new Function(...): high', () => {
  const f = scanFileContent('x.js', 'const fn = new Function("a", body);');
  assert.equal(f[0].pattern, 'new-function-constructor');
});

test('eval of pure static literal: not flagged', () => {
  const f = scanFileContent('x.js', 'const r = eval("1 + 1");');
  assert.equal(f.length, 0);
});

test('eval in comment / property access: not flagged', () => {
  const f = scanFileContent('x.js', '// do not use eval()\nconst v = obj.eval;\nconst retrieval = 1;');
  assert.equal(f.length, 0);
});

test('finding schema: required fields', () => {
  const f = scanFileContent('x.js', 'eval(input);')[0];
  for (const key of ['id', 'rule', 'severity', 'category', 'file', 'line', 'title', 'blocks_apply']) {
    assert.ok(key in f, `missing field ${key}`);
  }
  assert.equal(f.rule, 'eval-usage');
});

test('indirect global eval (window.eval): high', () => {
  const f = scanFileContent('x.js', 'window.eval(userCode);');
  assert.ok(f.some(x => x.pattern === 'indirect-global-eval' && x.severity === 'high'));
});

test('indirect global eval (globalThis/self/global): high', () => {
  for (const g of ['globalThis', 'self', 'global']) {
    const f = scanFileContent('x.js', `${g}.eval(payload);`);
    assert.ok(f.some(x => x.pattern === 'indirect-global-eval'), `${g}.eval should fire`);
  }
});

test('Node vm.runInNewContext: high', () => {
  const f = scanFileContent('x.js', 'vm.runInNewContext(code, ctx);');
  assert.ok(f.some(x => x.pattern === 'node-vm-run'));
});

test('Node vm compileFunction / runInThisContext / runInContext: high', () => {
  for (const fn of ['runInThisContext', 'runInContext', 'compileFunction']) {
    const f = scanFileContent('x.js', `vm.${fn}(src);`);
    assert.ok(f.some(x => x.pattern === 'node-vm-run'), `vm.${fn} should fire`);
  }
});

test('setTimeout/setInterval with string arg: high', () => {
  assert.ok(scanFileContent('x.js', 'setTimeout("tick()", 100);').some(x => x.pattern === 'timer-string-eval'));
  assert.ok(scanFileContent('x.js', "setInterval('poll()', 1000);").some(x => x.pattern === 'timer-string-eval'));
});

test('setTimeout with function reference: not flagged', () => {
  assert.equal(scanFileContent('x.js', 'setTimeout(fn, 100);').length, 0);
  assert.equal(scanFileContent('x.js', 'setInterval(() => tick(), 1000);').length, 0);
});

test('window.location / *.eval lookalikes: not flagged', () => {
  const f = scanFileContent('x.js', 'const h = window.location.href; const o = myvm.runSomething(x);');
  assert.equal(f.length, 0);
});

// --- Python ---

test('python eval(variable): high (eval-call token is language-agnostic)', () => {
  const f = scanFileContent('x.py', 'result = eval(expression)');
  assert.ok(f.some(t => t.pattern === 'eval-call' && t.severity === 'high'));
});

test('python exec(variable / f-string): high', () => {
  assert.ok(scanFileContent('x.py', 'exec(code)').some(t => t.pattern === 'exec-call' && t.severity === 'high'));
  assert.ok(scanFileContent('x.py', 'exec(f"{name} = {value}")').some(t => t.pattern === 'exec-call'));
  assert.ok(scanFileContent('x.py', 'exec("x = " + val)').some(t => t.pattern === 'exec-call'));
});

test('python ast.literal_eval (the SAFE alternative): not flagged', () => {
  assert.equal(scanFileContent('x.py', 'ast.literal_eval(raw)').length, 0);
  assert.equal(scanFileContent('x.py', 'literal_eval(raw)').length, 0);
});

test('python static eval / exec literal: not flagged', () => {
  assert.equal(scanFileContent('x.py', 'eval("1 + 1")').length, 0);
  assert.equal(scanFileContent('x.py', 'exec("pass")').length, 0);
});

test('exec member calls (RegExp.exec / cursor.exec): not flagged by exec-call', () => {
  assert.ok(!scanFileContent('x.js', '/(\\d+)/.exec(input);').some(t => t.pattern === 'exec-call'));
  assert.ok(!scanFileContent('x.js', 'cursor.exec(query);').some(t => t.pattern === 'exec-call'));
});

test('fixture manifest: recall + FP gate', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, 'manifest.json'), 'utf8'));
  let posCaught = 0, posTotal = 0, fp = 0, negTotal = 0;
  const missed = [];
  for (const e of manifest.entries) {
    const content = fs.readFileSync(path.join(FIXTURE_ROOT, e.file), 'utf8');
    const findings = scanFileContent(e.file, content);
    if (e.label === 'positive') {
      posTotal++;
      if (findings.length > 0) posCaught++; else missed.push(e.id);
    } else {
      negTotal++;
      if (findings.length > 0) fp++;
    }
  }
  const recall = posCaught / posTotal;
  assert.ok(recall >= 0.95, `recall ${recall.toFixed(2)} below 0.95; missed: ${missed.join(', ')}`);
  assert.ok(fp / negTotal <= 0.10, `FP rate above 0.10`);
});
