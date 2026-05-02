import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveCli } from '../../scripts/core/cli-resolver.js';
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

test('subprocess collector passes stdin and captures stdout', async () => {
  const stdout = await spawnAndCollect(
    process.execPath,
    ['-e', 'process.stdin.pipe(process.stdout)'],
    'hello',
    { label: 'node-smoke', timeoutMs: 5000 }
  );
  assert.equal(stdout, 'hello');
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
