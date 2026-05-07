import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  buildDefaultAcceptanceCriteria,
  ensureAcceptanceCriteria,
  normalizeAcceptanceCriteria,
  readAcceptanceCriteria,
} from '../../scripts/lib/acceptance-criteria.js';

test('normalizes string and object acceptance criteria', () => {
  const rows = normalizeAcceptanceCriteria([
    'happy path works',
    { id: 'AC-X', description: 'edge case is rejected', passes: true },
  ], 'unit');

  assert.deepEqual(rows.map(r => r.id), ['AC-001', 'AC-X']);
  assert.deepEqual(rows.map(r => r.source), ['unit', 'unit']);
  assert.equal(rows[1].passes, true);
});

test('ensureAcceptanceCriteria reuses prd.json criteria and writes required artifact', () => {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-acceptance-'));
  try {
    fs.writeFileSync(path.join(sessionDir, 'prd.json'), JSON.stringify({
      acceptance: [{ id: 'AC-PRD', desc: 'prd criteria exists', passes: false }],
    }));

    const artifact = ensureAcceptanceCriteria({ sessionDir, task: 'unit task' });
    assert.equal(artifact.generated, false);
    assert.equal(artifact.source, 'prd.json');
    assert.equal(artifact.criteria[0].id, 'AC-PRD');

    const reread = readAcceptanceCriteria(sessionDir);
    assert.equal(reread.criteria.length, 1);
  } finally {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
});

test('ensureAcceptanceCriteria creates a task-derived minimum when no plan exists', () => {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-acceptance-generated-'));
  try {
    const artifact = ensureAcceptanceCriteria({ sessionDir, task: 'build a mock dashboard' });
    assert.equal(artifact.generated, true);
    assert.equal(artifact.source, 'task-derived-minimum');
    assert.equal(artifact.criteria.length, 3);
    assert.ok(fs.existsSync(path.join(sessionDir, 'acceptance-criteria.json')));
  } finally {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
});

test('default acceptance criteria are deterministic', () => {
  const rows = buildDefaultAcceptanceCriteria('sample task', 2);
  assert.deepEqual(rows.map(r => r.id), ['AC-001', 'AC-002']);
  assert.match(rows[0].desc, /sample task/);
});
