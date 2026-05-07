#!/usr/bin/env node
// 정규 카탈로그 무결성 체크. agent.yaml 의 agents/skills/commands 가
// 실제 파일과 일치하는지, 모듈이 누락 없이 컴포넌트를 참조하는지.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { validateProfileSafety } from '../lib/profile-safety.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const errors = [];
const warnings = [];

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

const manifest = YAML.parse(fs.readFileSync(path.join(ROOT, 'agent.yaml'), 'utf8'));

// 1. agents/<name>.md 가 모두 존재하는가?
for (const a of manifest.agents || []) {
  if (!exists(`agents/${a}.md`)) {
    warnings.push(`agent file missing: agents/${a}.md`);
  }
}

// 2. skills/<name>/SKILL.md 존재?
for (const s of manifest.skills || []) {
  if (!exists(`skills/${s}/SKILL.md`)) {
    warnings.push(`skill file missing: skills/${s}/SKILL.md`);
  }
}

// 3. commands/<name>.md 존재?
for (const c of manifest.commands || []) {
  if (!exists(`commands/${c}.md`)) {
    warnings.push(`command file missing: commands/${c}.md`);
  }
}

// 4. hooks/hooks.json 존재?
if (manifest.hooks?.file && !exists(manifest.hooks.file)) {
  warnings.push(`hooks file missing: ${manifest.hooks.file}`);
}

// 5. 모듈 ↔ 컴포넌트 일관성
const modules = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/install-modules.json'), 'utf8'));
const components = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/install-components.json'), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/install-profiles.json'), 'utf8'));

for (const [mid, m] of Object.entries(modules.modules)) {
  for (const cid of m.components) {
    if (!components.components[cid]) {
      errors.push(`module "${mid}" references missing component: ${cid}`);
    }
  }
}

// 6. 프로파일 ↔ 모듈 일관성
for (const [pid, p] of Object.entries(profiles.profiles)) {
  for (const mid of p.modules) {
    if (!modules.modules[mid]) {
      errors.push(`profile "${pid}" references missing module: ${mid}`);
    }
  }
}

const profileSafety = validateProfileSafety(profiles);
errors.push(...profileSafety.errors);
warnings.push(...profileSafety.warnings);

// 7. 매니페스트 modules 와 install-modules 동기화
const manifestModules = new Set(manifest.modules || []);
const definedModules = new Set(Object.keys(modules.modules));
for (const m of manifestModules) {
  if (!definedModules.has(m)) errors.push(`agent.yaml lists undefined module: ${m}`);
}

// 출력
function color(s, c) {
  if (!process.stdout.isTTY) return s;
  const codes = { red: 31, yellow: 33, green: 32, bold: 1 };
  return `\x1b[${codes[c]}m${s}\x1b[0m`;
}

console.log('');
console.log(color('HARNESS catalog integrity check', 'bold'));
console.log('');

if (warnings.length) {
  console.log(color(`경고 (${warnings.length}):`, 'yellow'));
  for (const w of warnings) console.log('  - ' + w);
  console.log('');
}

if (errors.length) {
  console.log(color(`오류 (${errors.length}):`, 'red'));
  for (const e of errors) console.log('  - ' + e);
  console.log('');
  process.exit(1);
}

console.log(color('통과', 'green'));
console.log(`  agents       선언 ${manifest.agents?.length || 0}, 파일 ${countExisting('agents', manifest.agents, '.md')}`);
console.log(`  skills       선언 ${manifest.skills?.length || 0}, 파일 ${countExistingDir('skills', manifest.skills, 'SKILL.md')}`);
console.log(`  commands     선언 ${manifest.commands?.length || 0}, 파일 ${countExisting('commands', manifest.commands, '.md')}`);
console.log(`  modules      ${Object.keys(modules.modules).length}`);
console.log(`  components   ${Object.keys(components.components).length}`);
console.log(`  profiles     ${Object.keys(profiles.profiles).length}`);
console.log('');

function countExisting(dir, list, ext) {
  return (list || []).filter(n => exists(`${dir}/${n}${ext}`)).length;
}
function countExistingDir(dir, list, file) {
  return (list || []).filter(n => exists(`${dir}/${n}/${file}`)).length;
}
