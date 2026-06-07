import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFileContent } from '../../scripts/lib/rules/sql-injection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'sql-injection');

test('SELECT concat: high', () => {
  const f = scanFileContent('x.js', 'db.query("SELECT * FROM users WHERE id = " + id);');
  assert.ok(f.some(t => t.pattern === 'sql-concat' && t.severity === 'high'));
});

test('template interpolation: high', () => {
  const f = scanFileContent('x.js', 'db.query(`SELECT * FROM t WHERE x = ${req.body.x}`);');
  assert.ok(f.some(t => t.pattern === 'sql-template'));
});

test('DELETE concat with embedded single quote: high', () => {
  const f = scanFileContent('x.js', `conn.execute("DELETE FROM logs WHERE owner='" + name + "'");`);
  assert.ok(f.some(t => t.pattern === 'sql-concat'));
});

test('knex.raw template: high', () => {
  const f = scanFileContent('x.js', 'knex.raw(`SELECT * FROM x WHERE y = ${y}`);');
  assert.ok(f.some(t => t.pattern === 'sql-template'));
});

test('parameterized $1 + params: not flagged', () => {
  assert.equal(scanFileContent('x.js', 'db.query("SELECT * FROM users WHERE id = $1", [id]);').length, 0);
});

test('placeholder ? + params: not flagged', () => {
  assert.equal(scanFileContent('x.js', 'db.query("SELECT * FROM users WHERE id = ?", [id]);').length, 0);
});

test('static SQL: not flagged', () => {
  assert.equal(scanFileContent('x.js', 'db.query("SELECT 1");').length, 0);
});

test('ORM / builder calls: not flagged', () => {
  assert.equal(scanFileContent('x.js', 'repo.find({ where: { id } });').length, 0);
  assert.equal(scanFileContent('x.js', 'qb.where("id = :id", { id });').length, 0);
});

test('non-SQL query string concat: not flagged', () => {
  assert.equal(scanFileContent('x.js', 'logger.query("fetching " + name);').length, 0);
});

test('finding schema: required fields', () => {
  const f = scanFileContent('x.js', 'db.query("SELECT x FROM t WHERE id = " + id);')[0];
  for (const key of ['id', 'rule', 'severity', 'category', 'file', 'line', 'title', 'blocks_apply']) {
    assert.ok(key in f, `missing field ${key}`);
  }
  assert.equal(f.rule, 'sql-injection');
});

// --- Python ---

test('python f-string SQL into cursor.execute: high', () => {
  const f = scanFileContent('x.py', 'cursor.execute(f"SELECT * FROM users WHERE id = {uid}")');
  assert.ok(f.some(t => t.pattern === 'sql-py-fstring' && t.severity === 'high'));
});

test('python concat SQL into cursor.execute: high', () => {
  const f = scanFileContent('x.py', 'cur.execute("DELETE FROM t WHERE id = " + uid)');
  assert.ok(f.some(t => t.pattern === 'sql-concat'));
});

test('python %-format SQL into cursor.execute: high', () => {
  assert.ok(scanFileContent('x.py', 'cursor.execute("SELECT * FROM users WHERE id = %s" % uid)').some(t => t.pattern === 'sql-py-percent'));
  assert.ok(scanFileContent('x.py', `cur.execute("DELETE FROM t WHERE name = '%s'" % (name,))`).some(t => t.pattern === 'sql-py-percent'));
});

test('python parameterized 2-arg execute(sql, params): not flagged', () => {
  assert.equal(scanFileContent('x.py', 'cursor.execute("SELECT * FROM t WHERE id = %s", (id,))').length, 0);
  assert.equal(scanFileContent('x.py', 'cursor.execute("SELECT * FROM t WHERE id = %(id)s", {"id": id})').length, 0);
});

test('python static SQL: not flagged', () => {
  assert.equal(scanFileContent('x.py', 'cursor.execute("SELECT 1")').length, 0);
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
