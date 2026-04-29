#!/usr/bin/env node
// HARNESS install --plan : dry-run only.
// 1. agent.yaml + manifests 검증
// 2. 선택 프로파일이 어떤 모듈을 끌고 오고, 각 모듈이 어떤 컴포넌트를 가져가는지 출력
// 3. 실제 파일은 건드리지 않음

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------- arg parse ----------
function parseArgs(argv) {
  const args = { profile: null, harness: null, json: false, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--profile') args.profile = argv[++i];
    else if (a === '--harness') args.harness = argv[++i];
    else if (a === '--json') args.json = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`알 수 없는 인자: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
HARNESS install --plan

사용법:
  install.sh --plan [--profile <name>] [--harness <name>] [--json] [--verbose]

옵션:
  --profile <name>   설치할 프로파일 (core | developer | security | research | full)
                     생략 시 agent.yaml 의 profiles.default
  --harness <name>   특정 하네스만 (claude | codex | cursor | gemini | opencode)
                     생략 시 모든 하네스
  --json             JSON 출력
  --verbose          상세 로그
  --help             이 도움말

예:
  ./install.sh --plan --profile core
  ./install.sh --plan --profile developer --harness claude --json
`);
}

// ---------- IO helpers ----------
function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function readYaml(rel) {
  return YAML.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

// ---------- validation ----------
function validateAll(verbose) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const checks = [
    { name: 'agent.yaml',                  schema: 'schemas/agent-yaml.schema.json',          data: readYaml('agent.yaml') },
    { name: 'manifests/install-profiles',  schema: 'schemas/install-profiles.schema.json',    data: readJson('manifests/install-profiles.json') },
    { name: 'manifests/install-modules',   schema: 'schemas/install-modules.schema.json',     data: readJson('manifests/install-modules.json') },
    { name: 'manifests/install-components', schema: 'schemas/install-components.schema.json', data: readJson('manifests/install-components.json') },
  ];

  let ok = true;
  for (const c of checks) {
    const schema = readJson(c.schema);
    const validate = ajv.compile(schema);
    const valid = validate(c.data);
    if (!valid) {
      ok = false;
      console.error(`  [FAIL] ${c.name}`);
      for (const err of validate.errors || []) {
        console.error(`         ${err.instancePath} ${err.message}`);
      }
    } else if (verbose) {
      console.error(`  [OK]   ${c.name}`);
    }
  }
  return ok;
}

// ---------- planning ----------
function plan(profileName, harnessFilter) {
  const manifest = readYaml('agent.yaml');
  const profilesDoc = readJson('manifests/install-profiles.json');
  const modulesDoc = readJson('manifests/install-modules.json');
  const componentsDoc = readJson('manifests/install-components.json');

  const resolvedProfile = profileName || manifest.profiles?.default || 'core';
  const profile = profilesDoc.profiles[resolvedProfile];
  if (!profile) {
    throw new Error(`알 수 없는 프로파일: ${resolvedProfile}. 사용 가능: ${Object.keys(profilesDoc.profiles).join(', ')}`);
  }

  // 모듈 의존성 전이 해석
  const seen = new Set();
  const queue = [...profile.modules];
  while (queue.length) {
    const m = queue.shift();
    if (seen.has(m)) continue;
    seen.add(m);
    const def = modulesDoc.modules[m];
    if (!def) throw new Error(`모듈 정의 없음: ${m}`);
    for (const dep of def.depends_on || []) queue.push(dep);
  }
  const modules = [...seen];

  // 컴포넌트 수집 + 하네스별 타겟 펼치기
  const componentRows = [];
  for (const m of modules) {
    const def = modulesDoc.modules[m];
    for (const cid of def.components) {
      const comp = componentsDoc.components[cid];
      if (!comp) {
        componentRows.push({ module: m, component: cid, type: '???', missing: true });
        continue;
      }
      const targets = comp.target || {};
      const harnesses = Object.keys(targets);
      const filtered = harnessFilter ? harnesses.filter(h => h === harnessFilter) : harnesses;
      if (filtered.length === 0 && Object.keys(targets).length === 0) {
        // platform 같은 빌더 컴포넌트는 target 없음
        componentRows.push({
          module: m,
          component: cid,
          type: comp.type,
          source: comp.source || comp.builder || '-',
          harness: '(builder)',
          target: comp.output_dir || '-',
        });
      } else {
        for (const h of filtered) {
          componentRows.push({
            module: m,
            component: cid,
            type: comp.type,
            source: comp.source || '-',
            harness: h,
            target: targets[h],
          });
        }
      }
    }
  }

  return {
    harness_version: manifest.version,
    profile: resolvedProfile,
    profile_description: profile.description,
    profile_defaults: profile.defaults || null,
    modules,
    component_count: componentRows.length,
    components: componentRows,
    harness_filter: harnessFilter || null,
    note: '이것은 dry-run 입니다. 실제 적용은 --apply 와 함께 install-apply.js 로 (Day 5 이후)',
  };
}

// ---------- output ----------
function printPlan(p) {
  const C = (s) => process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s;
  console.log('');
  console.log(C(`HARNESS install --plan  (v${p.harness_version})`));
  console.log('  profile      : ' + p.profile);
  console.log('  description  : ' + p.profile_description);
  if (p.harness_filter) console.log('  harness      : ' + p.harness_filter);
  if (p.profile_defaults) {
    console.log('  defaults     : ' + JSON.stringify(p.profile_defaults));
  }
  console.log('  modules (' + p.modules.length + ') : ' + p.modules.join(', '));
  console.log('  components   : ' + p.component_count);
  console.log('');

  // 그룹: 모듈별
  const byModule = new Map();
  for (const r of p.components) {
    if (!byModule.has(r.module)) byModule.set(r.module, []);
    byModule.get(r.module).push(r);
  }
  for (const [m, rows] of byModule) {
    console.log(C(`  [${m}]`));
    for (const r of rows) {
      const missing = r.missing ? '  [MISSING-DEFINITION]' : '';
      console.log(`    - ${r.type.padEnd(9)} ${r.component.padEnd(30)} ${r.harness.padEnd(10)} ${r.target || ''}${missing}`);
    }
  }

  console.log('');
  console.log('NOTE: ' + p.note);
  console.log('');
}

// ---------- main ----------
async function main() {
  const args = parseArgs(process.argv);

  if (args.verbose) console.error('=> 매니페스트 검증');
  const ok = validateAll(args.verbose);
  if (!ok) {
    console.error('');
    console.error('FAIL: 매니페스트 검증 실패. 위 오류를 먼저 고치십시오.');
    process.exit(1);
  }
  if (args.verbose) console.error('=> 검증 통과');

  let p;
  try {
    p = plan(args.profile, args.harness);
  } catch (e) {
    console.error('FAIL: ' + e.message);
    process.exit(1);
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(p, null, 2) + '\n');
  } else {
    printPlan(p);
  }
}

main().catch((e) => {
  console.error('UNEXPECTED:', e?.stack || e);
  process.exit(1);
});
