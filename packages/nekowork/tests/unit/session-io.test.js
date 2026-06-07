// session-io: shared readJson / readMarker / markerTime helpers
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readJson, readMarker, markerTime } from '../../scripts/lib/session-io.js';

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'harness-session-io-'));
}

test('readJson: missing file returns null', () => {
  const dir = tmpdir();
  try {
    assert.equal(readJson(path.join(dir, 'nope.json')), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readJson: invalid JSON returns null (no throw)', () => {
  const dir = tmpdir();
  try {
    const f = path.join(dir, 'bad.json');
    fs.writeFileSync(f, '{not json');
    assert.equal(readJson(f), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readJson: valid JSON parses', () => {
  const dir = tmpdir();
  try {
    const f = path.join(dir, 'ok.json');
    fs.writeFileSync(f, '{"a":1}');
    assert.deepEqual(readJson(f), { a: 1 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readMarker: returns superset of fields used by every call site', () => {
  const dir = tmpdir();
  try {
    const f = path.join(dir, 'HUMAN_GATE');
    fs.writeFileSync(f, [
      'reason: needs review',
      'human_gate_reason: risky',
      'actor: alice',
      'diff_path: /tmp/x.diff',
      'at: 2026-01-01T00:00:00.000Z',
    ].join('\n') + '\n');
    const m = readMarker(f);
    assert.equal(m.kind, 'HUMAN_GATE');
    assert.equal(m.file, f);
    assert.equal(m.reason, 'needs review');
    assert.equal(m.humanGateReason, 'risky');
    assert.equal(m.actor, 'alice');
    assert.equal(m.diffPath, '/tmp/x.diff');
    assert.equal(m.at, '2026-01-01T00:00:00.000Z');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readMarker: missing file returns null (TOCTOU-safe contract)', () => {
  const dir = tmpdir();
  try {
    assert.equal(readMarker(path.join(dir, 'NOPE')), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('markerTime: parses at; falls back to 0 for missing/invalid', () => {
  assert.equal(markerTime({ at: '2026-01-01T00:00:00.000Z' }), Date.parse('2026-01-01T00:00:00.000Z'));
  assert.equal(markerTime({ at: 'not-a-date' }), 0);
  assert.equal(markerTime(null), 0);
  assert.equal(markerTime({}), 0);
});
