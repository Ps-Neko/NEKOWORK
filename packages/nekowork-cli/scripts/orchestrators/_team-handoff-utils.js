// Shared helpers for the team orchestrators (team.js and team-lite.js).
// All functions here are byte-for-byte identical across those files.
import fs from 'node:fs';
import path from 'node:path';

export function handoffBase(h, index) {
  return `${String(index).padStart(2, '0')}-${h.team_stage}`;
}

export function handoffJsonPath(handoffDir, h, index) {
  return path.join(handoffDir, `${handoffBase(h, index)}.json`);
}

export function writeHandoff(handoffDir, h, index) {
  const base = handoffBase(h, index);
  fs.writeFileSync(handoffJsonPath(handoffDir, h, index), JSON.stringify(h, null, 2));
  fs.writeFileSync(path.join(handoffDir, `${base}.md`), renderFiveFieldHandoff(h));
}

export function renderFiveFieldHandoff(h) {
  return [
    `# Handoff: ${h.team_stage}`,
    '',
    `Decided: ${h.decided || ''}`,
    `Rejected: ${h.rejected || ''}`,
    `Risks: ${h.risks || ''}`,
    `Files: ${(h.files || []).join(', ')}`,
    `Remaining: ${h.remaining || ''}`,
    h.verdict ? `Verdict: ${h.verdict}` : '',
    '',
  ].filter(Boolean).join('\n');
}

export function removeUndefined(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) delete obj[k];
  }
}
