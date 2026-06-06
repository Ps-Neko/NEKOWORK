import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveSessionId } from '@ps-neko/nekowork/scripts/lib/session-resolver.js';

function tmpProject(sessions) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-sess-'));
  const dir = path.join(root, '.harness', 'state', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of sessions) fs.mkdirSync(path.join(dir, s));
  return root;
}

test('resolveSessionId returns exact id when full match exists', () => {
  const root = tmpProject(['work-2026-05-13-a3f7']);
  assert.equal(resolveSessionId(root, 'work-2026-05-13-a3f7'), 'work-2026-05-13-a3f7');
});

test('resolveSessionId resolves unique prefix to full id', () => {
  const root = tmpProject(['work-2026-05-13-a3f7', 'work-2026-05-12-bbbb']);
  assert.equal(resolveSessionId(root, 'a3f7'), 'work-2026-05-13-a3f7');
});

test('resolveSessionId throws on ambiguous prefix', () => {
  const root = tmpProject(['work-2026-05-13-a3f7', 'work-2026-05-12-a3f8']);
  assert.throws(() => resolveSessionId(root, 'a3f'), /ambiguous/i);
});

test('resolveSessionId falls back to input when no match (legacy callers)', () => {
  const root = tmpProject(['work-2026-05-13-a3f7']);
  assert.equal(resolveSessionId(root, 'zzzz'), 'zzzz');
});

test('resolveSessionId latest still picks newest mtime', () => {
  const root = tmpProject([]);
  const dir = path.join(root, '.harness', 'state', 'sessions');
  fs.mkdirSync(path.join(dir, 'older'));
  fs.mkdirSync(path.join(dir, 'newer'));
  const newer = path.join(dir, 'newer');
  const future = Date.now() / 1000 + 100;
  fs.utimesSync(newer, future, future);
  assert.equal(resolveSessionId(root, 'latest'), 'newer');
});

test('resolveSessionId throws when broad substring matches multiple sessions', () => {
  const root = tmpProject([
    'work-2026-05-13-a3f7',
    'work-2026-05-12-bbbb',
    'review-2026-05-13-cccc',
  ]);
  assert.throws(() => resolveSessionId(root, '2026'), /ambiguous/i);
});
