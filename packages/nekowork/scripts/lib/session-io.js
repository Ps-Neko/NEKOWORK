// Shared session I/O helpers — single source of truth for the small reader
// utilities that decision.js, report.js, apply.js, gate.js, and
// acceptance-criteria.js previously each copied. Consolidated to avoid drift
// (notably: only decision.js had the TOCTOU try-catch around readFileSync).
//
// Shared library module — also consumed by the heavy @ps-neko/nekowork-harness
// package via the slim package; keep additive only.

import fs from 'node:fs';
import path from 'node:path';

/**
 * Read and JSON-parse a file. Returns null if the file is missing or invalid.
 * @param {string} file absolute path
 * @returns {any|null}
 */
export function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Read a marker file (`reason:` / `at:` / `actor:` / etc. key-value text) into
 * a structured object. Returns null when the file is absent or removed between
 * the existence check and the read (TOCTOU-safe).
 *
 * Returns the SUPERSET of fields every previous copy exposed so all call sites
 * keep working:
 *   - file:            the marker path (all callers)
 *   - raw:             full file text (all callers)
 *   - reason:          `reason:` line (all callers)
 *   - at:              `at:` line (all callers)
 *   - actor:           `actor:` line (decision.js, gate.js)
 *   - humanGateReason: `human_gate_reason:` line (gate.js)
 *   - diffPath:        `diff_path:` line (apply.js)
 *   - diffHash:        `diff_hash:` line (gate approval ↔ apply binding)
 *   - kind:            basename of the marker file (gate.js)
 *
 * @param {string} file absolute path to the marker file
 * @returns {{
 *   file: string, raw: string, reason: string|null, at: string|null,
 *   actor: string|null, humanGateReason: string|null, diffPath: string|null,
 *   diffHash: string|null, kind: string
 * } | null}
 */
export function readMarker(file) {
  if (!fs.existsSync(file)) return null;
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    // File removed between existsSync and readFileSync (TOCTOU) — treat as absent.
    return null;
  }
  return {
    kind: path.basename(file),
    file,
    raw,
    reason: raw.match(/^reason:\s*(.+)$/m)?.[1] || null,
    actor: raw.match(/^actor:\s*(.+)$/m)?.[1] || null,
    at: raw.match(/^at:\s*(.+)$/m)?.[1] || null,
    humanGateReason: raw.match(/^human_gate_reason:\s*(.+)$/m)?.[1] || null,
    diffPath: raw.match(/^diff_path:\s*(.+)$/m)?.[1] || null,
    diffHash: raw.match(/^diff_hash:\s*([0-9a-f]+)$/m)?.[1] || null,
  };
}

/**
 * Parse a marker's `at:` timestamp into epoch millis. Returns 0 for missing or
 * unparseable timestamps so comparisons stay deterministic.
 * @param {{at?: string}|null} marker
 * @returns {number}
 */
export function markerTime(marker) {
  const time = Date.parse(marker?.at || '');
  return Number.isFinite(time) ? time : 0;
}
