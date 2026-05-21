#!/usr/bin/env node
// PostToolUse(Edit|Write) quality-gate.
// 변경 파일의 확장자에 따라 빠른 검증:
//   - .ts/.tsx: tsc --noEmit (해당 파일 + transitive). 가능하면 isolated.
//   - .js/.mjs/.cjs: node --check 구문만.
//   - .py: ruff check (있으면) + py_compile 폴백.
// 실패 시 exit 2 → Claude Code 가 다음 도구 호출 차단.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

if (process.env.HARNESS_HOOK_QUALITY_GATE === '0') process.exit(0);

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch { /* TTY */ }
let payload;
try { payload = JSON.parse(input); } catch { payload = {}; }

const targetPath = String(payload?.tool_input?.file_path ?? payload?.tool_input?.path ?? '').trim();
if (!targetPath || !fs.existsSync(targetPath)) process.exit(0);

const ext = path.extname(targetPath);
const checks = [];

if (['.ts', '.tsx'].includes(ext)) {
  const tscBin = which('tsc');
  if (tscBin) {
    // Windows .cmd / .bat 호환: shell: true 사용. 인자에 공백 있는 경로는 따옴표.
    const isWin = process.platform === 'win32';
    const q = isWin ? `"${targetPath}"` : targetPath;
    checks.push({
      name: 'tsc',
      cmd: tscBin,
      args: ['--noEmit', '--allowJs', '--skipLibCheck', q],
      shell: isWin,
    });
  } else {
    checks.push({ name: 'node-syntax', cmd: process.execPath, args: ['--check', targetPath], allowFail: true });
  }
} else if (['.js', '.mjs', '.cjs'].includes(ext)) {
  // ESM 은 --check 가 import 해석을 하지 않아 OK. 빠르고 false-negative 적음.
  checks.push({ name: 'node-syntax', cmd: process.execPath, args: ['--check', targetPath] });
} else if (ext === '.py') {
  const ruff = which('ruff');
  if (ruff) {
    checks.push({ name: 'ruff', cmd: ruff, args: ['check', targetPath] });
  }
  checks.push({ name: 'py-compile', cmd: pythonCmd(), args: ['-m', 'py_compile', targetPath] });
} else {
  process.exit(0);
}

let failed = false;
for (const c of checks) {
  const r = spawnSync(c.cmd, c.args, { encoding: 'utf8', shell: c.shell || false });
  if (r.status === 0) {
    process.stderr.write(`[quality-gate] ${c.name}: OK ${targetPath}\n`);
  } else if (c.allowFail) {
    process.stderr.write(`[quality-gate] ${c.name}: WARN (allowed) ${targetPath}\n`);
  } else {
    failed = true;
    process.stderr.write(`[quality-gate] ${c.name}: FAIL ${targetPath}\n`);
    if (r.stdout) process.stderr.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
  }
}

if (failed) {
  process.stderr.write('[quality-gate] 다음 도구 호출 차단됨. 위 오류 수정 후 다시 진행.\n');
  process.exit(2);
}
process.exit(0);

// ----------------

function which(bin) {
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').map(e => e.toLowerCase())
    : [''];

  // 로컬 node_modules/.bin 을 우선 탐색 (cwd 부터 부모 디렉터리로 올라감).
  const dirs = [];
  let cur = process.cwd();
  for (let i = 0; i < 6; i++) {
    dirs.push(path.join(cur, 'node_modules', '.bin'));
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  // 그 다음 PATH
  for (const d of (process.env.PATH || '').split(sep)) if (d) dirs.push(d);

  for (const dir of dirs) {
    for (const x of exts) {
      const full = path.join(dir, bin + x);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

function pythonCmd() {
  return which('python3') || which('python') || 'python';
}
