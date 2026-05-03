#!/usr/bin/env node
// 정규 카탈로그 (agents/, skills/, commands/, hooks/) → .claude/ 로 투영.
// Claude Code 가 인식하는 디렉터리 레이아웃 + .claude-plugin/plugin.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRoots } from './core/build-roots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { sourceRoot: ROOT, targetRoot: TARGET_ROOT } = buildRoots(path.resolve(__dirname, '..'));
const OUT = path.join(TARGET_ROOT, '.claude');

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
function copy(src, dst) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) n += copyDir(s, d);
    else { copy(s, d); n++; }
  }
  return n;
}

console.log('=> build-claude');
ensure(OUT);

// agents/ → .claude/agents/
const agents = copyDir(path.join(ROOT, 'agents'), path.join(OUT, 'agents'));
console.log(`  agents     : ${agents}`);

// skills/ → .claude/skills/
const skills = copyDir(path.join(ROOT, 'skills'), path.join(OUT, 'skills'));
console.log(`  skills     : ${skills}`);

// commands/ → .claude/commands/
const cmds = copyDir(path.join(ROOT, 'commands'), path.join(OUT, 'commands'));
console.log(`  commands   : ${cmds}`);

// hooks/scripts/ → .claude/hooks/
const hookScripts = copyDir(path.join(ROOT, 'hooks', 'scripts'), path.join(OUT, 'hooks'));
console.log(`  hooks      : ${hookScripts}`);

// hooks/hooks.json → .claude/hooks.json (Claude Code 형식: top-level)
const hooksJson = path.join(ROOT, 'hooks', 'hooks.json');
if (fs.existsSync(hooksJson)) {
  const def = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
  // 경로를 .claude/ 기준으로 재작성: scripts/ → hooks/ (.claude 안에선 hooks/ 디렉터리에 복사돼 있음)
  const remap = (entries) => (entries || []).map(e => ({
    ...e,
    hook: e.hook.replace(/^scripts\//, 'hooks/'),
  }));
  const claudeHooks = {
    version: def.version,
    PreToolUse: remap(def.PreToolUse),
    PostToolUse: remap(def.PostToolUse),
    PreCompact: remap(def.PreCompact),
    Stop: remap(def.Stop),
    SessionStart: remap(def.SessionStart),
    SessionEnd: remap(def.SessionEnd),
    UserPromptSubmit: remap(def.UserPromptSubmit),
  };
  // 빈 키 제거
  for (const k of Object.keys(claudeHooks)) if (!claudeHooks[k] || claudeHooks[k].length === 0) delete claudeHooks[k];
  fs.writeFileSync(path.join(OUT, 'hooks.json'), JSON.stringify(claudeHooks, null, 2));
  console.log('  hooks.json : OK');
}

// 거버넌스 마크다운 → .claude/ 루트에 그대로
for (const f of ['CLAUDE.md', 'AGENTS.md', 'RULES.md', 'SOUL.md', 'WORKING-CONTEXT.md', 'REVIEW.md']) {
  if (fs.existsSync(path.join(ROOT, f))) {
    copy(path.join(ROOT, f), path.join(OUT, f));
  }
}
console.log('  governance : 6 files');

// .claude-plugin/plugin.json
const pluginDir = path.join(TARGET_ROOT, '.claude-plugin');
ensure(pluginDir);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const plugin = {
  $schema: 'https://raw.githubusercontent.com/Ps-Neko/NEKOWORK/main/schemas/plugin.schema.json',
  name: 'harness',
  version: pkg.version,
  description: pkg.description,
  components: {
    agents: agents,
    skills: skills,
    commands: cmds,
    hooks: hookScripts,
  },
};
// homepage / authors 는 publish 전에 외부 레포 정보로 채울 것 (env 변수 또는 package.json 활용 권장)
if (process.env.HARNESS_HOMEPAGE) plugin.homepage = process.env.HARNESS_HOMEPAGE;
if (pkg.author) plugin.authors = Array.isArray(pkg.author) ? pkg.author : [pkg.author];
fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(plugin, null, 2));
console.log('  plugin.json: OK');

console.log('=> .claude 빌드 완료');
