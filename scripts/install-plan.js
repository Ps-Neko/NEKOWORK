#!/usr/bin/env node
// HARNESS install --plan: dry-run manifest planner.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    profile: null,
    harness: null,
    json: false,
    verbose: false,
    modules: [],
    withoutModules: [],
    components: [],
    withoutComponents: [],
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--profile') args.profile = argv[++i];
    else if (a === '--harness' || a === '--target') args.harness = argv[++i];
    else if (a === '--module' || a === '--with-module') args.modules.push(argv[++i]);
    else if (a === '--without-module') args.withoutModules.push(argv[++i]);
    else if (a === '--component' || a === '--with-component') args.components.push(argv[++i]);
    else if (a === '--without-component') args.withoutComponents.push(argv[++i]);
    else if (a === '--json') args.json = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
HARNESS install --plan

Usage:
  install.sh --plan [--profile <name>] [--target <name>] [--module <id>] [--component <id>] [--json] [--verbose]

Options:
  --profile <name>          profile to install (core | developer | security | research | full)
  --target <name>           harness target (claude | codex | cursor | gemini | opencode)
  --harness <name>          alias for --target
  --module <id>             include an additional module, repeatable
  --without-module <id>     exclude a module, repeatable
  --component <id>          include a direct component, repeatable
  --without-component <id>  exclude a component, repeatable
  --json                    emit JSON
  --verbose                 print schema validation detail
  --help                    show this help

Examples:
  ./install.sh --plan --profile core
  ./install.sh --plan --profile developer --target claude --json
  ./install.sh --plan --profile core --module codex-loop --without-component hook:persistent-mode
`);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function readYaml(rel) {
  return YAML.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function validateAll(verbose) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const checks = [
    { name: 'agent.yaml', schema: 'schemas/agent-yaml.schema.json', data: readYaml('agent.yaml') },
    { name: 'manifests/install-profiles', schema: 'schemas/install-profiles.schema.json', data: readJson('manifests/install-profiles.json') },
    { name: 'manifests/install-modules', schema: 'schemas/install-modules.schema.json', data: readJson('manifests/install-modules.json') },
    { name: 'manifests/install-components', schema: 'schemas/install-components.schema.json', data: readJson('manifests/install-components.json') },
  ];

  let ok = true;
  for (const c of checks) {
    const validate = ajv.compile(readJson(c.schema));
    const valid = validate(c.data);
    if (!valid) {
      ok = false;
      console.error(`  [FAIL] ${c.name}`);
      for (const err of validate.errors || []) console.error(`         ${err.instancePath} ${err.message}`);
    } else if (verbose) {
      console.error(`  [OK]   ${c.name}`);
    }
  }
  return ok;
}

function plan(profileName, filters = {}) {
  const manifest = readYaml('agent.yaml');
  const profilesDoc = readJson('manifests/install-profiles.json');
  const modulesDoc = readJson('manifests/install-modules.json');
  const componentsDoc = readJson('manifests/install-components.json');

  const resolvedProfile = profileName || manifest.profiles?.default || 'core';
  const profile = profilesDoc.profiles[resolvedProfile];
  if (!profile) {
    throw new Error(`unknown profile: ${resolvedProfile}. available: ${Object.keys(profilesDoc.profiles).join(', ')}`);
  }

  const harnessFilter = filters.harness || null;
  const excludedModules = new Set(filters.withoutModules || []);
  const excludedComponents = new Set(filters.withoutComponents || []);
  const seen = new Set();
  const queue = [...profile.modules, ...(filters.modules || [])];

  while (queue.length) {
    const mid = queue.shift();
    if (excludedModules.has(mid) || seen.has(mid)) continue;
    const def = modulesDoc.modules[mid];
    if (!def) throw new Error(`module definition not found: ${mid}`);
    seen.add(mid);
    for (const dep of def.depends_on || []) queue.push(dep);
  }

  const modules = [...seen];
  const componentRows = [];

  for (const mid of modules) {
    const def = modulesDoc.modules[mid];
    for (const cid of def.components || []) {
      if (excludedComponents.has(cid)) continue;
      const comp = componentsDoc.components[cid];
      if (!comp) {
        componentRows.push({ module: mid, component: cid, type: 'missing', missing: true });
        continue;
      }
      pushComponentRows(componentRows, mid, cid, comp, harnessFilter);
    }
  }

  for (const cid of filters.components || []) {
    if (excludedComponents.has(cid)) continue;
    if (componentRows.some(r => r.component === cid)) continue;
    const comp = componentsDoc.components[cid];
    if (!comp) {
      componentRows.push({ module: '(direct)', component: cid, type: 'missing', missing: true });
      continue;
    }
    pushComponentRows(componentRows, '(direct)', cid, comp, harnessFilter);
  }

  return {
    harness_version: manifest.version,
    profile: resolvedProfile,
    profile_description: profile.description,
    profile_defaults: profile.defaults || null,
    modules,
    selected_modules: filters.modules || [],
    excluded_modules: filters.withoutModules || [],
    selected_components: filters.components || [],
    excluded_components: filters.withoutComponents || [],
    component_count: componentRows.length,
    components: componentRows,
    harness_filter: harnessFilter,
    note: 'dry-run only. Use install-apply.js --apply to build target harness outputs.',
  };
}

function pushComponentRows(componentRows, moduleName, cid, comp, harnessFilter) {
  const targets = comp.target || {};
  const harnesses = Object.keys(targets);
  const filtered = harnessFilter ? harnesses.filter(h => h === harnessFilter) : harnesses;

  if (filtered.length === 0 && harnesses.length === 0) {
    componentRows.push({
      module: moduleName,
      component: cid,
      type: comp.type,
      source: comp.source || comp.builder || '-',
      harness: '(builder)',
      target: comp.output_dir || '-',
    });
    return;
  }

  for (const h of filtered) {
    componentRows.push({
      module: moduleName,
      component: cid,
      type: comp.type,
      source: comp.source || '-',
      harness: h,
      target: targets[h],
    });
  }
}

function printPlan(p) {
  const bold = (s) => process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s;
  console.log('');
  console.log(bold(`HARNESS install --plan  (v${p.harness_version})`));
  console.log('  profile      : ' + p.profile);
  console.log('  description  : ' + p.profile_description);
  if (p.harness_filter) console.log('  target       : ' + p.harness_filter);
  if (p.selected_modules.length) console.log('  with modules : ' + p.selected_modules.join(', '));
  if (p.excluded_modules.length) console.log('  without mods : ' + p.excluded_modules.join(', '));
  if (p.selected_components.length) console.log('  components+  : ' + p.selected_components.join(', '));
  if (p.excluded_components.length) console.log('  components-  : ' + p.excluded_components.join(', '));
  if (p.profile_defaults) console.log('  defaults     : ' + JSON.stringify(p.profile_defaults));
  console.log('  modules (' + p.modules.length + ') : ' + p.modules.join(', '));
  console.log('  components   : ' + p.component_count);
  console.log('');

  const byModule = new Map();
  for (const row of p.components) {
    if (!byModule.has(row.module)) byModule.set(row.module, []);
    byModule.get(row.module).push(row);
  }

  for (const [mid, rows] of byModule) {
    console.log(bold(`  [${mid}]`));
    for (const row of rows) {
      const missing = row.missing ? '  [MISSING-DEFINITION]' : '';
      console.log(`    - ${String(row.type).padEnd(9)} ${row.component.padEnd(30)} ${row.harness.padEnd(10)} ${row.target || ''}${missing}`);
    }
  }

  console.log('');
  console.log('NOTE: ' + p.note);
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.verbose) console.error('=> validating manifests');
  if (!validateAll(args.verbose)) {
    console.error('');
    console.error('FAIL: manifest validation failed.');
    process.exit(1);
  }
  if (args.verbose) console.error('=> validation passed');

  let p;
  try {
    p = plan(args.profile, args);
  } catch (e) {
    console.error('FAIL: ' + e.message);
    process.exit(1);
  }

  if (args.json) process.stdout.write(JSON.stringify(p, null, 2) + '\n');
  else printPlan(p);
}

main().catch((e) => {
  console.error('UNEXPECTED:', e?.stack || e);
  process.exit(1);
});

export { plan as _plan };
