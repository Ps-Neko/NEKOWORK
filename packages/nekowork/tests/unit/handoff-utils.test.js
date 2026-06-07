// _handoff-utils: readPriorHandoffs / latestStageHandoff / readSessionDiff / computeSessionDiffHash
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readPriorHandoffs,
  latestStageHandoff,
  readSessionDiff,
  computeSessionDiffHash,
} from '../../scripts/orchestrators/_handoff-utils.js';
import { rmrf } from '../helpers/tmp.js';

function tmpSession() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-handoff-utils-'));
  const handoffDir = path.join(root, 'handoffs');
  fs.mkdirSync(handoffDir, { recursive: true });
  return { root, handoffDir };
}

function writeHandoff(handoffDir, name, obj) {
  fs.writeFileSync(path.join(handoffDir, name), JSON.stringify(obj, null, 2));
}

// ---------------------------------------------------------------------------
// readPriorHandoffs
// ---------------------------------------------------------------------------

test('readPriorHandoffs: missing directory returns empty array', () => {
  const { root } = tmpSession();
  try {
    assert.deepEqual(readPriorHandoffs(path.join(root, 'does-not-exist')), []);
  } finally {
    rmrf(root);
  }
});

test('readPriorHandoffs: reads valid handoffs sorted by filename', () => {
  const { root, handoffDir } = tmpSession();
  try {
    writeHandoff(handoffDir, '02-implement.json', { stage: 'implement', round: 1 });
    writeHandoff(handoffDir, '01-plan.json', { stage: 'plan', round: 1 });
    writeHandoff(handoffDir, '03-verify.json', { stage: 'verify', round: 1 });
    const out = readPriorHandoffs(handoffDir);
    assert.deepEqual(out.map(h => h.stage), ['plan', 'implement', 'verify']);
  } finally {
    rmrf(root);
  }
});

test('readPriorHandoffs: ignores non-json files', () => {
  const { root, handoffDir } = tmpSession();
  try {
    writeHandoff(handoffDir, '01-plan.json', { stage: 'plan' });
    fs.writeFileSync(path.join(handoffDir, 'notes.md'), '# not a handoff');
    fs.writeFileSync(path.join(handoffDir, 'progress.txt'), 'wip');
    const out = readPriorHandoffs(handoffDir);
    assert.equal(out.length, 1);
    assert.equal(out[0].stage, 'plan');
  } finally {
    rmrf(root);
  }
});

test('readPriorHandoffs: corrupt JSON is silently excluded', () => {
  const { root, handoffDir } = tmpSession();
  try {
    writeHandoff(handoffDir, '01-plan.json', { stage: 'plan' });
    fs.writeFileSync(path.join(handoffDir, '02-broken.json'), '{not valid json');
    writeHandoff(handoffDir, '03-verify.json', { stage: 'verify' });
    const out = readPriorHandoffs(handoffDir);
    assert.equal(out.length, 2);
    assert.deepEqual(out.map(h => h.stage), ['plan', 'verify']);
  } finally {
    rmrf(root);
  }
});

test('readPriorHandoffs: empty directory returns empty array', () => {
  const { root, handoffDir } = tmpSession();
  try {
    assert.deepEqual(readPriorHandoffs(handoffDir), []);
  } finally {
    rmrf(root);
  }
});

// ---------------------------------------------------------------------------
// latestStageHandoff
// ---------------------------------------------------------------------------

test('latestStageHandoff: picks the highest round for the stage', () => {
  const handoffs = [
    { stage: 'implement', round: 1, marker: 'a' },
    { stage: 'implement', round: 3, marker: 'c' },
    { stage: 'implement', round: 2, marker: 'b' },
    { stage: 'verify', round: 5, marker: 'v' },
  ];
  const latest = latestStageHandoff(handoffs, 'implement');
  assert.equal(latest.round, 3);
  assert.equal(latest.marker, 'c');
});

test('latestStageHandoff: round defaults to 1 when absent', () => {
  const handoffs = [
    { stage: 'implement', marker: 'no-round' },
    { stage: 'implement', round: 1, marker: 'explicit-1' },
  ];
  // Both rank as round 1; sort is stable-ish but both are valid "latest" — assert a round-1 item.
  const latest = latestStageHandoff(handoffs, 'implement');
  assert.equal(Number(latest.round || 1), 1);
});

test('latestStageHandoff: no matching stage returns null', () => {
  const handoffs = [{ stage: 'plan', round: 1 }];
  assert.equal(latestStageHandoff(handoffs, 'implement'), null);
});

test('latestStageHandoff: empty input returns null', () => {
  assert.equal(latestStageHandoff([], 'implement'), null);
});

// ---------------------------------------------------------------------------
// readSessionDiff
// ---------------------------------------------------------------------------

test('readSessionDiff: returns empty string when no diff exists', () => {
  const { root } = tmpSession();
  try {
    assert.equal(readSessionDiff(root, null), '');
  } finally {
    rmrf(root);
  }
});

test('readSessionDiff: prefers the handoff recorded diffPath', () => {
  const { root } = tmpSession();
  try {
    const diffDir = path.join(root, 'diffs');
    fs.mkdirSync(diffDir, { recursive: true });
    const recorded = path.join(diffDir, 'recorded.diff');
    fs.writeFileSync(recorded, 'RECORDED DIFF CONTENT');
    fs.writeFileSync(path.join(diffDir, '99-newest.diff'), 'OTHER DIFF');
    assert.equal(readSessionDiff(root, { diffPath: recorded }), 'RECORDED DIFF CONTENT');
  } finally {
    rmrf(root);
  }
});

test('readSessionDiff: falls back to newest *.diff under diffs/', () => {
  const { root } = tmpSession();
  try {
    const diffDir = path.join(root, 'diffs');
    fs.mkdirSync(diffDir, { recursive: true });
    fs.writeFileSync(path.join(diffDir, '01-implement.diff'), 'OLD');
    fs.writeFileSync(path.join(diffDir, '02-implement.diff'), 'NEW');
    // sort().reverse() => '02-...' wins.
    assert.equal(readSessionDiff(root, null), 'NEW');
  } finally {
    rmrf(root);
  }
});

test('readSessionDiff: skips a stale diffPath and uses the directory fallback', () => {
  const { root } = tmpSession();
  try {
    const diffDir = path.join(root, 'diffs');
    fs.mkdirSync(diffDir, { recursive: true });
    fs.writeFileSync(path.join(diffDir, '01-implement.diff'), 'FALLBACK');
    const missing = path.join(diffDir, 'gone.diff');
    assert.equal(readSessionDiff(root, { diffPath: missing }), 'FALLBACK');
  } finally {
    rmrf(root);
  }
});

// ---------------------------------------------------------------------------
// computeSessionDiffHash
// ---------------------------------------------------------------------------

test('computeSessionDiffHash: returns null when there is no diff', () => {
  const { root } = tmpSession();
  try {
    assert.equal(computeSessionDiffHash(root), null);
  } finally {
    rmrf(root);
  }
});

test('computeSessionDiffHash: returns null when the latest implement diff is blank', () => {
  const { root, handoffDir } = tmpSession();
  try {
    const diffDir = path.join(root, 'diffs');
    fs.mkdirSync(diffDir, { recursive: true });
    const diffPath = path.join(diffDir, '01-implement.diff');
    fs.writeFileSync(diffPath, '   \n  \t\n');
    writeHandoff(handoffDir, '03-implement.json', { stage: 'implement', round: 1, diffPath });
    assert.equal(computeSessionDiffHash(root), null);
  } finally {
    rmrf(root);
  }
});

test('computeSessionDiffHash: stable sha256 of the latest implement diff', () => {
  const { root, handoffDir } = tmpSession();
  try {
    const diffDir = path.join(root, 'diffs');
    fs.mkdirSync(diffDir, { recursive: true });
    const diffContent = 'diff --git a/x.js b/x.js\n+const x = 1;\n';
    const diffPath = path.join(diffDir, '01-implement.diff');
    fs.writeFileSync(diffPath, diffContent);
    writeHandoff(handoffDir, '03-implement.json', { stage: 'implement', round: 1, diffPath });

    const expected = crypto.createHash('sha256').update(diffContent).digest('hex');
    const hash = computeSessionDiffHash(root);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hash, expected);
    // Deterministic across repeated calls.
    assert.equal(computeSessionDiffHash(root), hash);
  } finally {
    rmrf(root);
  }
});

test('computeSessionDiffHash: hashes the latest round implement diff', () => {
  const { root, handoffDir } = tmpSession();
  try {
    const diffDir = path.join(root, 'diffs');
    fs.mkdirSync(diffDir, { recursive: true });
    const round1Path = path.join(diffDir, '01-implement.diff');
    const round2Path = path.join(diffDir, '02-implement.diff');
    fs.writeFileSync(round1Path, 'ROUND ONE DIFF');
    fs.writeFileSync(round2Path, 'ROUND TWO DIFF');
    writeHandoff(handoffDir, '01-implement.json', { stage: 'implement', round: 1, diffPath: round1Path });
    writeHandoff(handoffDir, '04-implement.json', { stage: 'implement', round: 2, diffPath: round2Path });

    const expected = crypto.createHash('sha256').update('ROUND TWO DIFF').digest('hex');
    assert.equal(computeSessionDiffHash(root), expected);
  } finally {
    rmrf(root);
  }
});
