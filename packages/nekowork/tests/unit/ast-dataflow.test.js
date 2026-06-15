import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
// Inter-procedural (intra-module): local-function return-taint resolution
// (arg-sensitive). Catches helpers that assemble the dangerous value.
// ---------------------------------------------------------------------------

test('XFN SQL: helper concats param into SQL, return flows into db.query() → flagged', () => {
  const r = a('function build(x){ return "SELECT * FROM u WHERE id="+x; } function h(req){ return db.query(build(req.id)); }');
  assert.ok(r.findings.some(f => f.rule === 'ast-sql-injection' && f.severity === 'high'));
});

test('XFN SQL: arrow helper (expression body) builds SQL from arg → flagged', () => {
  const r = a('const wrap=(s)=>"SELECT "+s; function h(req){ return conn.query(wrap(req.c)); }');
  assert.ok(rules(r).includes('ast-sql-injection'));
});

test('XFN CMD: helper assembles shell command, return flows into execSync() → flagged critical', () => {
  const r = a('function mk(p){ return "ls "+p; } function h(req){ return cp.execSync(mk(req.q)); }');
  assert.ok(r.findings.some(f => f.rule === 'ast-command-injection' && f.severity === 'critical'));
});

test('XFN EVAL: helper wraps input as code, return flows into eval() → flagged', () => {
  const r = a('function asm(c){ return "("+c+")"; } function h(i){ return eval(asm(i)); }');
  assert.ok(rules(r).includes('ast-eval-injection'));
});

test('XFN: nested helper chain (build → wrap) resolves through depth → flagged', () => {
  const r = a('function frag(x){ return "id="+x; } function build(x){ return "SELECT * FROM u WHERE "+frag(x); } function h(req){ return db.query(build(req.id)); }');
  assert.ok(rules(r).includes('ast-sql-injection'));
});

// Inter-procedural FP-safety: helper returns/identity/non-SQL/numeric.

test('XFN FP: helper returns a CONSTANT SQL string → clean', () => {
  const r = a('function build(){ return "SELECT 1"; } function h(){ return db.query(build()); }');
  assert.equal(r.findings.length, 0);
});

test('XFN FP: identity helper called with a CONSTANT arg (keyword present but non-dynamic) → clean', () => {
  const r = a('function id(x){ return x; } function h(){ return db.query(id("SELECT 1")); }');
  assert.equal(r.findings.length, 0);
});

test('XFN FP: parameterized query inside a helper, outer call static + params array → clean', () => {
  const r = a('function run(sql,p){ return db.query(sql,p); } function h(req){ return run("SELECT * FROM u WHERE id=$1",[req.id]); }');
  assert.equal(r.findings.length, 0);
});

test('XFN FP: helper builds a dynamic but NON-SQL string into emitter.query() → clean (keyword gate)', () => {
  const r = a('function build(x){ return "topic-"+x; } function h(req){ return emitter.query(build(req.id)); }');
  assert.equal(r.findings.length, 0);
});

test('XFN FP: numeric helper (add) with constant args, logged → clean', () => {
  const r = a('function add(a,b){ return a+b; } function h(){ const x=add(1,2); return console.log(x); }');
  assert.equal(r.findings.length, 0);
});

test('XFN FP: unknown/non-local call into db.query stays structurally dynamic with no text → clean', () => {
  const r = a('function h(req){ return db.query(externalBuild(req.id)); }');
  assert.equal(r.findings.length, 0);
});

test('XFN FP: recursive helper does not infinite-loop and stays clean (no recovered SQL keyword)', () => {
  const r = a('function rec(x){ return rec(x); } function h(req){ return db.query(rec(req.id)); }');
  assert.equal(r.findings.length, 0);
});

// ---------------------------------------------------------------------------
// Inter-procedural: sink-alias resolution (const X = obj.sinkMethod).
// ---------------------------------------------------------------------------

test('ALIAS SQL: const q=db.query; q("SELECT ..."+input) → ast-sql-injection high', () => {
  const r = a("const q=db.query; function h(req){ return q(\"SELECT * FROM t WHERE n='\"+req.n+\"'\"); }");
  assert.ok(r.findings.some(f => f.rule === 'ast-sql-injection' && f.severity === 'high'));
});

test('ALIAS CMD: const run=cp.execSync; run("rm -rf "+input) → ast-command-injection critical', () => {
  const r = a('const cp=require("child_process"); const run=cp.execSync; function h(req){ return run("rm -rf "+req.path); }');
  assert.ok(r.findings.some(f => f.rule === 'ast-command-injection' && f.severity === 'critical'));
});

test('ALIAS: sql alias fed a local helper return resolves arg-sensitively → flagged', () => {
  const r = a('const q=db.query; function build(x){ return "DELETE FROM logs WHERE id="+x; } function h(req){ return q(build(req.id)); }');
  assert.ok(rules(r).includes('ast-sql-injection'));
});

test('ALIAS FP: const run=console.log; run("SELECT "+x) is NOT a sink → clean', () => {
  const r = a('const run=console.log; function h(req){ return run("SELECT "+req.x); }');
  assert.equal(r.findings.length, 0);
});

test('ALIAS FP: sql alias fed a parameterized call (placeholder + params array) → clean', () => {
  const r = a('const q=db.query; function h(req){ return q("SELECT * FROM u WHERE id=$1",[req.id]); }');
  assert.equal(r.findings.length, 0);
});

test('ALIAS FP: sql alias fed a const-bound static query → clean', () => {
  const r = a('const q=db.query; function h(){ const s="SELECT 1"; return q(s); }');
  assert.equal(r.findings.length, 0);
});

test('ALIAS FP: reassigned binding is NOT treated as a stable sink alias → clean', () => {
  const r = a('let run=cp.execSync; run=console.log; function h(req){ return run("rm -rf "+req.path); }');
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

// SECURITY: 경로 탈출 차단 — diff 헤더 경로가 projectRoot 밖을 가리켜도 읽지 않는다.
test('RULE: scanDiff 가 projectRoot 밖 경로(../)를 거부(경로 탈출 차단)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-root-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-out-'));
  fs.writeFileSync(path.join(outside, 'evil.js'), 'function h(x){ const q="SELECT "+x; return db.query(q); }');
  const rel = path.relative(root, path.join(outside, 'evil.js')); // ../...-out-/evil.js
  const parsedDiff = { files: [{ path: rel, binary: false, status: 'modified' }] };
  assert.equal(scanDiff(parsedDiff, { projectRoot: root }).length, 0, 'projectRoot 밖 파일은 안 읽음');
});

// CRITICAL(결정성): staged 모드는 디스크가 아니라 staged 내용(git show :path)을 분석해야 한다.
test('RULE: scanDiff staged 모드는 디스크 아닌 staged 내용을 본다(디스크≠diff 회귀)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-staged-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', windowsHide: true });
  if (git('init', '-q').status !== 0) return; // git 없으면 skip
  git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  const file = 'svc.js';
  fs.writeFileSync(path.join(dir, file), 'function h(){ return 1; }\n'); // 양성 baseline
  git('add', '.'); git('commit', '-qm', 'base');
  fs.writeFileSync(path.join(dir, file), 'function h(x){ const q="SELECT "+x; return db.query(q); }\n'); // 악성
  git('add', file);                                            // staged = 악성
  fs.writeFileSync(path.join(dir, file), 'function h(){ return 1; }\n'); // working = 양성(디스크≠staged)
  const staged = scanDiff({ mode: 'staged', postRef: null, files: [{ path: file, binary: false, status: 'modified' }] }, { projectRoot: dir });
  assert.ok(staged.some(x => x.rule === 'ast-sql-injection'), 'staged 악성을 git show 로 읽어 탐지');
  const working = scanDiff({ mode: 'working', files: [{ path: file, binary: false, status: 'modified' }] }, { projectRoot: dir });
  assert.equal(working.length, 0, 'working 모드는 디스크(양성)를 읽음 — 모드 분기 확인');
});

// patch 모드: 디스크가 패치와 일치한다는 보장이 없으므로 AST 디스크 읽기를 건너뛴다(regex 룰은 유지).
test('RULE: scanDiff patch 모드는 AST 디스크 읽기를 건너뜀', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-patch-'));
  fs.writeFileSync(path.join(dir, 'p.js'), 'function h(x){ const q="SELECT "+x; return db.query(q); }');
  const parsedDiff = { mode: 'patch', files: [{ path: 'p.js', binary: false, status: 'modified' }] };
  assert.equal(scanDiff(parsedDiff, { projectRoot: dir }).length, 0);
});
