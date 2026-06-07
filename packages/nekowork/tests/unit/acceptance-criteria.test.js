// acceptance-criteria: normalizeAcceptanceCriteria + buildDefaultAcceptanceCriteria
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  normalizeAcceptanceCriteria,
  buildDefaultAcceptanceCriteria,
} from '../../scripts/lib/acceptance-criteria.js';

// ---------------------------------------------------------------------------
// normalizeAcceptanceCriteria
// ---------------------------------------------------------------------------

test('normalizeAcceptanceCriteria: non-array input returns empty array', () => {
  // The function only iterates Array.isArray(value); everything else -> [].
  assert.deepEqual(normalizeAcceptanceCriteria('a single string'), []);
  assert.deepEqual(normalizeAcceptanceCriteria(null), []);
  assert.deepEqual(normalizeAcceptanceCriteria(undefined), []);
  assert.deepEqual(normalizeAcceptanceCriteria({ desc: 'x' }), []);
  assert.deepEqual(normalizeAcceptanceCriteria(42), []);
});

test('normalizeAcceptanceCriteria: empty array stays empty', () => {
  assert.deepEqual(normalizeAcceptanceCriteria([]), []);
});

test('normalizeAcceptanceCriteria: string rows get generated ids and trimmed desc', () => {
  const out = normalizeAcceptanceCriteria(['  first  ', 'second']);
  assert.deepEqual(out, [
    { id: 'AC-001', desc: 'first', passes: false, source: 'unknown' },
    { id: 'AC-002', desc: 'second', passes: false, source: 'unknown' },
  ]);
});

test('normalizeAcceptanceCriteria: source parameter is propagated', () => {
  const out = normalizeAcceptanceCriteria(['x'], 'prd.json');
  assert.equal(out[0].source, 'prd.json');
});

test('normalizeAcceptanceCriteria: object rows read desc/description/summary', () => {
  const out = normalizeAcceptanceCriteria([
    { desc: 'd-field' },
    { description: 'description-field' },
    { summary: 'summary-field' },
  ]);
  assert.deepEqual(out.map(r => r.desc), ['d-field', 'description-field', 'summary-field']);
});

test('normalizeAcceptanceCriteria: desc takes precedence over description and summary', () => {
  const out = normalizeAcceptanceCriteria([{ desc: 'win', description: 'lose', summary: 'lose' }]);
  assert.equal(out[0].desc, 'win');
});

test('normalizeAcceptanceCriteria: explicit id is preserved (stable), missing id generated', () => {
  const out = normalizeAcceptanceCriteria([
    { id: 'CUSTOM-9', desc: 'kept' },
    { desc: 'generated' },
  ]);
  assert.equal(out[0].id, 'CUSTOM-9');
  // index 1 -> AC-002 (generation is index-based, not row-count-based)
  assert.equal(out[1].id, 'AC-002');
});

test('normalizeAcceptanceCriteria: id generation is stable for repeated input', () => {
  const input = ['a', 'b', 'c'];
  const first = normalizeAcceptanceCriteria(input);
  const second = normalizeAcceptanceCriteria(input);
  assert.deepEqual(first.map(r => r.id), ['AC-001', 'AC-002', 'AC-003']);
  assert.deepEqual(first, second);
});

test('normalizeAcceptanceCriteria: passes boolean honored, otherwise defaults false', () => {
  const out = normalizeAcceptanceCriteria([
    { desc: 'a', passes: true },
    { desc: 'b', passes: false },
    { desc: 'c', passes: 'yes' }, // non-boolean -> false
    { desc: 'd' },
  ]);
  assert.deepEqual(out.map(r => r.passes), [true, false, false, false]);
});

test('normalizeAcceptanceCriteria: per-row source overrides the default source', () => {
  const out = normalizeAcceptanceCriteria([{ desc: 'a', source: 'row-src' }], 'default-src');
  assert.equal(out[0].source, 'row-src');
});

test('normalizeAcceptanceCriteria: null/empty/non-object rows are filtered out', () => {
  const out = normalizeAcceptanceCriteria([
    null,
    undefined,
    { desc: '   ' },       // empty after trim -> dropped
    { desc: '' },          // empty -> dropped
    {},                    // no desc -> dropped
    42,                    // non-object, non-string -> dropped
    { desc: 'kept' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].desc, 'kept');
});

test('normalizeAcceptanceCriteria: filtered rows still use their original index for id', () => {
  // First row is dropped (empty), second row survives -> keeps AC-002.
  const out = normalizeAcceptanceCriteria([{ desc: '' }, { desc: 'survivor' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'AC-002');
});

// ---------------------------------------------------------------------------
// buildDefaultAcceptanceCriteria
// ---------------------------------------------------------------------------

test('buildDefaultAcceptanceCriteria: default minimum yields 3 rows', () => {
  const out = buildDefaultAcceptanceCriteria('add login');
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(r => r.id), ['AC-001', 'AC-002', 'AC-003']);
  assert.ok(out[0].desc.includes('add login'));
  assert.ok(out.every(r => r.passes === false));
  assert.ok(out.every(r => r.source === 'task-derived-minimum'));
});

test('buildDefaultAcceptanceCriteria: blank task falls back to "requested change"', () => {
  const out = buildDefaultAcceptanceCriteria('   ');
  assert.ok(out[0].desc.includes('requested change'));
});

test('buildDefaultAcceptanceCriteria: minimum is clamped to at least 1', () => {
  const out = buildDefaultAcceptanceCriteria('task', 0);
  assert.equal(out.length, 1);
  const negative = buildDefaultAcceptanceCriteria('task', -5);
  assert.equal(negative.length, 1);
});

test('buildDefaultAcceptanceCriteria: minimum caps at the 3 available rows', () => {
  const out = buildDefaultAcceptanceCriteria('task', 10);
  assert.equal(out.length, 3);
});
