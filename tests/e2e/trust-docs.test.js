import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function readDoc(name) {
  return fs.readFileSync(path.join(ROOT, 'docs', name), 'utf8');
}

test('trust docs spell out safety, failure, verifier, and autopilot boundaries', () => {
  const safety = readDoc('SAFETY-GUARANTEES.md');
  const failure = readDoc('FAILURE-MODES.md');
  const trust = readDoc('TRUST-MODEL.md');
  const autopilot = readDoc('WHY-NOT-AUTOPILOT.md');
  const patterns = readDoc('AGENTIC-PATTERNS.md');

  assert.match(safety, /will not:\n\n- commit without an explicit user command/);
  assert.match(safety, /publish packages/);
  assert.match(failure, /Apply Refusal/);
  assert.match(failure, /Provider Auth Problems/);
  assert.match(trust, /default verifier/i);
  assert.match(trust, /verifier = codex \| gemini \| local \| custom/);
  assert.match(autopilot, /work -> verify -> ship\/no-ship -> report -> human gate -> explicit apply/);
  assert.match(autopilot, /not trying to be a 100-agent autonomous coding pack/);
  assert.match(patterns, /12 practical agentic harness patterns/i);
  assert.match(patterns, /Parallel Processing/);
  assert.match(patterns, /`auto --parallel-candidates N`/);
  assert.match(patterns, /one canonical final diff/);
  assert.match(patterns, /manual promotion/);
});
