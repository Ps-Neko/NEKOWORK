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

test('--pack without value throws', () => {
  assert.throws(() => normalizeFlags(['--pack'], { warn: () => {} }), /requires a profile value/);
});

test('--pack followed by another flag throws', () => {
  assert.throws(() => normalizeFlags(['--pack', '--json'], { warn: () => {} }), /requires a profile value/);
});

test('--pack=value (equals form) rewrites to --profile=value and warns', () => {
  const warns = [];
  const out = normalizeFlags(['--pack=quality'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--profile=quality']);
  assert.match(warns[0], /--pack.*deprecated/);
});

test('--pack= with empty value throws', () => {
  assert.throws(() => normalizeFlags(['--pack='], { warn: () => {} }), /requires a profile value/);
});

test('--secure before --profile is still ignored', () => {
  const warns = [];
  const out = normalizeFlags(['--secure', '--profile', 'quality'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--profile', 'quality']);
  assert.match(warns[0], /--secure.*ignored/);
});

test('--fast is dropped and warns', () => {
  const warns = [];
  const out = normalizeFlags(['--fast'], { warn: m => warns.push(m) });
  assert.deepEqual(out, []);
  assert.match(warns[0], /--fast.*no-op/);
});

test('--secure is ignored when --profile=value (equals form) is present', () => {
  const warns = [];
  const out = normalizeFlags(['--profile=quality', '--secure'], { warn: m => warns.push(m) });
  assert.deepEqual(out, ['--profile=quality']);
  assert.match(warns[0], /--secure.*ignored/);
});

test('--secure is ignored when --pack is present (will normalize to --profile)', () => {
  const warns = [];
  const out = normalizeFlags(['--pack', 'quality', '--secure'], { warn: m => warns.push(m) });
  // --pack gets rewritten to --profile, and --secure is dropped
  assert.deepEqual(out, ['--profile', 'quality']);
  // there should be a warning about --secure being ignored AND --pack deprecated
  assert.ok(warns.some(w => /--secure.*ignored/.test(w)));
  assert.ok(warns.some(w => /--pack.*deprecated/.test(w)));
});
