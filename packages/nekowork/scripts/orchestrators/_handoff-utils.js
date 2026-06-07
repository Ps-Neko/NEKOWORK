// Shared helpers for the work-cycle orchestrators (apply, verify, work, ship).
// All functions here are byte-for-byte identical across those files.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function readPriorHandoffs(handoffDir) {
  if (!fs.existsSync(handoffDir)) return [];
  return fs.readdirSync(handoffDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(handoffDir, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function latestStageHandoff(handoffs, stage) {
  return handoffs
    .filter(h => h.stage === stage)
    .sort((a, b) => Number(b.round || 1) - Number(a.round || 1))
    .at(0) || null;
}

/**
 * Resolve the captured diff for the latest implement handoff in a session:
 * prefers the handoff's recorded diffPath, then falls back to the newest
 * `*.diff` under `<sessionDir>/diffs`. Returns '' when none is found. Shared so
 * gate-approval and apply hash the EXACT SAME diff content.
 *
 * @param {string} sessionDir
 * @param {{diffPath?: string}|null} handoff
 * @returns {string} diff text ('' if none)
 */
export function readSessionDiff(sessionDir, handoff) {
  const candidates = [];
  if (handoff?.diffPath) candidates.push(handoff.diffPath);
  const diffDir = path.join(sessionDir, 'diffs');
  if (fs.existsSync(diffDir)) {
    candidates.push(
      ...fs.readdirSync(diffDir).filter(f => f.endsWith('.diff')).sort().reverse().map(f => path.join(diffDir, f)),
    );
  }
  for (const f of candidates) {
    try {
      if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
    } catch {}
  }
  return '';
}

/**
 * sha256 of the latest implement diff in a session, or null when there is no
 * diff. This is the value bound into a gate approval (defense-in-depth: it ties
 * an approval to the exact content approved — integrity-by-content-hash, NOT
 * authentication). apply recomputes it and refuses on mismatch.
 *
 * @param {string} sessionDir
 * @returns {string|null}
 */
export function computeSessionDiffHash(sessionDir) {
  const handoffs = readPriorHandoffs(path.join(sessionDir, 'handoffs'));
  const latestImplement = latestStageHandoff(handoffs, 'implement');
  const diff = readSessionDiff(sessionDir, latestImplement);
  if (!String(diff || '').trim()) return null;
  return crypto.createHash('sha256').update(String(diff)).digest('hex');
}

