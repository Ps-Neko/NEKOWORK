// Shared helpers for the work-cycle orchestrators (apply, verify, work, ship).
// All functions here are byte-for-byte identical across those files.
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
