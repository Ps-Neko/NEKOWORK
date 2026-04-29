#!/usr/bin/env node
// 정규 카탈로그 → .gemini/ 로 투영.
// Gemini 형식: 요약 중심 (output_format: summary). 풀 본문은 정규 카탈로그를 참조.
// GEMINI.md 가 단일 진입점, 스킬은 description 만 노출 (progressive disclosure).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.gemini');

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }

console.log('=> build-gemini');
ensure(OUT);

const manifest = YAML.parse(fs.readFileSync(path.join(ROOT, 'agent.yaml'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// GEMINI.md — 단일 진입점 + 스킬/에이전트 description 카탈로그 (포인터만)
const lines = [];
lines.push('# GEMINI.md');
lines.push('');
lines.push(`> 자동 생성. agent.yaml v${manifest.version} 이 원본.`);
lines.push('> Gemini provider 가 받는 컨텍스트는 요약 형태. 풀 본문은 정규 카탈로그 참조.');
lines.push('');
lines.push('## 운영 원칙 (요약)');
lines.push('');
lines.push('- 한국어 응답 기본 (외부 영어 PR 환영).');
lines.push('- 사실 조사 강제: Edit/Write 직전 importer/API/schema 확인.');
lines.push('- read-only 기본. 사이드 이펙트는 명시 승인 후.');
lines.push('- 모든 수정은 quality-gate → self-review → codex-review → human-gate 순.');
lines.push('');

lines.push('## 에이전트 (Gemini provider 전용)');
lines.push('');
lines.push('| Agent | Model | 용도 |');
lines.push('|---|---|---|');
const agentsDir = path.join(ROOT, 'agents');
let geminiAgentN = 0;
const allAgents = [];
if (fs.existsSync(agentsDir)) {
  for (const f of fs.readdirSync(agentsDir)) {
    if (!f.endsWith('.md')) continue;
    const content = fs.readFileSync(path.join(agentsDir, f), 'utf8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = YAML.parse(fmMatch[1]);
    allAgents.push(fm);
    if (fm.provider === 'gemini') {
      lines.push(`| ${fm.name} | ${fm.model || '?'} | ${fm.description || ''} |`);
      geminiAgentN++;
    }
  }
}
if (geminiAgentN === 0) lines.push('| _(없음)_ | - | - |');
lines.push('');

lines.push('## 전체 에이전트 (참조용)');
lines.push('');
lines.push('| Agent | Provider | 핸드오프 가능 |');
lines.push('|---|---|---|');
for (const a of allAgents) {
  lines.push(`| ${a.name} | ${a.provider || '?'} | ${a.provider === 'gemini' ? '✓' : '읽기 전용 핸드오프 수신'} |`);
}
lines.push('');

lines.push('## 스킬 카탈로그 (description 만)');
lines.push('');
const skillsDir = path.join(ROOT, 'skills');
const skillRows = [];
if (fs.existsSync(skillsDir)) {
  for (const e of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const file = path.join(skillsDir, e.name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const fmMatch = fs.readFileSync(file, 'utf8').match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = YAML.parse(fmMatch[1]);
    skillRows.push({ name: fm.name || e.name, desc: fm.description || '' });
  }
}
for (const s of skillRows) {
  lines.push(`- **${s.name}** — ${s.desc}`);
}
lines.push('');
lines.push('> 풀 본문이 필요하면 정규 카탈로그 \`skills/<name>/SKILL.md\` 를 직접 읽을 것.');
lines.push('');

lines.push('## MCP 서버 (참고)');
lines.push('');
for (const s of (manifest.mcp?.external_servers || [])) {
  if (s.pin) lines.push(`- ${s.name}: \`${s.pin}\``);
  else if (s.url) lines.push(`- ${s.name}: ${s.url}`);
}
lines.push('');

fs.writeFileSync(path.join(OUT, 'GEMINI.md'), lines.join('\n'));
console.log(`  GEMINI.md  : OK (agents=${geminiAgentN}/${allAgents.length}, skills=${skillRows.length})`);

// settings.json — Gemini CLI 가 읽는 가벼운 설정
const settings = {
  $schema: 'https://gemini.dev/schemas/settings.schema.json',
  harness_version: pkg.version,
  context_files: ['GEMINI.md'],
  provider_filter: 'gemini',
  fact_forcing: manifest.security?.fact_forcing_default ?? true,
  outbound_network_default: manifest.security?.outbound_network_default || 'deny',
};
fs.writeFileSync(path.join(OUT, 'settings.json'), JSON.stringify(settings, null, 2));
console.log('  settings.json: OK');

console.log('=> .gemini 빌드 완료');
