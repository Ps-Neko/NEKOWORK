// project-detector: detectProject() decides which verification commands are
// available for a directory. This is load-bearing for verify-pr — hasTests
// flips a source-only change between ALLOW and INSUFFICIENT_EVIDENCE (it feeds
// describeChecks()). Tests run against temp dirs under os.tmpdir().

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectProject } from '../../scripts/lib/project-detector.js';
import { rmrf } from '../helpers/tmp.js';

// Make a temp dir seeded with files (relative path → content).
function makeDir(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-detect-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

test('detectProject: node package.json with test+lint+typecheck scripts → all true', () => {
  const dir = makeDir({
    'package.json': JSON.stringify({
      name: 'x',
      scripts: { test: 'node --test', lint: 'eslint .', typecheck: 'tsc --noEmit', build: 'tsc' },
    }),
  });
  try {
    const p = detectProject(dir);
    assert.equal(p.projectType, 'node');
    assert.equal(p.hasTests, true);
    assert.equal(p.hasLint, true);
    assert.equal(p.hasTypecheck, true);
    assert.equal(p.hasBuild, true);
    // these booleans are exactly what describeChecks() reads
    assert.ok(p.commands.test, 'a test command string is derived');
  } finally {
    rmrf(dir);
  }
});

test('detectProject: no package.json (and no language markers) → all checks false', () => {
  const dir = makeDir({ 'notes.txt': 'just a text file\n' });
  try {
    const p = detectProject(dir);
    assert.equal(p.projectType, 'unknown');
    assert.equal(p.hasTests, false);
    assert.equal(p.hasLint, false);
    assert.equal(p.hasTypecheck, false);
    assert.equal(p.hasBuild, false);
    assert.equal(p.commands.test, null);
  } finally {
    rmrf(dir);
  }
});

test('detectProject: package.json with UTF-8 BOM → scripts still detected', () => {
  // Windows PowerShell 5.1's default `-Encoding utf8` writes a BOM (EF BB BF).
  // npm itself accepts a BOM'd package.json, so `npm test` works while a naive
  // JSON.parse throws on the leading U+FEFF — silently flipping hasTests to
  // false and a clean source change from "test detected" to "no test command".
  const dir = makeDir({
    'package.json': '\uFEFF' + JSON.stringify({
      name: 'x',
      scripts: { test: 'node --test' },
    }),
  });
  try {
    const p = detectProject(dir);
    assert.equal(p.projectType, 'node');
    assert.equal(p.hasTests, true, 'BOM must not hide the test script');
    assert.equal(p.commands.test, 'npm test');
  } finally {
    rmrf(dir);
  }
});

test('detectProject: node package.json with no scripts → hasTests false (the INSUFFICIENT_EVIDENCE trigger)', () => {
  const dir = makeDir({ 'package.json': JSON.stringify({ name: 'x', version: '1.0.0' }) });
  try {
    const p = detectProject(dir);
    assert.equal(p.projectType, 'node');
    assert.equal(p.hasTests, false, 'no test script → hasTests false');
    assert.equal(p.commands.test, null);
  } finally {
    rmrf(dir);
  }
});

test('detectProject: tsconfig.json (no typecheck script) → hasTypecheck true via tsc fallback', () => {
  const dir = makeDir({
    'package.json': JSON.stringify({ name: 'x', scripts: { build: 'tsc' } }),
    'tsconfig.json': '{ "compilerOptions": {} }',
  });
  try {
    const p = detectProject(dir);
    assert.equal(p.hasTypecheck, true, 'tsconfig.json implies a typecheck path');
    assert.match(p.commands.typecheck, /tsc/, 'falls back to npx tsc --noEmit');
  } finally {
    rmrf(dir);
  }
});

test('detectProject: python project with pytest tests dir → hasTests true', () => {
  const dir = makeDir({
    'pyproject.toml': '[project]\nname = "demo"\n',
    'tests/test_demo.py': 'def test_ok():\n    assert True\n',
  });
  try {
    const p = detectProject(dir);
    assert.equal(p.projectType, 'python');
    assert.equal(p.hasTests, true, 'a tests/ dir makes pytest available');
    assert.match(p.commands.test, /pytest/);
  } finally {
    rmrf(dir);
  }
});

test('detectProject: python project with ruff + mypy config → hasLint/hasTypecheck true', () => {
  const dir = makeDir({
    'pyproject.toml': '[project]\nname = "demo"\n',
    'ruff.toml': 'line-length = 100\n',
    'mypy.ini': '[mypy]\n',
  });
  try {
    const p = detectProject(dir);
    assert.equal(p.projectType, 'python');
    assert.equal(p.hasLint, true);
    assert.equal(p.hasTypecheck, true);
  } finally {
    rmrf(dir);
  }
});

test('detectProject: package manager inferred from lockfile', () => {
  const dir = makeDir({
    'package.json': JSON.stringify({ name: 'x', scripts: { test: 'jest' } }),
    'pnpm-lock.yaml': 'lockfileVersion: 9\n',
  });
  try {
    const p = detectProject(dir);
    assert.equal(p.packageManager, 'pnpm');
    assert.match(p.commands.test, /^pnpm /, 'test command uses the detected package manager');
  } finally {
    rmrf(dir);
  }
});

test('detectProject: detects CI workflow files', () => {
  const dir = makeDir({
    'package.json': JSON.stringify({ name: 'x' }),
    '.github/workflows/ci.yml': 'name: ci\non: push\n',
  });
  try {
    const p = detectProject(dir);
    assert.equal(p.hasCi, true);
    assert.ok(p.ciFiles.includes('.github/workflows'), 'github workflows dir recorded');
  } finally {
    rmrf(dir);
  }
});
