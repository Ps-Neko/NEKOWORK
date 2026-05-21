#!/usr/bin/env node
// Generate docs/CODEMAPS/<area>.md from repository directories.
// The maps include a shallow directory tree plus exported JS symbols.
// They intentionally omit code bodies and are safe to regenerate.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'CODEMAPS');

const AREAS = [
  { area: 'scripts', dir: 'scripts', depth: 3 },
  { area: 'agents', dir: 'agents', depth: 1 },
  { area: 'skills', dir: 'skills', depth: 2 },
  { area: 'hooks', dir: 'hooks', depth: 2 },
  { area: 'manifests', dir: 'manifests', depth: 1 },
  { area: 'schemas', dir: 'schemas', depth: 1 },
  { area: 'bridge', dir: 'bridge', depth: 1 },
  { area: 'rules', dir: 'rules', depth: 2 },
  { area: 'tests', dir: 'tests', depth: 2 },
];

const SKIP = new Set([
  'node_modules',
  '.git',
  '.harness',
  '.claude',
  '.codex',
  '.cursor',
  '.gemini',
  '.opencode',
]);

function parseArgs(argv) {
  const args = { check: false, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--verbose' || arg === '-v') args.verbose = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/build-codemaps.js [--check] [--verbose]');
      process.exit(0);
    } else {
      console.error(`unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

function toSlash(value) {
  return value.split(path.sep).join('/');
}

function directoryTree(dir, maxDepth, prefix = '', depth = 0) {
  if (depth > maxDepth) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => !SKIP.has(entry.name) && !entry.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const lines = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const last = i === entries.length - 1;
    const branch = last ? '`-- ' : '|-- ';
    const childPrefix = last ? '    ' : '|   ';
    const label = entry.isDirectory() ? `${entry.name}/` : entry.name;
    lines.push(prefix + branch + label);
    if (entry.isDirectory()) {
      lines.push(...directoryTree(path.join(dir, entry.name), maxDepth, prefix + childPrefix, depth + 1));
    }
  }
  return lines;
}

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

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      const raw = match[1];
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

function leadingComment(code) {
  const lines = code.split('\n');
  const collected = [];
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!started && (trimmed === '' || trimmed.startsWith('#!'))) continue;
    if (trimmed.startsWith('//')) {
      collected.push(trimmed.replace(/^\/\/\s?/, ''));
      started = true;
    } else if (started) {
      break;
    } else {
      break;
    }
  }

  return collected.join(' ');
}

function cleanCell(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[|]/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function collectJsFiles(absDir) {
  const files = [];

  function walk(dir, rel = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue;

      const abs = path.join(dir, entry.name);
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(abs, nextRel);
      } else if (/\.(m?js|cjs)$/.test(entry.name)) {
        const code = fs.readFileSync(abs, 'utf8');
        files.push({
          rel: nextRel,
          exports: extractExports(code),
          comment: cleanCell(leadingComment(code)),
        });
      }
    }
  }

  walk(absDir);
  return files.sort((a, b) => a.rel.localeCompare(b.rel));
}

function buildArea({ area, dir, depth }) {
  const absDir = path.join(ROOT, dir);
  if (!fs.existsSync(absDir)) return null;

  const treeLines = directoryTree(absDir, depth);
  const jsFiles = collectJsFiles(absDir);

  const lines = [
    `# CODEMAP: ${area}`,
    '',
    `> Generated by \`scripts/build-codemaps.js\` from \`${dir}/\`. Do not edit directly.`,
    '> Directory shape and exported JS symbols only. Code bodies are intentionally omitted.',
    '',
    '## Directory Tree',
    '',
    '```text',
    `${dir}/`,
    ...treeLines,
    '```',
    '',
  ];

  if (jsFiles.length) {
    lines.push('## JS Exports');
    lines.push('');
    lines.push('| File | Exports | Description |');
    lines.push('|---|---|---|');
    for (const file of jsFiles) {
      const exports = file.exports.length
        ? file.exports.map(name => `\`${name}\``).join(', ')
        : '_(none)_';
      lines.push(`| \`${file.rel}\` | ${exports} | ${file.comment} |`);
    }
    lines.push('');
  }

  return {
    area,
    content: lines.join('\n') + '\n',
    fileCount: jsFiles.length,
  };
}

function buildIndex() {
  const lines = [
    '# CODEMAPS: index',
    '',
    '> Generated by `scripts/build-codemaps.js`. Do not edit directly.',
    '',
    '| Area | File |',
    '|---|---|',
  ];

  for (const area of AREAS) {
    if (fs.existsSync(path.join(OUT, `${area.area}.md`))) {
      lines.push(`| ${area.area} | [${area.area}.md](./${area.area}.md) |`);
    }
  }

  return lines.join('\n') + '\n';
}

function writeOrCheck(file, content, args) {
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (before === content) return false;
  if (!args.check) fs.writeFileSync(file, content);
  return true;
}

function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(OUT, { recursive: true });

  let changed = 0;
  let total = 0;

  for (const area of AREAS) {
    const built = buildArea(area);
    if (!built) {
      if (args.verbose) console.log(`[SKIP] ${area.area}: ${area.dir}/ not found`);
      continue;
    }

    total++;
    const outFile = path.join(OUT, `${built.area}.md`);
    if (writeOrCheck(outFile, built.content, args)) {
      changed++;
      console.log(`[${args.check ? 'DIFF' : 'WRITE'}] ${toSlash(path.relative(ROOT, outFile))} (${built.fileCount} files)`);
    } else if (args.verbose) {
      console.log(`[ OK ] ${toSlash(path.relative(ROOT, outFile))}`);
    }
  }

  const indexFile = path.join(OUT, 'README.md');
  if (writeOrCheck(indexFile, buildIndex(), args)) {
    changed++;
    console.log(`[${args.check ? 'DIFF' : 'WRITE'}] ${toSlash(path.relative(ROOT, indexFile))}`);
  } else if (args.verbose) {
    console.log(`[ OK ] ${toSlash(path.relative(ROOT, indexFile))}`);
  }

  if (args.check) {
    if (changed > 0) {
      console.error(`${changed} codemap file(s) are outdated. Run: node scripts/build-codemaps.js`);
      process.exit(1);
    }
    console.log('All codemaps are up to date.');
    return;
  }

  console.log(`\nprocessed=${total}, changed=${changed}`);
}

main();
