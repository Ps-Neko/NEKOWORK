import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFlags } from '../../scripts/lib/flag-normalize.js';

test('--pack alias rewrites to --profile and warns', () => {
  const warns = [];
  const out = normalizeFlags(['--pack', 'quality'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--profile', 'quality']);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /--pack.*deprecated.*--profile/);
});

test('--secure alias adds --profile security when none set', () => {
  const warns = [];
  const out = normalizeFlags(['--secure'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--profile', 'security']);
  assert.equal(warns.length, 1);
});

test('--secure is ignored (warn-only) when --profile already set', () => {
  const warns = [];
  const out = normalizeFlags(['--profile', 'quality', '--secure'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--profile', 'quality']);
  assert.match(warns[0], /--secure.*ignored.*--profile.*present/);
});

test('--strict-quality rewrites to --strict', () => {
  const warns = [];
  const out = normalizeFlags(['--strict-quality'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--strict']);
});

test('unknown flags pass through unchanged', () => {
  const warns = [];
  const out = normalizeFlags(['--session', 'a3f7', '--json'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--session', 'a3f7', '--json']);
  assert.equal(warns.length, 0);
});
