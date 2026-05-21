import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'manifests', 'build-modes.json');

let cached = null;

export function loadBuildModes() {
  if (cached) return cached;
  cached = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  return cached;
}

export function buildModeIds() {
  return Object.keys(loadBuildModes().modes || {});
}

export function buildModeSafetyRank(mode) {
  const policy = loadBuildModes().modes?.[String(mode || '')];
  return Number.isInteger(policy?.safety_rank) ? policy.safety_rank : 0;
}

export function buildModePolicy(mode) {
  return loadBuildModes().modes?.[String(mode || '')] || null;
}

export function assertBuildModeContract(modePresets) {
  const presetIds = Object.keys(modePresets || {});
  const manifestIds = buildModeIds();
  const missing = presetIds.filter(id => !manifestIds.includes(id));
  const extra = manifestIds.filter(id => !presetIds.includes(id));
  if (missing.length || extra.length) {
    throw new Error(`build mode manifest mismatch: missing=${missing.join(',') || 'none'} extra=${extra.join(',') || 'none'}`);
  }
}
