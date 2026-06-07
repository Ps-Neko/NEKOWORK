import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from '../../scripts/lib/ast/analyze.js';
import { parseToAst, walk, isTsPath } from '../../scripts/lib/ast/parse.js';
import { scanFileContent, scanDiff, isAnalyzablePath } from '../../scripts/lib/rules/ast-dataflow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'ast-dataflow');

const a = (code, opts) => analyze(code, opts && opts.file ? opts.file : 'x.js', opts || {});
const rules = (r) => r.findings.map(f => f.rule);

// ---------------------------------------------------------------------------
// parse.js primitives
// ---------------------------------------------------------------------------

test('parse: returns an ESTree Program for valid JS', () => {
  const ast = parseToAst('const x = 1;');
  assert.equal(ast.type, 'Program');
});

test('parse: returns null on syntax error (caller falls back to regex)', () => {
  assert.equal(parseToAst('const = = =;'), null);
});

test('parse: strips TS types when ts:true (and does not throw)', () => {
  const ast = parseToAst('const x: number = 1; function f(a: string): void {}', { ts: true });
  assert.equal(ast.type, 'Program');
});

test('parse: script-mode fallback parses top-level return', () => {
  const ast = parseToAst('return 42;');
  assert.equal(ast.type, 'Program');
});

test('parse: isTsPath classifies extensions', () => {
  assert.equal(isTsPath('a.ts'), true);
  assert.equal(isTsPath('a.tsx'), true);
  assert.equal(isTsPath('a.mts'), true);
  assert.equal(isTsPath('a.js'), false);
});

test('walk: visits every node and does not loop on __parent', () => {
  const ast = parseToAst('const q = "SELECT 1"; db.query(q);');
  let calls = 0;
  walk(ast, () => { calls++; });
  assert.ok(calls > 5);
});

// ---------------------------------------------------------------------------
// SQL sink — positives (variable-mediated, regex misses)
// ---------------------------------------------------------------------------

test('SQL: concat bound to var then query() → ast-sql-injection high', () => {
  const r = a('function h(req){ const id=req.params.id; const q="SELECT * FROM u WHERE id="+id; return db.query(q); }');
  assert.ok(r.findings.some(f => f.rule === 'ast-sql-injection' && f.severity === 'high'));
});

test('SQL: template ${} bound to var then execute()', () => {
  const r = a('function h(req){ const n=req.body.n; const s=`SELECT * FROM u WHERE n=${n}`; return db.execute(s); }');
  assert.ok(rules(r).includes('ast-sql-injection'));
});

test('SQL: knex.raw with assembled template via var', () => {
  const r = a('function h(uid){ const s=`SELECT * FROM a WHERE id=${uid}`; return knex.raw(s); }');
  assert.ok(rules(r).includes('ast-sql-injection'));
});

test('SQL: concat chain across statements', () => {
  const r = a('function h(owner){ const base = "DELETE FROM logs WHERE owner = "; const w = base + owner; return conn.execute(w); }');
  assert.ok(rules(r).includes('ast-sql-injection'));
});

// ---------------------------------------------------------------------------
// SQL sink — FP-safety (must NOT flag)
// ---------------------------------------------------------------------------

test('SQL FP: parameterized $1 + params array → clean', () => {
  const r = a('function h(id){ return db.query("SELECT * FROM u WHERE id=$1",[id]); }');
  assert.equal(r.findings.length, 0);
});

test('SQL FP: static literal query → clean', () => {
  const r = a('function h(){ return db.execute("SELECT 1"); }');
  assert.equal(r.findings.length, 0);
});

test('SQL FP (CONST-PROPAGATION, the prototype FP): const q=`SELECT 1`; query(q) → clean', () => {
  const r = a('function h(){ const q=`SELECT 1`; return db.query(q); }');
  assert.equal(r.findings.length, 0);
});

test('SQL FP: concat of only literals (no var) is const-safe → clean', () => {
  const r = a('function h(){ const q="CREATE TABLE "+"t"+" (id INT)"; return db.query(q); }');
  assert.equal(r.findings.length, 0);
});

test('SQL FP: ORM builder where() → clean', () => {
  const r = a('function h(id){ return qb.where("id = :id",{id}).getMany(); }');
  assert.equal(r.findings.length, 0);
});

test('SQL FP: dynamic but NON-SQL .query() (no DML keyword) → clean', () => {
  const r = a('function h(name){ const ev="fetching "+name; return emitter.query(ev); }');
  assert.equal(r.findings.length, 0);
});

test('SQL FP: bare unknown identifier to query() → clean (conservative)', () => {
  const r = a('db.query(someExternalSql);');
  assert.equal(r.findings.length, 0);
});

// ---------------------------------------------------------------------------
// Command sink — positives
// ---------------------------------------------------------------------------

test('CMD: execSync of concatenated command var → ast-command-injection critical', () => {
  const r = a('function run(p){ const cmd="ls "+p; return cp.execSync(cmd); }');
  assert.ok(r.findings.some(f => f.rule === 'ast-command-injection' && f.severity === 'critical'));
});

test('CMD: exec (destructured) of template command var', () => {
  const r = a('function ping(host){ const c=`ping ${host}`; exec(c); }');
  assert.ok(rules(r).includes('ast-command-injection'));
});

test('CMD: spawn shell:true with concatenated command var', () => {
  const r = a('function run(repo){ const cmd="git clone "+repo; return spawn(cmd,{shell:true}); }');
  assert.ok(rules(r).includes('ast-command-injection'));
});

test('CMD: function parameter flows into execSync via temp', () => {
  const r = a('function gitLog(branch){ const c="git log "+branch; return execSync(c); }');
  assert.ok(rules(r).includes('ast-command-injection'));
});

// ---------------------------------------------------------------------------
// Command sink — FP-safety
// ---------------------------------------------------------------------------

test('CMD FP: execFile with arg array → clean', () => {
  const r = a('function h(dir){ execFile("ls",["-la",dir]); }');
  assert.equal(r.findings.length, 0);
});

test('CMD FP: spawn static cmd + arg array, no shell → clean', () => {
  const r = a('function h(repo){ return spawn("git",["clone",repo]); }');
  assert.equal(r.findings.length, 0);
});

test('CMD FP: spawn shell:false with dynamic command → clean', () => {
  const r = a('function h(prog,dir){ return spawn(prog,["--cwd",dir],{shell:false}); }');
  assert.equal(r.findings.length, 0);
});

test('CMD FP: exec of a const-bound static command → clean', () => {
  const r = a('function h(){ const cmd="git status"; return exec(cmd); }');
  assert.equal(r.findings.length, 0);
});

test('CMD FP: spawn with dynamic cmd but NO shell:true → clean', () => {
  const r = a('function h(repo){ const cmd="git clone "+repo; return spawn(cmd); }');
  assert.equal(r.findings.length, 0);
});

// ---------------------------------------------------------------------------
// Eval sink — positives
// ---------------------------------------------------------------------------

test('EVAL: eval of assembled string → ast-eval-injection high', () => {
  const r = a('function f(code){ const p="("+code+")"; return eval(p); }');
  assert.ok(r.findings.some(f => f.rule === 'ast-eval-injection' && f.severity === 'high'));
});

test('EVAL: eval of template var', () => {
  const r = a('function f(name){ const c=`h.${name}()`; return eval(c); }');
  assert.ok(rules(r).includes('ast-eval-injection'));
});

test('EVAL: new Function with assembled body', () => {
  const r = a('function f(expr){ const body="return "+expr; return new Function("x",body); }');
  assert.ok(rules(r).includes('ast-eval-injection'));
});

test('EVAL: indirect globalThis.eval of assembled string', () => {
  const r = a('function f(src){ const w="var z="+src; return globalThis.eval(w); }');
  assert.ok(rules(r).includes('ast-eval-injection'));
});

// ---------------------------------------------------------------------------
// Eval sink — FP-safety
// ---------------------------------------------------------------------------

test('EVAL FP: eval of a const-bound pure literal → clean', () => {
  const r = a('function f(){ const code="1 + 2"; return eval(code); }');
  assert.equal(r.findings.length, 0);
});

test('EVAL FP: dynamic strings → JSON.parse (not a code sink) → clean', () => {
  const r = a('function f(raw){ const w="{"+raw+"}"; return JSON.parse(w); }');
  assert.equal(r.findings.length, 0);
});

test('EVAL FP: eval of a pure inline literal → clean', () => {
  const r = a('eval("1 + 1");');
  assert.equal(r.findings.length, 0);
});

// ---------------------------------------------------------------------------
// Intraprocedural boundary + reassignment propagation
// ---------------------------------------------------------------------------

test('SCOPE: a const-safe binding demoted by a dynamic reassignment is flagged', () => {
  const r = a('function h(x){ let q="SELECT 1"; q=q+x; return db.query(q); }');
  assert.ok(rules(r).includes('ast-sql-injection'));
});

test('SCOPE: same-named var in different functions does not cross-contaminate', () => {
  const code = 'function safe(){ const q="SELECT 1"; return db.query(q); } function risky(x){ const q="SELECT "+x; return db.query(q); }';
  const r = a(code);
  // Only the risky function should produce a finding (one finding total).
  assert.equal(r.findings.filter(f => f.rule === 'ast-sql-injection').length, 1);
});

test('SCOPE: intraprocedural only — dynamic value built in another function is not chased', () => {
  const code = 'function build(p,s){ return "SELECT * FROM "+p+s; } function h(t){ const name=mk("a","b"); return db.query(t); }';
  const r = a(code);
  assert.equal(r.findings.length, 0);
});

// ---------------------------------------------------------------------------
// TS stripping (offsets preserved → correct line numbers)
// ---------------------------------------------------------------------------

test('TS: type annotations stripped, finding line maps to original source', () => {
  const code = [
    'export function f(req: Req): Promise<unknown> {',          // 1
    '  const name: string = req.body.name;',                    // 2
    '  const sql: string = `SELECT * FROM u WHERE n=${name}`;', // 3
    '  return db.execute(sql);',                                // 4
    '}',                                                        // 5
  ].join('\n');
  const r = analyze(code, 'h.ts', { ts: true });
  const f = r.findings.find(x => x.rule === 'ast-sql-injection');
  assert.ok(f, 'expected a SQL finding');
  assert.equal(f.line, 4); // the db.execute(sql) call line
});

// ---------------------------------------------------------------------------
// Finding shape parity with regex rules
// ---------------------------------------------------------------------------

test('SHAPE: finding has the regex-rule fields', () => {
  const r = a('function h(x){ const q="SELECT "+x; return db.query(q); }');
  const f = r.findings[0];
  for (const k of ['rule', 'title', 'severity', 'file', 'line', 'blocks_apply', 'description', 'recommendation']) {
    assert.ok(k in f, `missing field ${k}`);
  }
  assert.equal(f.file, 'x.js');
  assert.equal(typeof f.line, 'number');
});

test('SHAPE: command finding (critical) sets blocks_apply=true; SQL/eval (high) false', () => {
  const cmd = a('function r(p){ const c="ls "+p; return execSync(c); }').findings[0];
  assert.equal(cmd.severity, 'critical');
  assert.equal(cmd.blocks_apply, true);
  const sql = a('function r(p){ const c="SELECT "+p; return db.query(c); }').findings[0];
  assert.equal(sql.severity, 'high');
  assert.equal(sql.blocks_apply, false);
});

// ---------------------------------------------------------------------------
// Rule surface: scanFileContent + scanDiff
// ---------------------------------------------------------------------------

test('RULE: isAnalyzablePath accepts JS/TS family, rejects others', () => {
  assert.equal(isAnalyzablePath('a.ts'), true);
  assert.equal(isAnalyzablePath('a.cjs'), true);
  assert.equal(isAnalyzablePath('a.py'), false);
  assert.equal(isAnalyzablePath('a.md'), false);
});

test('RULE: scanFileContent skips non-JS/TS paths', () => {
  assert.equal(scanFileContent('a.py', 'cursor.execute("SELECT "+x)').length, 0);
});

test('RULE: scanFileContent flags a TS fixture', () => {
  const file = 'positive/sql-002-template-var.ts';
  const content = fs.readFileSync(path.join(FIXTURE_ROOT, file), 'utf8');
  const f = scanFileContent(file, content);
  assert.ok(f.some(x => x.rule === 'ast-sql-injection'));
});

test('RULE: scanDiff with no projectRoot no-ops (returns [])', () => {
  const parsedDiff = { files: [{ path: 'x.js', binary: false, status: 'modified' }] };
  assert.equal(scanDiff(parsedDiff).length, 0);
});

test('RULE: scanDiff reads full file from disk and flags it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-dataflow-'));
  fs.writeFileSync(path.join(dir, 'svc.js'), 'function h(x){ const q="SELECT "+x; return db.query(q); }');
  const parsedDiff = { files: [{ path: 'svc.js', binary: false, status: 'modified' }] };
  const f = scanDiff(parsedDiff, { projectRoot: dir });
  assert.ok(f.some(x => x.rule === 'ast-sql-injection'));
});

test('RULE: scanDiff skips deleted files and unreadable paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-dataflow-'));
  const parsedDiff = { files: [
    { path: 'gone.js', binary: false, status: 'deleted' },
    { path: 'missing.js', binary: false, status: 'modified' },
  ] };
  assert.equal(scanDiff(parsedDiff, { projectRoot: dir }).length, 0);
});

test('RULE: scanDiff skips binary files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-dataflow-'));
  fs.writeFileSync(path.join(dir, 'b.js'), 'function h(x){ const q="SELECT "+x; db.query(q); }');
  const parsedDiff = { files: [{ path: 'b.js', binary: true, status: 'modified' }] };
  assert.equal(scanDiff(parsedDiff, { projectRoot: dir }).length, 0);
});
