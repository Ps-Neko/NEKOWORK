import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSessionId, isLegacyId, isNewId } from '../../scripts/lib/session-id.js';

test('generateSessionId follows <verb>-YYYY-MM-DD-XXXX pattern', () => {
  const id = generateSessionId('work', new Date('2026-05-13T09:00:00Z'));
  assert.match(id, /^work-2026-05-13-[0-9a-f]{4}$/);
});

test('generateSessionId honors verb prefix', () => {
  const id = generateSessionId('review', new Date('2026-05-13T09:00:00Z'));
  assert.ok(id.startsWith('review-2026-05-13-'));
});

test('isNewId detects new pattern', () => {
  assert.equal(isNewId('work-2026-05-13-a3f7'), true);
  assert.equal(isNewId('work-1778631431662'), false);
});

test('isLegacyId detects timestamp pattern', () => {
  assert.equal(isLegacyId('work-1778631431662'), true);
  assert.equal(isLegacyId('work-2026-05-13-a3f7'), false);
});

test('generateSessionId produces distinct ids on rapid calls', () => {
  const a = generateSessionId('work');
  const b = generateSessionId('work');
  assert.notEqual(a, b);
});
