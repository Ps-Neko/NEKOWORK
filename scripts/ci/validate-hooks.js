#!/usr/bin/env node
// hooks/hooks.json 이 schemas/hooks.schema.json 을 만족하고
// 참조하는 스크립트 파일이 실제 존재하는지 검증.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const errors = [];
const warnings = [];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

const schema = JSON.parse(read('schemas/hooks.schema.json'));
const manifest = YAML.parse(read('agent.yaml'));

const hooksFile = manifest.hooks?.file || 'hooks/hooks.json';
const hooksPath = path.join(ROOT, hooksFile);
if (!fs.existsSync(hooksPath)) {
  console.log(`HARNESS validate-hooks`);
  console.log(`  오류: ${hooksFile} 없음`);
  process.exit(1);
}

let hooksDef;
try {
  hooksDef = JSON.parse(read(hooksFile));
} catch (e) {
  console.log(`HARNESS validate-hooks`);
  console.log(`  오류: ${hooksFile} JSON 파싱 실패 — ${e.message}`);
  process.exit(1);
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

if (!validate(hooksDef)) {
  for (const err of validate.errors || []) {
    errors.push(`${hooksFile}: ${err.instancePath || '/'} ${err.message}`);
  }
}

// 활성 훅 매니페스트와 실 정의 비교
const activeDeclared = new Set(manifest.hooks?.active || []);
const activeFound = new Set();
const events = ['PreToolUse', 'PostToolUse', 'PreCompact', 'Stop', 'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PostToolUseFailure'];

let entryCount = 0;
for (const ev of events) {
  for (const e of hooksDef[ev] || []) {
    entryCount++;
    // 스크립트 파일 존재?
    const scriptRel = e.hook;
    const scriptPath = path.join(ROOT, 'hooks', scriptRel);
    if (!fs.existsSync(scriptPath)) {
      errors.push(`${hooksFile}: ${ev} 의 ${scriptRel} 가 hooks/ 안에 없음`);
    }
    // env_toggle 에서 활성 이름 추출 (HARNESS_HOOK_<NAME>)
    if (e.env_toggle) {
      const name = e.env_toggle.replace(/^HARNESS_HOOK_/, '').toLowerCase().replace(/_/g, '-');
      activeFound.add(name);
    }
  }
}

for (const a of activeDeclared) {
  // 매니페스트의 active 는 약식 이름이라 dash 차이를 허용하기 위해 양쪽 모두 정규화 후 비교
  const aNorm = a.replace(/-/g, '');
  const found = [...activeFound].some(f => {
    const fNorm = f.replace(/-/g, '');
    return fNorm.includes(aNorm) || aNorm.includes(fNorm);
  });
  if (!found) warnings.push(`agent.yaml hooks.active 의 "${a}" 가 hooks.json 에 매핑되는 env_toggle 미발견`);
}

console.log(`HARNESS validate-hooks`);
console.log(`  file     : ${hooksFile}`);
console.log(`  entries  : ${entryCount}`);
console.log(`  declared active: ${activeDeclared.size}`);

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
