#!/usr/bin/env node
// 정규 카탈로그 → .opencode/ 로 투영.
// opencode 형식: JSON 단일 설정 (config_format: json).
// agents/skills/hooks 를 모두 JSON 배열로 합성.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { buildRoots } from './core/build-roots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { sourceRoot: ROOT, targetRoot: TARGET_ROOT } = buildRoots(path.resolve(__dirname, '..'));
const OUT = path.join(TARGET_ROOT, '.opencode');

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }

console.log('=> build-opencode');
ensure(OUT);

const manifest = YAML.parse(fs.readFileSync(path.join(ROOT, 'agent.yaml'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// agents 모으기
const agents = [];
const agentsDir = path.join(ROOT, 'agents');
if (fs.existsSync(agentsDir)) {
  for (const f of fs.readdirSync(agentsDir)) {
    if (!f.endsWith('.md')) continue;
    const content = fs.readFileSync(path.join(agentsDir, f), 'utf8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = YAML.parse(fmMatch[1]);
    const body = content.slice(fmMatch[0].length).trim();
    agents.push({
      name: fm.name,
      description: fm.description || '',
      provider: fm.provider || 'unknown',
      model: fm.model || 'unknown',
      sandbox: fm.sandbox || 'read-only',
      tools_disallowed: fm.disallowedTools || [],
      hand_off_to: fm.hand_off_to || [],
      fact_forcing: !!fm.fact_forcing,
      prompt: body,
    });
  }
}

// skills 모으기 (description 만 — progressive disclosure)
const skills = [];
const skillsDir = path.join(ROOT, 'skills');
if (fs.existsSync(skillsDir)) {
  for (const e of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const file = path.join(skillsDir, e.name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = YAML.parse(fmMatch[1]);
    skills.push({
      name: fm.name || e.name,
      description: fm.description || '',
      path: `skills/${e.name}/SKILL.md`,
    });
  }
}

// hooks 그대로 변환
let hooks = null;
const hooksFile = path.join(ROOT, 'hooks', 'hooks.json');
if (fs.existsSync(hooksFile)) {
  hooks = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
}

// MCP servers
const mcpServers = (manifest.mcp?.external_servers || []).map(s => ({
  name: s.name,
  ...(s.pin ? { command: 'npx', args: ['-y', s.pin] } : {}),
  ...(s.url ? { url: s.url, type: 'http' } : {}),
}));

// 단일 config.json
const config = {
  $schema: 'https://opencode.dev/schemas/config.schema.json',
  name: 'harness',
  version: pkg.version,
  description: pkg.description,
  agents,
  skills,
  hooks: hooks || null,
  mcp: { servers: mcpServers },
  profiles: manifest.profiles || null,
  security: manifest.security || null,
  routing: manifest.routing || null,
};

fs.writeFileSync(path.join(OUT, 'config.json'), JSON.stringify(config, null, 2));
console.log(`  config.json: OK (agents=${agents.length}, skills=${skills.length}, mcp=${mcpServers.length})`);

// hooks/scripts/ → .opencode/hooks/ (실 스크립트 파일 필요)
if (fs.existsSync(path.join(ROOT, 'hooks', 'scripts'))) {
  ensure(path.join(OUT, 'hooks'));
  for (const f of fs.readdirSync(path.join(ROOT, 'hooks', 'scripts'))) {
    fs.copyFileSync(path.join(ROOT, 'hooks', 'scripts', f), path.join(OUT, 'hooks', f));
  }
  console.log(`  hooks/     : ${fs.readdirSync(path.join(OUT, 'hooks')).length} files`);
}

// 거버넌스 마크다운 (요약)
for (const f of ['AGENTS.md', 'RULES.md', 'SOUL.md']) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
}
console.log('  governance : OK');

console.log('=> .opencode 빌드 완료');
