// Shared helpers for the work-cycle orchestrators (apply, verify, work, ship).
//
// The byte-identical functions (readPriorHandoffs, latestStageHandoff,
// computeSessionDiffHash) live in the SLIM @ps-neko/nekowork package and are
// re-exported here so heavy never carries a drifting copy. The heavy-only
// helpers (nextRound, readJsonIfExists, readSessionProfile) stay local.
import fs from 'node:fs';
import path from 'node:path';

export {
  readPriorHandoffs,
  latestStageHandoff,
  readSessionDiff,
  computeSessionDiffHash,
} from '@ps-neko/nekowork/scripts/orchestrators/_handoff-utils.js';

export function nextRound(handoffs, stage) {
  const rounds = handoffs
    .filter(h => h.stage === stage)
    .map(h => Number(h.round || 1))
    .filter(Number.isFinite);
  return rounds.length ? Math.max(...rounds) + 1 : 1;
}

export function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function readSessionProfile(sessionDir) {
  return readJsonIfExists(path.join(sessionDir, 'ask.json'))?.profile || null;
}
