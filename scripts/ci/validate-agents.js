#!/usr/bin/env node
// agents/<name>.md frontmatter 가 schemas/agent.schema.json 을 만족하는지 검증.
// agent.yaml 의 agents 목록과 실 파일 일치 여부도 체크.

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

const schema = JSON.parse(read('schemas/agent.schema.json'));
const manifest = YAML.parse(read('agent.yaml'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const declared = new Set(manifest.agents || []);
const found = new Set();

const agentsDir = path.join(ROOT, 'agents');
if (!fs.existsSync(agentsDir)) {
  errors.push('agents/ 디렉터리 없음');
} else {
  for (const f of fs.readdirSync(agentsDir)) {
    if (!f.endsWith('.md')) continue;
    const stem = f.replace(/\.md$/, '');
    found.add(stem);

    const content = read(`agents/${f}`);
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      errors.push(`agents/${f}: frontmatter 없음`);
      continue;
    }

    let fm;
    try {
      fm = YAML.parse(fmMatch[1]);
    } catch (e) {
      errors.push(`agents/${f}: frontmatter YAML 파싱 실패 — ${e.message}`);
      continue;
    }

    if (!validate(fm)) {
      for (const err of validate.errors || []) {
        errors.push(`agents/${f}: ${err.instancePath || '/'} ${err.message}`);
      }
      continue;
    }

    if (fm.name !== stem) {
      errors.push(`agents/${f}: name "${fm.name}" 가 파일명 "${stem}" 와 다름`);
    }
  }
}

for (const a of declared) {
  if (!found.has(a)) errors.push(`agent.yaml 에 선언된 "${a}" 의 파일 없음 (agents/${a}.md)`);
}
for (const a of found) {
  if (!declared.has(a)) warnings.push(`agents/${a}.md 가 agent.yaml 에 선언 안 됨`);
}

console.log(`HARNESS validate-agents`);
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
