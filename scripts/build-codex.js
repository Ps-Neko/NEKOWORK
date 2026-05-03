#!/usr/bin/env node
// 정규 카탈로그 → .codex/ 로 투영.
// Codex CLI 형식: config.toml + agents/*.toml.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { buildRoots } from './core/build-roots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { sourceRoot: ROOT, targetRoot: TARGET_ROOT } = buildRoots(path.resolve(__dirname, '..'));
const OUT = path.join(TARGET_ROOT, '.codex');

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }

console.log('=> build-codex');
ensure(OUT);
ensure(path.join(OUT, 'agents'));

// agents/<name>.md → .codex/agents/<name>.toml (Codex provider 만)
const agentsDir = path.join(ROOT, 'agents');
let n = 0;
if (fs.existsSync(agentsDir)) {
  for (const f of fs.readdirSync(agentsDir)) {
    if (!f.endsWith('.md')) continue;
    const content = fs.readFileSync(path.join(agentsDir, f), 'utf8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = YAML.parse(fmMatch[1]);
    if (fm.provider !== 'codex') continue;
    const body = content.slice(fmMatch[0].length).trim();
    const tomlEsc = (s) => '"""' + String(s).replace(/"""/g, '\\"\\"\\"') + '"""';
    const toml = `# 자동 생성. agents/${f} 가 원본.
name = "${fm.name}"
description = ${tomlEsc(fm.description)}
model = "${fm.model}"

[sandbox]
mode = "${fm.sandbox || 'read-only'}"
network_access = ${fm.network_access === false ? 'false' : 'true'}

[prompt]
body = ${tomlEsc(body)}
`;
    const out = path.join(OUT, 'agents', fm.name + '.toml');
    fs.writeFileSync(out, toml);
    n++;
  }
}
console.log(`  agents     : ${n} (codex provider 만)`);

// .codex/config.toml — MCP 서버 + profiles
const manifest = YAML.parse(fs.readFileSync(path.join(ROOT, 'agent.yaml'), 'utf8'));
const lines = [];
lines.push('# 자동 생성. agent.yaml 이 원본.\n');
lines.push('multi_agent = true\n');

for (const s of (manifest.mcp?.external_servers || [])) {
  lines.push(`[mcp_servers.${s.name}]`);
  if (s.pin) {
    lines.push('command = "npx"');
    lines.push(`args = ["-y", "${s.pin}"]`);
    lines.push('startup_timeout_sec = 30');
  } else if (s.url) {
    lines.push(`url = "${s.url}"`);
    lines.push('type = "http"');
  }
  lines.push('');
}

lines.push('[profiles.review]');
lines.push('sandbox_mode = "read-only"');
lines.push('network_access = false');
lines.push('');
lines.push('[profiles.strict]');
lines.push('sandbox_mode = "read-only"');
lines.push('network_access = false');
lines.push('');
lines.push('[profiles.workspace]');
lines.push('sandbox_mode = "workspace-write"');
lines.push('network_access = true');

fs.writeFileSync(path.join(OUT, 'config.toml'), lines.join('\n') + '\n');
console.log('  config.toml: OK');

// AGENTS.md 만 그대로 (Codex 표준)
if (fs.existsSync(path.join(ROOT, 'AGENTS.md'))) {
  fs.copyFileSync(path.join(ROOT, 'AGENTS.md'), path.join(OUT, 'AGENTS.md'));
  console.log('  AGENTS.md  : OK');
}

console.log('=> .codex 빌드 완료');
