import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const UPSTREAM_EXCERPT_LIMIT = 16 * 1024;

const DEFINITIONS = {
  context: { autoName: 'context.md', flag: '--context-file', label: 'context' },
  domain: { autoName: 'DOMAIN.md', flag: '--domain-file', label: 'domain' },
  spec: { autoName: 'SPEC.md', flag: '--spec-file', label: 'spec' },
  plan: { autoName: 'PLAN.md', flag: '--plan-file', label: 'plan' },
};

export function loadUpstreamArtifact(kind, projectRoot, explicit) {
  const def = DEFINITIONS[kind];
  if (!def) throw new Error(`unknown upstream artifact kind: ${kind}`);
  if (explicit) {
    const abs = path.isAbsolute(explicit) ? explicit : path.resolve(projectRoot, explicit);
    if (!fs.existsSync(abs)) {
      throw new Error(`${def.label} file not found: ${explicit}`);
    }
    return readArtifact(projectRoot, abs, 'explicit');
  }
  const auto = path.join(projectRoot, def.autoName);
  if (fs.existsSync(auto)) {
    return readArtifact(projectRoot, auto, 'auto');
  }
  return null;
}

export function loadUpstreamBundle(projectRoot, explicits = {}) {
  const out = {};
  for (const kind of Object.keys(DEFINITIONS)) {
    out[kind] = loadUpstreamArtifact(kind, projectRoot, explicits[kind] || null);
  }
  return out;
}

function readArtifact(projectRoot, abs, source) {
  const body = fs.readFileSync(abs, 'utf8');
  const size = Buffer.byteLength(body, 'utf8');
  const sha1 = crypto.createHash('sha1').update(body).digest('hex');
  const truncated = size > UPSTREAM_EXCERPT_LIMIT;
  const excerpt = truncated ? body.slice(0, UPSTREAM_EXCERPT_LIMIT) : body;
  return {
    path: path.relative(projectRoot, abs).replace(/\\/g, '/'),
    source,
    size,
    sha1,
    truncated,
    excerpt,
  };
}
