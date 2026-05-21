import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isPathInside, resolveCli, resolveProviderCli } from '../../scripts/core/cli-resolver.js';
import { extractJson } from '../../scripts/core/json-extractor.js';
import { spawnAndCollect } from '../../scripts/core/subprocess.js';

test('core json extractor handles fenced and raw JSON', () => {
  assert.equal(extractJson('```json\n{"ok":true}\n```'), '{"ok":true}');
  assert.equal(extractJson('noise {"ok":"}"} tail'), '{"ok":"}"}');
  assert.equal(extractJson('none'), null);
});

test('cli resolver finds platform command shims', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-resolver-'));
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const file = path.join(tmp, `sample${ext}`);
  fs.writeFileSync(file, process.platform === 'win32' ? '@echo off\r\n' : '#!/bin/sh\n');

  const resolved = resolveCli('sample', {
    PATH: tmp,
    PATHEXT: '.CMD;.EXE',
  });
  assert.equal(resolved, file);
});

test('provider cli resolver blocks workspace-local shims by default', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-provider-cli-root-'));
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const file = path.join(root, `codex${ext}`);
  fs.writeFileSync(file, process.platform === 'win32' ? '@echo off\r\n' : '#!/bin/sh\n');

  assert.throws(
    () => resolveProviderCli('codex', {
      root,
      env: { PATH: root, PATHEXT: '.CMD;.EXE' },
    }),
    /current workspace/
  );
});

test('provider cli resolver checks every trust root', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-provider-project-root-'));
  const harnessRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-provider-tool-root-'));
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const file = path.join(harnessRoot, `claude${ext}`);
  fs.writeFileSync(file, process.platform === 'win32' ? '@echo off\r\n' : '#!/bin/sh\n');

  assert.throws(
    () => resolveProviderCli('claude', {
      root: projectRoot,
      roots: [projectRoot, harnessRoot],
      env: { PATH: harnessRoot, PATHEXT: '.CMD;.EXE' },
    }),
    /current workspace/
  );
});

test('provider cli resolver allows workspace-local shims with explicit opt-in', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-provider-cli-allow-'));
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const file = path.join(root, `codex${ext}`);
  fs.writeFileSync(file, process.platform === 'win32' ? '@echo off\r\n' : '#!/bin/sh\n');

  const resolved = resolveProviderCli('codex', {
    root,
    env: {
      PATH: root,
      PATHEXT: '.CMD;.EXE',
      HARNESS_CODEX_ALLOW_WORKSPACE_BIN: '1',
    },
  });
  assert.equal(resolved, file);
});

test('path containment treats sibling paths as outside', () => {
  const root = path.join(os.tmpdir(), 'harness-root');
  assert.equal(isPathInside(root, path.join(root, 'node_modules', '.bin', 'codex')), true);
  assert.equal(isPathInside(root, path.join(os.tmpdir(), 'harness-root-sibling', 'codex')), false);
});

test('subprocess collector passes stdin and captures stdout', async () => {
  const stdout = await spawnAndCollect(
    process.execPath,
    ['-e', 'process.stdin.pipe(process.stdout)'],
    'hello',
    { label: 'node-smoke', timeoutMs: 5000 }
  );
  assert.equal(stdout, 'hello');
});

test('subprocess collector can run in an explicit cwd', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-subprocess-cwd-'));
  const stdout = await spawnAndCollect(
    process.execPath,
    ['-e', 'process.stdout.write(process.cwd())'],
    '',
    { label: 'node-cwd-smoke', timeoutMs: 5000, cwd: tmp }
  );
  assert.equal(path.resolve(stdout), path.resolve(tmp));
});

test('subprocess collector rejects nonzero exit with stderr', async () => {
  await assert.rejects(
    () => spawnAndCollect(
      process.execPath,
      ['-e', 'console.error("bad"); process.exit(7)'],
      '',
      { label: 'node-smoke', timeoutMs: 5000 }
    ),
    /node-smoke exit 7[\s\S]*bad/
  );
});
