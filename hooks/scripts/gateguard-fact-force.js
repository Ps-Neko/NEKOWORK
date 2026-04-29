#!/usr/bin/env node
// PreToolUse(Edit|Write) gateguard-fact-force.
// "Are you sure?" 자기평가는 무력. importer / public API / schema 사실을 강제로 디스크에 남긴다.
//
// 동작:
//   1. tool_input.file_path 가 코드 파일인가? 아니면 통과.
//   2. 사실 노트 파일 .harness/state/sessions/<id>/facts/<encoded>.md 존재?
//      - 존재 + 답변 영역 비어있지 않음 → 통과 (이 세션에서 이미 조사함).
//      - 존재 + 답변 영역 비어있음 → 차단 (질문에 답한 후 다시 시도).
//      - 미존재 → 사실 노트 새로 생성 + 차단 (답한 후 재시도).
//   3. importer / public API 후보를 정적으로 추출해 노트에 미리 박는다 (TS/JS 만).

import fs from 'node:fs';
import path from 'node:path';

if (process.env.HARNESS_HOOK_GATEGUARD === '0') process.exit(0);

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch { /* TTY */ }
let payload;
try { payload = JSON.parse(input); } catch { payload = {}; }

const targetPath = String(payload?.tool_input?.file_path ?? payload?.tool_input?.path ?? '').trim();
if (!targetPath) process.exit(0);

const ext = path.extname(targetPath);
const isCode = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.kt'].includes(ext);
if (!isCode) process.exit(0);

const sessionId = process.env.HARNESS_SESSION_ID || 'default';
const root = process.env.HARNESS_ROOT || process.cwd();
const factsDir = path.join(root, '.harness', 'state', 'sessions', sessionId, 'facts');
fs.mkdirSync(factsDir, { recursive: true });

const safeFileName = targetPath.replace(/[\\\/:*?"<>|]/g, '_');
const factFile = path.join(factsDir, safeFileName + '.md');

// 이미 답변된 사실 노트가 있는가?
if (fs.existsSync(factFile)) {
  const existing = fs.readFileSync(factFile, 'utf8');
  const answered = /## 답변\s*\n[^\n#]*\S/.test(existing);
  if (answered) process.exit(0);
  process.stderr.write(`[gateguard] 차단: 사실 노트가 비어있음. ${factFile}\n`);
  process.stderr.write(`[gateguard] '## 답변' 섹션을 채운 후 다시 시도.\n`);
  process.exit(2);
}

// importer / API / schema 후보 추출 (TS/JS 만, 정적 패턴 매칭)
const facts = inspectFile(targetPath, root);

const note = `# Facts: ${targetPath}

> gateguard-fact-force 가 자동 생성. self-evaluation ("are you sure?") 은 무력하다. 다음 3개 질문에 답한 후 Edit / Write 를 진행하라.

## 1. Importers (이 파일을 참조하는 다른 파일)

추출된 후보 (정적 검색):
${facts.importers.length ? facts.importers.map(i => `- ${i}`).join('\n') : '- (없음)'}

## 2. Public API (export 시그니처)

추출된 후보:
${facts.exports.length ? facts.exports.map(e => `- \`${e}\``).join('\n') : '- (없음)'}

## 3. Schema / 데이터 (DB / API / config 영향)

추출된 후보:
${facts.schemas.length ? facts.schemas.map(s => `- ${s}`).join('\n') : '- (자동 추출 항목 없음 — 직접 확인 필요)'}

## 답변

(이 섹션을 비워두면 다음 Edit / Write 호출이 차단된다. 위 사실을 검토한 후 변경 의도와 영향을 한 단락으로 적는다.)


`;

fs.writeFileSync(factFile, note);
process.stderr.write(`[gateguard] 사실 노트 생성: ${factFile}\n`);
process.stderr.write(`[gateguard] 차단: '## 답변' 섹션을 채운 후 다시 시도.\n`);
process.exit(2);

// ============================================================

function inspectFile(target, root) {
  const result = { importers: [], exports: [], schemas: [] };

  // public exports 추출 (TS/JS)
  if (fs.existsSync(target)) {
    const code = fs.readFileSync(target, 'utf8');
    if (/\.(ts|tsx|js|mjs|cjs)$/.test(target)) {
      const exportRe = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
      let m;
      while ((m = exportRe.exec(code))) result.exports.push(m[1]);
      // export { a, b } 형식
      const reexport = /^\s*export\s*\{\s*([^}]+)\}/gm;
      while ((m = reexport.exec(code))) {
        for (const id of m[1].split(',')) result.exports.push(id.trim().split(/\s+as\s+/)[0]);
      }
    }
    if (/\.py$/.test(target)) {
      const py = /^(?:def|class)\s+([A-Za-z_]\w*)/gm;
      let m;
      while ((m = py.exec(code))) result.exports.push(m[1]);
    }
    if (/schema|model|migration|sql/i.test(target)) {
      result.schemas.push('파일 이름이 schema/model/migration 을 시사 — DB 영향 가능');
    }
  }

  // importers 추출 — 같은 패키지의 src/, scripts/, agents/, hooks/, bridge/ 안에서 grep.
  const baseName = path.basename(target).replace(/\.[^.]+$/, '');
  const searchDirs = ['scripts', 'bridge', 'hooks', 'agents', 'skills'];
  const seen = new Set();
  for (const dir of searchDirs) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    walk(full, (f) => {
      if (seen.has(f) || f === target) return;
      if (!/\.(ts|tsx|js|mjs|cjs|py)$/.test(f)) return;
      const c = fs.readFileSync(f, 'utf8');
      // import / require / from 형식 + 파일 베이스 이름 매칭
      const re = new RegExp(`(?:import\\s+[^;]+from\\s+|require\\(\\s*|from\\s+)['"][^'"]*${escape(baseName)}[^'"]*['"]`);
      if (re.test(c)) {
        result.importers.push(path.relative(root, f).replace(/\\/g, '/'));
        seen.add(f);
      }
    });
  }

  // 너무 많으면 자르기
  if (result.importers.length > 20) result.importers = result.importers.slice(0, 20).concat(['... (+more)']);
  if (result.exports.length > 30) result.exports = result.exports.slice(0, 30).concat(['... (+more)']);

  return result;
}

function escape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, fn);
    else fn(p);
  }
}
