import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmrf } from '../helpers/tmp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'ci', 'check-version.js');

function makeFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-check-version-'));
  fs.mkdirSync(path.join(root, 'scripts', 'ci'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(root, 'scripts', 'ci', 'check-version.js'));
  for (const [rel, contents] of Object.entries(files)) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'ci', 'check-version.js')], {
    encoding: 'utf8',
  });
}

test('check-version passes when VERSION, package.json, WORKING-CONTEXT, README all agree', () => {
  const root = makeFixture({
    'package.json': JSON.stringify({ name: 'x', version: '0.1.0-alpha.10' }, null, 2),
    'VERSION': '0.1.0-alpha.10\n',
    'WORKING-CONTEXT.md': '## Current Truth\n\n- 위치: `x` · 브랜치: `main`\n- 버전: `0.1.0-alpha.10` (note)\n',
    'README.md': 'Current repository version: `0.1.0-alpha.10` alpha candidate · Current npm alpha: `@x@0.1.0-alpha.9`\n',
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /check-version: ok/);
  } finally {
    rmrf(root);
  }
});

test('check-version fails when VERSION drifts from package.json', () => {
  const root = makeFixture({
    'package.json': JSON.stringify({ name: 'x', version: '0.1.0-alpha.10' }, null, 2),
    'VERSION': '0.1.0-alpha.1\n',
  });
  try {
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /VERSION \(0\.1\.0-alpha\.1\) does not match package\.json \(0\.1\.0-alpha\.10\)/);
  } finally {
    rmrf(root);
  }
});

test('check-version fails when WORKING-CONTEXT 버전 drifts from package.json', () => {
  const root = makeFixture({
    'package.json': JSON.stringify({ name: 'x', version: '0.1.0-alpha.10' }, null, 2),
    'VERSION': '0.1.0-alpha.10\n',
    'WORKING-CONTEXT.md': '- 버전: `0.0.2` (stale)\n',
  });
  try {
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /WORKING-CONTEXT\.md '버전: `0\.0\.2`'/);
  } finally {
    rmrf(root);
  }
});

test('check-version ignores WORKING-CONTEXT when 버전 line absent', () => {
  const root = makeFixture({
    'package.json': JSON.stringify({ name: 'x', version: '0.1.0-alpha.10' }, null, 2),
    'VERSION': '0.1.0-alpha.10\n',
    'WORKING-CONTEXT.md': '## Notes\n\nNo version line here.\n',
  });
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmrf(root);
  }
});
