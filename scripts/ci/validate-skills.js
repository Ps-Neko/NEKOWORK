#!/usr/bin/env node
// skills/<name>/SKILL.md frontmatter 가 schemas/skill.schema.json 을 만족하는지 검증.
// agent.yaml 의 skills 목록과 실 디렉터리 일치 여부도 체크.

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

const schema = JSON.parse(read('schemas/skill.schema.json'));
const manifest = YAML.parse(read('agent.yaml'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const declared = new Set(manifest.skills || []);
const found = new Set();

const skillsDir = path.join(ROOT, 'skills');
if (!fs.existsSync(skillsDir)) {
  errors.push('skills/ 디렉터리 없음');
} else {
  for (const e of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    found.add(e.name);

    const file = path.join(skillsDir, e.name, 'SKILL.md');
    if (!fs.existsSync(file)) {
      errors.push(`skills/${e.name}/SKILL.md 없음`);
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      errors.push(`skills/${e.name}/SKILL.md: frontmatter 없음`);
      continue;
    }

    let fm;
    try {
      fm = YAML.parse(fmMatch[1]);
    } catch (err) {
      errors.push(`skills/${e.name}/SKILL.md: frontmatter YAML 파싱 실패 — ${err.message}`);
      continue;
    }

    if (!validate(fm)) {
      for (const err of validate.errors || []) {
        errors.push(`skills/${e.name}/SKILL.md: ${err.instancePath || '/'} ${err.message}`);
      }
      continue;
    }

    if (fm.name !== e.name) {
      errors.push(`skills/${e.name}/SKILL.md: name "${fm.name}" 가 디렉터리명 "${e.name}" 와 다름`);
    }
  }
}

for (const s of declared) {
  if (!found.has(s)) errors.push(`agent.yaml 에 선언된 "${s}" 의 디렉터리 없음 (skills/${s}/)`);
}
for (const s of found) {
  if (!declared.has(s)) warnings.push(`skills/${s}/ 가 agent.yaml 에 선언 안 됨`);
}

console.log(`HARNESS validate-skills`);
console.log(`  declared : ${declared.size}, found : ${found.size}`);

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
