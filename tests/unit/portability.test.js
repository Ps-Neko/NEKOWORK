import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const HARNESS_ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCRIPT = path.join(HARNESS_ROOT, 'scripts', 'portability', 'simulate-port.js');

function run(args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args, '--json'], { encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('비존재 target → strategy=create', () => {
  const tmp = path.join(os.tmpdir(), 'harness-port-nonexistent-' + Date.now());
  const r = run(['--target', tmp, '--profile', 'core']);
  const report = JSON.parse(r.stdout);
  assert.equal(report.strategy.strategy, 'create');
});

test('빈 디렉터리 + git 없음 → strategy=init+submodule', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-port-empty-'));
  const r = run(['--target', tmp, '--profile', 'core']);
  const report = JSON.parse(r.stdout);
  assert.equal(report.strategy.strategy, 'init+submodule');
  assert.equal(report.inspection.exists, true);
  assert.equal(report.inspection.isGitRepo, false);
});

test('CLAUDE.md 존재 → conflict medium 발견', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-port-claudemd-'));
  fs.mkdirSync(path.join(tmp, '.git')); // git repo 시늉
  fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), '# 기존 사용자 CLAUDE.md\n자유 본문');
  const r = run(['--target', tmp, '--profile', 'core']);
  const report = JSON.parse(r.stdout);
  assert.equal(report.strategy.strategy, 'submodule');
  assert.ok(report.conflicts.some(c => c.file === 'CLAUDE.md' && c.severity === 'medium'));
});

test('.mcp.json 존재 → conflict high', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-port-mcp-'));
  fs.mkdirSync(path.join(tmp, '.git'));
  fs.writeFileSync(path.join(tmp, '.mcp.json'), '{"mcpServers":{}}');
  const r = run(['--target', tmp, '--profile', 'core']);
  const report = JSON.parse(r.stdout);
  assert.ok(report.conflicts.some(c => c.file === '.mcp.json' && c.severity === 'high'));
});

test('plan / harness_version / wouldAdd 존재', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-port-plan-'));
  const r = run(['--target', tmp, '--profile', 'developer']);
  const report = JSON.parse(r.stdout);
  assert.ok(report.harness_version);
  assert.ok(report.plan.component_count > 0);
  assert.ok(Array.isArray(report.wouldAdd));
  assert.equal(report.note, 'dry-run only');
});
