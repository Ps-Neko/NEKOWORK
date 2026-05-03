import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const ZERO_SHA = '0'.repeat(64);

const CATALOG_INPUTS = ['agent.yaml', 'agents', 'skills', 'commands', 'hooks', 'manifests'];

export function installStatePath(root) {
  return path.join(root, '.harness', 'install-state.json');
}

export function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function sha256OfDir(dir) {
  if (!fs.existsSync(dir)) return null;
  const entries = [];

  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const rel = path.relative(dir, p).replace(/\\/g, '/');
        const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        entries.push(`${rel} ${h}`);
      }
    }
  }

  walk(dir);
  if (entries.length === 0) return null;
  return crypto.createHash('sha256').update(entries.join('\n')).digest('hex');
}

export function sha256OfCatalog(root, inputs = CATALOG_INPUTS) {
  const parts = [];
  for (const inp of inputs) {
    const p = path.join(root, inp);
    if (!fs.existsSync(p)) continue;
    const stat = fs.statSync(p);
    if (stat.isFile()) parts.push(`${inp}\t${sha256(p)}`);
    else parts.push(`${inp}/\t${sha256OfDir(p) || ''}`);
  }
  return crypto.createHash('sha256').update(parts.join('\n')).digest('hex');
}

export function loadInstallState(root) {
  const file = installStatePath(root);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function buildInstallState(root, {
  targetRoot = root,
  profile,
  harnessDefs,
  harnessNames,
  previousState = null,
  now = new Date().toISOString(),
} = {}) {
  const sourceSha = sha256OfCatalog(root);
  const selected = new Set(harnessNames || harnessDefs.map(h => h.name));
  const state = {
    $schema: 'schemas/install-state.schema.json',
    version: previousState?.version || '0.0.1',
    harness_version: packageVersion(root),
    profile: profile || previousState?.profile || 'developer',
    installed_at: previousState?.installed_at || now,
    last_updated: now,
    components: { ...(previousState?.components || {}) },
  };

  for (const h of harnessDefs) {
    if (!selected.has(h.name)) continue;
    const component = buildStateComponent(root, targetRoot, h, sourceSha, now, previousState?.components?.[h.name]);
    if (component) state.components[h.name] = component;
  }

  assertInstallState(root, state);
  return { state, sourceSha };
}

export function buildStateComponent(root, targetRoot, harnessDef, sourceSha, now = new Date().toISOString(), previous = null) {
  const outDir = path.join(targetRoot, harnessDef.output_dir);
  if (!fs.existsSync(outDir)) return null;
  return {
    installed_at: previous?.installed_at || now,
    source_sha256: sourceSha,
    targets: [{
      harness: harnessDef.name,
      path: harnessDef.output_dir,
      sha256: sha256OfDir(outDir) || ZERO_SHA,
    }],
  };
}

export function writeInstallState(root, state, { schemaRoot = root } = {}) {
  assertInstallState(schemaRoot, state);
  const file = installStatePath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
  return file;
}

export function assertInstallState(root, state) {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'install-state.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(state)) {
    const detail = (validate.errors || [])
      .map(e => `${e.instancePath || '/'} ${e.message}`)
      .join('; ');
    throw new Error(`install-state schema validation failed: ${detail}`);
  }
}

function packageVersion(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
}
