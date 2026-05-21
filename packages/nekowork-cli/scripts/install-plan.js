#!/usr/bin/env node
// HARNESS install --plan: dry-run manifest planner.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateProfileSafety } from './lib/profile-safety.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    profile: null,
    pack: null,
    harness: null,
    json: false,
    list: false,
    verbose: false,
    projectRoot: null,
    modules: [],
    withoutModules: [],
    components: [],
    withoutComponents: [],
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--profile') args.profile = takeValue(argv, i++, a);
    else if (a === '--pack') args.pack = takeValue(argv, i++, a);
    else if (a === '--harness' || a === '--target') args.harness = takeValue(argv, i++, a);
    else if (a === '--module' || a === '--with-module') args.modules.push(takeValue(argv, i++, a));
    else if (a === '--without-module') args.withoutModules.push(takeValue(argv, i++, a));
    else if (a === '--component' || a === '--with-component') args.components.push(takeValue(argv, i++, a));
    else if (a === '--without-component') args.withoutComponents.push(takeValue(argv, i++, a));
    else if (a === '--project-root' || a === '--target-root') args.projectRoot = takeValue(argv, i++, a);
    else if (a === '--json') args.json = true;
    else if (a === '--list') args.list = true;
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

function takeValue(argv, i, flag) {
  const value = argv[i + 1];
  if (!value || value.startsWith('--')) {
    console.error(`${flag} value required`);
    process.exit(2);
  }
  return value;
}

function printHelp() {
  console.log(`
HARNESS install --plan

Usage:
  install.sh --plan [--profile <name>] [--pack <name>] [--target <name>] [--module <id>] [--component <id>] [--project-root <dir>] [--json] [--verbose]
  install.sh --plan --list [--json]

Options:
  --profile <name>          profile to install (core | developer | security | product | quality | frontend | testing | research | full)
  --pack <name>             official pack alias (core | quality | security | frontend | testing | release | enterprise)
  --target <name>           harness target (claude | codex | cursor | gemini | opencode)
  --harness <name>          alias for --target
  --module <id>             include an additional module, repeatable
  --without-module <id>     exclude a module, repeatable
  --component <id>          include a direct component, repeatable
  --without-component <id>  exclude a component, repeatable
  --project-root <dir>      annotate the intended target project root (dry-run still writes nothing)
  --target-root <dir>       alias for --project-root
  --list                    list available profiles, modules, components, and targets
  --json                    emit JSON
  --verbose                 print schema validation detail
  --help                    show this help

Examples:
  ./install.sh --plan --list
  ./install.sh --plan --profile core
  ./install.sh --plan --pack security
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
  const profilesDoc = checks.find(c => c.name === 'manifests/install-profiles')?.data;
  if (profilesDoc) {
    const safety = validateProfileSafety(profilesDoc);
    if (safety.warnings.length && verbose) {
      for (const warning of safety.warnings) console.error(`  [WARN] ${warning}`);
    }
    if (safety.errors.length) {
      ok = false;
      console.error('  [FAIL] profile safety');
      for (const err of safety.errors) console.error(`         ${err}`);
    } else if (verbose) {
      console.error('  [OK]   profile safety');
    }
  }
  return ok;
}

function plan(profileName, filters = {}) {
  const manifest = readYaml('agent.yaml');
  const profilesDoc = readJson('manifests/install-profiles.json');
  const modulesDoc = readJson('manifests/install-modules.json');
  const componentsDoc = readJson('manifests/install-components.json');

  const packName = filters.pack || null;
  const pack = resolvePack(profilesDoc, packName, profileName);
  const resolvedProfile = profileName || pack?.profile || manifest.profiles?.default || 'core';
  const profile = profilesDoc.profiles[resolvedProfile];
  if (!profile) {
    throw new Error(`unknown profile: ${resolvedProfile}. available: ${Object.keys(profilesDoc.profiles).join(', ')}`);
  }

  validateSelections({ manifest, modulesDoc, componentsDoc, filters });

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
    pack: packName || null,
    pack_description: pack?.description || null,
    pack_workflow: pack?.workflow || null,
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
    target_root: filters.projectRoot ? path.resolve(filters.projectRoot) : null,
    note: 'dry-run only. Use install-apply.js --apply to build target harness outputs.',
  };
}

function validateSelections({ manifest, modulesDoc, componentsDoc, filters }) {
  const availableTargets = (manifest.harnesses || []).map(h => h.name);
  const availableModules = Object.keys(modulesDoc.modules);
  const availableComponents = Object.keys(componentsDoc.components);

  if (filters.harness && !availableTargets.includes(filters.harness)) {
    throw new Error(`unknown target: ${filters.harness}. available: ${availableTargets.join(', ')}`);
  }

  for (const mid of [...(filters.modules || []), ...(filters.withoutModules || [])]) {
    if (!modulesDoc.modules[mid]) {
      throw new Error(`unknown module: ${mid}. available: ${availableModules.join(', ')}`);
    }
  }

  for (const cid of [...(filters.components || []), ...(filters.withoutComponents || [])]) {
    if (!componentsDoc.components[cid]) {
      throw new Error(`unknown component: ${cid}. available: ${availableComponents.join(', ')}`);
    }
  }
}

function resolvePack(profilesDoc, packName, profileName) {
  if (!packName) return null;
  if (profileName) throw new Error('--profile and --pack cannot be used together');
  const packs = profilesDoc.packs || {};
  const pack = packs[packName];
  if (!pack) {
    throw new Error(`unknown pack: ${packName}. available: ${Object.keys(packs).join(', ')}`);
  }
  if (!profilesDoc.profiles[pack.profile]) {
    throw new Error(`pack "${packName}" references unknown profile: ${pack.profile}`);
  }
  return pack;
}

function pushComponentRows(componentRows, moduleName, cid, comp, harnessFilter) {
  const targets = comp.target || {};
  const harnesses = Object.keys(targets);
  const filtered = harnessFilter ? harnesses.filter(h => h === harnessFilter) : harnesses;

  if (filtered.length === 0 && harnesses.length === 0) {
    const platformHarness = cid.startsWith('platform:') ? cid.slice('platform:'.length) : null;
    if (harnessFilter && platformHarness && platformHarness !== harnessFilter) return;

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
  if (p.pack) console.log('  pack         : ' + p.pack);
  console.log('  profile      : ' + p.profile);
  console.log('  description  : ' + p.profile_description);
  if (p.pack_workflow) console.log('  workflow     : ' + p.pack_workflow);
  if (p.harness_filter) console.log('  target       : ' + p.harness_filter);
  if (p.target_root) console.log('  target root  : ' + p.target_root);
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

function listCatalog() {
  const manifest = readYaml('agent.yaml');
  const profilesDoc = readJson('manifests/install-profiles.json');
  const modulesDoc = readJson('manifests/install-modules.json');
  const componentsDoc = readJson('manifests/install-components.json');

  return {
    harness_version: manifest.version,
    default_profile: manifest.profiles?.default || null,
    targets: (manifest.harnesses || []).map(h => ({
      name: h.name,
      output_dir: h.output_dir,
      builder: h.builder,
    })),
    packs: Object.entries(profilesDoc.packs || {}).map(([name, p]) => ({
      name,
      description: p.description,
      profile: p.profile,
      workflow: p.workflow,
      use_when: p.use_when || null,
    })),
    profiles: Object.entries(profilesDoc.profiles).map(([name, p]) => ({
      name,
      description: p.description,
      modules: p.modules,
      defaults: p.defaults || null,
    })),
    modules: Object.entries(modulesDoc.modules).map(([name, m]) => ({
      name,
      description: m.description,
      components: m.components,
      depends_on: m.depends_on || [],
      required: Boolean(m.required),
    })),
    components: Object.entries(componentsDoc.components).map(([name, c]) => ({
      name,
      type: c.type,
      source: c.source || c.builder || null,
      targets: Object.keys(c.target || {}),
      output_dir: c.output_dir || null,
    })),
  };
}

function printCatalog(catalog) {
  const bold = (s) => process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s;
  console.log('');
  console.log(bold(`HARNESS install catalog  (v${catalog.harness_version})`));
  console.log('  default profile: ' + catalog.default_profile);
  console.log('');

  console.log(bold('Targets'));
  for (const t of catalog.targets) {
    console.log(`  - ${t.name.padEnd(8)} ${t.output_dir.padEnd(12)} ${t.builder}`);
  }
  console.log('');

  if (catalog.packs.length) {
    console.log(bold('Official Packs'));
    for (const p of catalog.packs) {
      console.log(`  - ${p.name.padEnd(10)} profile=${p.profile.padEnd(10)} ${p.workflow}`);
    }
    console.log('');
  }

  console.log(bold('Profiles'));
  for (const p of catalog.profiles) {
    console.log(`  - ${p.name.padEnd(10)} ${p.modules.join(', ')}`);
  }
  console.log('');

  console.log(bold('Modules'));
  for (const m of catalog.modules) {
    const deps = m.depends_on.length ? ` deps=${m.depends_on.join(',')}` : '';
    const required = m.required ? ' required' : '';
    console.log(`  - ${m.name.padEnd(18)} ${m.components.length} components${required}${deps}`);
  }
  console.log('');

  console.log(bold('Components'));
  for (const c of catalog.components) {
    const targets = c.targets.length ? c.targets.join(',') : (c.output_dir ? `builder:${c.output_dir}` : '-');
    console.log(`  - ${c.name.padEnd(32)} ${String(c.type).padEnd(9)} ${targets}`);
  }
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

  if (args.list) {
    const catalog = listCatalog();
    if (args.json) process.stdout.write(JSON.stringify(catalog, null, 2) + '\n');
    else printCatalog(catalog);
    return;
  }

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
