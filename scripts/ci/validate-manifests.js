#!/usr/bin/env node
// agent.yaml + manifests/install-{profiles,modules,components}.json 검증.
// 1) 각 파일 schema 통과
// 2) 프로파일 → 모듈 → 컴포넌트 그래프의 참조 무결성

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const errors = [];
const warnings = [];

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function readYaml(rel) { return YAML.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const checks = [
  { name: 'agent.yaml',                     schema: 'schemas/agent-yaml.schema.json',          load: () => readYaml('agent.yaml') },
  { name: 'manifests/install-profiles.json',schema: 'schemas/install-profiles.schema.json',    load: () => readJson('manifests/install-profiles.json') },
  { name: 'manifests/install-modules.json', schema: 'schemas/install-modules.schema.json',     load: () => readJson('manifests/install-modules.json') },
  { name: 'manifests/install-components.json', schema: 'schemas/install-components.schema.json',load: () => readJson('manifests/install-components.json') },
];

const loaded = {};
for (const c of checks) {
  let data;
  try {
    data = c.load();
  } catch (e) {
    errors.push(`${c.name}: 로드 실패 — ${e.message}`);
    continue;
  }
  loaded[c.name] = data;

  let schema;
  try {
    schema = readJson(c.schema);
  } catch (e) {
    errors.push(`${c.schema}: 로드 실패 — ${e.message}`);
    continue;
  }
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    for (const err of validate.errors || []) {
      errors.push(`${c.name}: ${err.instancePath || '/'} ${err.message}`);
    }
  }
}

// 참조 무결성
const profilesDoc = loaded['manifests/install-profiles.json'];
const modulesDoc = loaded['manifests/install-modules.json'];
const componentsDoc = loaded['manifests/install-components.json'];
const manifest = loaded['agent.yaml'];

if (profilesDoc && modulesDoc) {
  for (const [pid, p] of Object.entries(profilesDoc.profiles || {})) {
    for (const mid of p.modules || []) {
      if (!modulesDoc.modules?.[mid]) {
        errors.push(`profile "${pid}" → 미정의 모듈 "${mid}"`);
      }
    }
  }
}

if (modulesDoc && componentsDoc) {
  for (const [mid, m] of Object.entries(modulesDoc.modules || {})) {
    for (const cid of m.components || []) {
      if (!componentsDoc.components?.[cid]) {
        errors.push(`module "${mid}" → 미정의 컴포넌트 "${cid}"`);
      }
    }
    for (const dep of m.depends_on || []) {
      if (!modulesDoc.modules?.[dep]) {
        errors.push(`module "${mid}" → 미정의 의존 모듈 "${dep}"`);
      }
    }
  }
}

if (manifest && modulesDoc) {
  for (const m of manifest.modules || []) {
    if (!modulesDoc.modules?.[m]) {
      errors.push(`agent.yaml modules 에 미정의 "${m}" 선언`);
    }
  }
  // default profile 존재?
  const def = manifest.profiles?.default;
  if (def && !profilesDoc?.profiles?.[def]) {
    errors.push(`agent.yaml profiles.default "${def}" 가 install-profiles.json 에 없음`);
  }
}

console.log(`HARNESS validate-manifests`);
console.log(`  agent.yaml + 3 manifest schemas`);
if (profilesDoc) console.log(`  profiles  : ${Object.keys(profilesDoc.profiles || {}).length}`);
if (modulesDoc) console.log(`  modules   : ${Object.keys(modulesDoc.modules || {}).length}`);
if (componentsDoc) console.log(`  components: ${Object.keys(componentsDoc.components || {}).length}`);

if (warnings.length) {
  console.log('');
  console.log(`경고 (${warnings.length}):`);
  for (const w of warnings) console.log('  - ' + w);
}

if (errors.length) {
  console.log('');
  console.log(`오류 (${errors.length}):`);
  for (const e of errors) console.log('  - ' + e);
  process.exit(1);
}

console.log('  통과');
