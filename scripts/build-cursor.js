#!/usr/bin/env node
// 정규 카탈로그 → .cursor/ 로 투영.
// Cursor 형식: .cursor/rules/*.mdc (공식), .cursorrules (legacy 공유 룰).
// 이벤트 어댑터: hook 의 PreToolUse/PostToolUse 등 PascalCase → before/after camelCase.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { buildRoots } from './core/build-roots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { sourceRoot: ROOT, targetRoot: TARGET_ROOT } = buildRoots(path.resolve(__dirname, '..'));
const OUT = path.join(TARGET_ROOT, '.cursor');

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }

console.log('=> build-cursor');
ensure(OUT);
ensure(path.join(OUT, 'rules'));

// agents/<name>.md → .cursor/rules/agents/<name>.mdc (frontmatter alwaysApply: false, glob: **)
const agentsDir = path.join(ROOT, 'agents');
let agentN = 0;
ensure(path.join(OUT, 'rules', 'agents'));
if (fs.existsSync(agentsDir)) {
  for (const f of fs.readdirSync(agentsDir)) {
    if (!f.endsWith('.md')) continue;
    const content = fs.readFileSync(path.join(agentsDir, f), 'utf8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = YAML.parse(fmMatch[1]);
    const body = content.slice(fmMatch[0].length).trim();
    const mdc = `---
description: ${JSON.stringify(fm.description || fm.name)}
alwaysApply: false
globs: ["**/*"]
provider: ${fm.provider || 'unknown'}
model: ${fm.model || 'unknown'}
---

${body}
`;
    fs.writeFileSync(path.join(OUT, 'rules', 'agents', fm.name + '.mdc'), mdc);
    agentN++;
  }
}
console.log(`  agents     : ${agentN} (rules/agents/*.mdc)`);

// skills/<name>/SKILL.md → .cursor/rules/skills/<name>.mdc (alwaysApply: true)
const skillsDir = path.join(ROOT, 'skills');
let skillN = 0;
ensure(path.join(OUT, 'rules', 'skills'));
if (fs.existsSync(skillsDir)) {
  for (const e of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const file = path.join(skillsDir, e.name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    const fm = fmMatch ? YAML.parse(fmMatch[1]) : { name: e.name };
    const body = fmMatch ? content.slice(fmMatch[0].length).trim() : content;
    const mdc = `---
description: ${JSON.stringify(fm.description || fm.name)}
alwaysApply: false
globs: ["**/*"]
---

${body}
`;
    fs.writeFileSync(path.join(OUT, 'rules', 'skills', e.name + '.mdc'), mdc);
    skillN++;
  }
}
console.log(`  skills     : ${skillN} (rules/skills/*.mdc)`);

// hooks → .cursor/hooks.json (이벤트 이름 PascalCase → camelCase: before/after Tool)
const hooksFile = path.join(ROOT, 'hooks', 'hooks.json');
if (fs.existsSync(hooksFile)) {
  const def = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
  const remap = (arr) => (arr || []).map(e => ({ ...e, hook: e.hook.replace(/^scripts\//, 'hooks/') }));
  const eventMap = {
    PreToolUse: 'beforeTool',
    PostToolUse: 'afterTool',
    PreCompact: 'beforeCompact',
    Stop: 'sessionStop',
    SessionStart: 'sessionStart',
    SessionEnd: 'sessionEnd',
    UserPromptSubmit: 'userPromptSubmit',
  };
  const cursorHooks = { version: def.version };
  for (const [src, dst] of Object.entries(eventMap)) {
    const arr = remap(def[src]);
    if (arr.length) cursorHooks[dst] = arr;
  }
  fs.writeFileSync(path.join(OUT, 'hooks.json'), JSON.stringify(cursorHooks, null, 2));
  console.log('  hooks.json : OK (camelCase)');

  // hooks/scripts/ → .cursor/hooks/
  ensure(path.join(OUT, 'hooks'));
  const hookScriptsDir = path.join(ROOT, 'hooks', 'scripts');
  if (fs.existsSync(hookScriptsDir)) {
    for (const f of fs.readdirSync(hookScriptsDir)) {
      fs.copyFileSync(path.join(hookScriptsDir, f), path.join(OUT, 'hooks', f));
    }
  }
}

// .cursorrules — 단일 진입 가이드
const manifest = YAML.parse(fs.readFileSync(path.join(ROOT, 'agent.yaml'), 'utf8'));
const cursorrules = `# Auto-generated. agent.yaml + agents/*.md 가 원본.
# HARNESS v${manifest.version} — Cursor 어댑터

이 워크스페이스는 HARNESS 카탈로그를 기반으로 한다.
.cursor/rules/agents/  : 11개 에이전트 (provider/model 메타데이터 포함)
.cursor/rules/skills/  : ${manifest.skills?.length || 0}개 스킬 (claude-led-codex-review 등)
.cursor/hooks.json     : Cursor 이벤트 (beforeTool/afterTool/...) 어댑터

직접 편집 금지. 변경은 정규 카탈로그(agents/, skills/, agent.yaml)에서 하고
\`scripts/build-cursor.js\` 를 다시 실행할 것.
`;
fs.writeFileSync(path.join(OUT, '.cursorrules'), cursorrules);
console.log('  .cursorrules: OK');

// AGENTS.md / RULES.md / SOUL.md 그대로 복사
for (const f of ['AGENTS.md', 'RULES.md', 'SOUL.md', 'WORKING-CONTEXT.md']) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
}
console.log('  governance : OK');

console.log('=> .cursor 빌드 완료');
