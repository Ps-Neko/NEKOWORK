import { randomBytes } from 'node:crypto';

const NEW_RE    = /^[a-z]+-\d{4}-\d{2}-\d{2}-[0-9a-f]{4}$/;
const LEGACY_RE = /^[a-z]+-\d{10,}$/;

function isoDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function generateSessionId(verb, when = new Date()) {
  if (!verb || !/^[a-z]+$/.test(verb)) {
    throw new Error(`generateSessionId: invalid verb '${verb}'`);
  }
  const hex = randomBytes(2).toString('hex');
  return `${verb}-${isoDate(when)}-${hex}`;
}

export function isNewId(id) {
  return NEW_RE.test(String(id || ''));
}

export function isLegacyId(id) {
  return LEGACY_RE.test(String(id || ''));
}
