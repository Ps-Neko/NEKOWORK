#!/usr/bin/env node
// docs/CODEMAPS/<area>.md 자동 생성.
// 디렉터리 트리(파일 목록) + 각 .js / .mjs 의 핵심 export(엔트리 함수) 를 추출.
// 코드 본문은 포함하지 않는다 (네비게이션 보조).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'CODEMAPS');

// 매핑할 영역. (area, 디렉터리) 페어. 새 영역 추가 시 여기에만 등록.
const AREAS = [
  { area: 'scripts',       dir: 'scripts',       depth: 3 },
  { area: 'agents',        dir: 'agents',        depth: 1 },
  { area: 'skills',        dir: 'skills',        depth: 2 },
  { area: 'hooks',         dir: 'hooks',         depth: 2 },
  { area: 'manifests',     dir: 'manifests',     depth: 1 },
  { area: 'schemas',       dir: 'schemas',       depth: 1 },
  { area: 'bridge',        dir: 'bridge',        depth: 1 },
  { area: 'rules',         dir: 'rules',         depth: 2 },
  { area: 'tests',         dir: 'tests',         depth: 2 },
];

const SKIP = new Set(['node_modules', '.git', '.harness', '.claude', '.codex', '.cursor', '.gemini', '.opencode']);

function parseArgs(argv) {
  const args = { check: false, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--help' || a === '-h') {
      console.log(`사용법: node scripts/build-codemaps.js [--check] [--verbose]`);
      process.exit(0);
    } else { console.error(`알 수 없는 인자: ${a}`); process.exit(2); }
  }
  return args;
}

// 디렉터리 트리 라인 생성 (한정된 depth)
function tree(dir, maxDepth, prefix = '', depth = 0) {
  if (depth > maxDepth) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !SKIP.has(e.name) && !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const lines = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const last = i === entries.length - 1;
    const branch = last ? '└── ' : '├── ';
    const cont = last ? '    ' : '│   ';
    if (e.isDirectory()) {
      lines.push(prefix + branch + e.name + '/');
      lines.push(...tree(path.join(dir, e.name), maxDepth, prefix + cont, depth + 1));
    } else {
      lines.push(prefix + branch + e.name);
    }
  }
  return lines;
}

// .js/.mjs 의 export 추출. AST 안 쓰고 정규식으로 (가벼움).
function extractExports(code) {
  const exports = new Set();
  const patterns = [
    /^export\s+(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)/gm,
    /^export\s+class\s+([a-zA-Z_$][\w$]*)/gm,
    /^export\s+const\s+([a-zA-Z_$][\w$]*)/gm,
    /^export\s+let\s+([a-zA-Z_$][\w$]*)/gm,
    /^export\s+\{([^}]+)\}/gm,
    /^export\s+default\s+(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)/gm,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) {
      const raw = m[1];
      if (raw.includes(',') || raw.includes(' as ')) {
        for (const part of raw.split(',')) {
          const name = part.trim().split(/\s+as\s+/)[0].trim();
          if (name) exports.add(name);
        }
      } else if (raw) {
        exports.add(raw);
      }
    }
  }
  if (/^export\s+default\b/m.test(code) && !exports.has('default')) {
    exports.add('default');
  }
  return [...exports].sort();
}

// 파일 첫 주석 추출 (한 줄 또는 // 연속 블록).
function leadingComment(code) {
  const lines = code.split('\n');
  let collected = [];
  let started = false;
  for (const line of lines) {
    const t = line.trim();
    if (!started && (t === '' || t.startsWith('#!'))) continue;
    if (t.startsWith('//')) {
      collected.push(t.replace(/^\/\/\s?/, ''));
      started = true;
    } else if (started) break;
    else if (t.startsWith('/*')) {
      // /* ... */ 파싱은 스킵
      break;
    } else {
      break;
    }
  }
  return collected.join(' ').slice(0, 200);
}

function buildArea({ area, dir, depth }) {
  const absDir = path.join(ROOT, dir);
  if (!fs.existsSync(absDir)) return null;

  const treeLines = tree(absDir, depth);

  // 모든 .js/.mjs 파일 수집 (재귀, depth 무관)
  const jsFiles = [];
  function walk(d, rel = '') {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (/\.(m?js|cjs)$/.test(e.name)) {
        const code = fs.readFileSync(p, 'utf8');
        jsFiles.push({
          rel: r,
          comment: leadingComment(code),
          exports: extractExports(code),
        });
      }
    }
  }
  walk(absDir);

  const lines = [];
  lines.push(`# CODEMAP — ${area}`);
  lines.push('');
  lines.push(`> 자동 생성. \`scripts/build-codemaps.js\` 가 \`${dir}/\` 를 스캔. 직접 편집 금지.`);
  lines.push(`> 코드 본문은 포함 안 함. 네비게이션 보조용.`);
  lines.push('');

  lines.push('## 디렉터리 트리');
  lines.push('');
  lines.push('```');
  lines.push(`${dir}/`);
  for (const l of treeLines) lines.push(l);
  lines.push('```');
  lines.push('');

  if (jsFiles.length) {
    lines.push('## 핵심 export');
    lines.push('');
    lines.push('| 파일 | export | 설명 |');
    lines.push('|---|---|---|');
    for (const f of jsFiles.sort((a, b) => a.rel.localeCompare(b.rel))) {
      const exps = f.exports.length ? f.exports.map(e => '`' + e + '`').join(', ') : '_(none)_';
      const desc = (f.comment || '').replace(/\|/g, '\\|').slice(0, 120);
      lines.push(`| \`${f.rel}\` | ${exps} | ${desc} |`);
    }
    lines.push('');
  }

  return { area, content: lines.join('\n') + '\n', fileCount: jsFiles.length };
}

function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(OUT, { recursive: true });

  let changed = 0;
  let total = 0;
  for (const def of AREAS) {
    const built = buildArea(def);
    if (!built) {
      if (args.verbose) console.log(`[SKIP] ${def.area} — ${def.dir}/ 없음`);
      continue;
    }
    total++;
    const out = path.join(OUT, `${built.area}.md`);
    const before = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (before !== built.content) {
      changed++;
      if (!args.check) fs.writeFileSync(out, built.content);
      console.log(`[${args.check ? 'DIFF' : 'WRITE'}] ${path.relative(ROOT, out)} (${built.fileCount} files)`);
    } else if (args.verbose) {
      console.log(`[ OK ] ${path.relative(ROOT, out)}`);
    }
  }

  // 인덱스
  const indexLines = [
    '# CODEMAPS — 인덱스',
    '',
    '> 자동 생성. `scripts/build-codemaps.js` 가 갱신.',
    '',
    '| 영역 | 파일 |',
    '|---|---|',
  ];
  for (const def of AREAS) {
    if (!fs.existsSync(path.join(OUT, `${def.area}.md`))) continue;
    indexLines.push(`| ${def.area} | [${def.area}.md](./${def.area}.md) |`);
  }
  const indexContent = indexLines.join('\n') + '\n';
  const indexFile = path.join(OUT, 'README.md');
  const indexBefore = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf8') : '';
  if (indexBefore !== indexContent) {
    if (!args.check) fs.writeFileSync(indexFile, indexContent);
    if (indexBefore !== '') changed++;
  }

  if (args.check) {
    if (changed > 0) {
      console.error(`${changed} 개 codemap 이 outdated. \`node scripts/build-codemaps.js\` 실행 필요.`);
      process.exit(1);
    }
    console.log('모든 codemap 최신 상태.');
    return;
  }

  console.log(`\n${total} 영역 처리, ${changed} 변경.`);
}

main();
