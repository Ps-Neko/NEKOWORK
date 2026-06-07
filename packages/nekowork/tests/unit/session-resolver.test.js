// session-resolver: 'latest' resolution + ambiguity error
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveSessionId, assertSafeSessionId } from '../../scripts/lib/session-resolver.js';
import { rmrf } from '../helpers/tmp.js';

function makeProjectWithSessions(names) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sess-resolver-'));
  for (const name of names) {
    fs.mkdirSync(path.join(root, '.harness', 'state', 'sessions', name), { recursive: true });
  }
  return root;
}

test('resolveSessionId: empty string returns empty string', () => {
  const root = makeProjectWithSessions([]);
  try {
    assert.equal(resolveSessionId(root, ''), '');
  } finally {
    rmrf(root);
  }
});

test('resolveSessionId: exact match returns that session name', () => {
  const root = makeProjectWithSessions(['abc-123', 'def-456']);
  try {
    assert.equal(resolveSessionId(root, 'abc-123'), 'abc-123');
  } finally {
    rmrf(root);
  }
});

test('resolveSessionId: latest returns the most-recently-modified session', () => {
  const root = makeProjectWithSessions([]);
  const sessionsDir = path.join(root, '.harness', 'state', 'sessions');
  // Create both sessions, then explicitly set mtime so the order is deterministic.
  fs.mkdirSync(path.join(sessionsDir, 'older'), { recursive: true });
  fs.mkdirSync(path.join(sessionsDir, 'newer'), { recursive: true });
  const past = new Date(Date.now() - 5000);
  const recent = new Date(Date.now() + 1000);
  fs.utimesSync(path.join(sessionsDir, 'older'), past, past);
  fs.utimesSync(path.join(sessionsDir, 'newer'), recent, recent);
  try {
    const resolved = resolveSessionId(root, 'latest');
    assert.equal(resolved, 'newer');
  } finally {
    rmrf(root);
  }
});

test('resolveSessionId: latest with no sessions returns "latest" unchanged', () => {
  const root = makeProjectWithSessions([]);
  try {
    assert.equal(resolveSessionId(root, 'latest'), 'latest');
  } finally {
    rmrf(root);
  }
});

test('resolveSessionId: ambiguous prefix throws with list of matches', () => {
  const root = makeProjectWithSessions(['session-alpha', 'session-beta']);
  try {
    assert.throws(
      () => resolveSessionId(root, 'session'),
      (err) => {
        assert.match(err.message, /ambiguous/i);
        assert.match(err.message, /session-alpha/);
        assert.match(err.message, /session-beta/);
        return true;
      }
    );
  } finally {
    rmrf(root);
  }
});

test('resolveSessionId: unmatched prefix returns input value unchanged', () => {
  const root = makeProjectWithSessions(['abc-123']);
  try {
    assert.equal(resolveSessionId(root, 'nonexistent'), 'nonexistent');
  } finally {
    rmrf(root);
  }
});

// ---------- R2-11: assertSafeSessionId path-traversal guard ----------

test('assertSafeSessionId: rejects .. traversal', () => {
  assert.throws(() => assertSafeSessionId('../escape'), /invalid session id/);
  assert.throws(() => assertSafeSessionId('a/../../etc'), /invalid session id/);
  assert.throws(() => assertSafeSessionId('..'), /invalid session id/);
});

test('assertSafeSessionId: rejects absolute paths', () => {
  assert.throws(() => assertSafeSessionId('/etc/passwd'), /invalid session id/);
});

test('assertSafeSessionId: accepts a normal session id', () => {
  assert.equal(assertSafeSessionId('sess-2026-06-07-abc'), 'sess-2026-06-07-abc');
  assert.equal(assertSafeSessionId('latest'), 'latest');
});
