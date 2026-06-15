// AST dataflow rule — the variable-mediated injection detector.
//
// The line-oriented regex rules (sql-injection, command-injection, eval-usage)
// match a dangerous sink and its dynamic argument on a SINGLE line. They
// provably MISS the variable-mediated form, where the dangerous value is
// assembled in one statement and used in another:
//
//   const q = "SELECT * FROM u WHERE id = " + req.params.id;   // line N
//   db.query(q);                                               // line N+1
//
// This rule parses the WHOLE file (functions cross many lines) and runs
// intraprocedural const/taint propagation (see ../ast/analyze.js) to catch the
// dynamic value flowing into the sink — while const-propagation keeps FP=0 on a
// constant bound to a variable (`const q = \`SELECT 1\`; db.query(q)`).
//
// Two surfaces:
//   - scanFileContent(filePath, content): analyze content directly. Used by the
//     benchmark harness (which passes fixture file content) AND as the shared
//     core.
//   - scanDiff(parsedDiff, opts): for each CHANGED JS/TS-family file, read the
//     FULL post-change file from disk (opts.projectRoot) and analyze it. AST
//     needs whole functions, not just added lines. Reading the post-change file
//     also catches the "risky code re-activated by deleting a comment fence"
//     evasion. If a file can't be read (e.g. --from-patch with no working copy)
//     or doesn't parse, it is skipped silently — the regex rules still cover it.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { analyze } from '../ast/analyze.js';
import { isTsPath } from '../ast/parse.js';

// 검토 대상 diff 의 post-change 내용을 git 에서 읽는다(staged=`:path`, range head=`ref:path`).
// 디스크 직접 읽기를 staged/range 에도 쓰면 '디스크≠diff' 라 verdict 가 오염돼 결정성이 깨진다.
function gitShowContent(cwd, spec) {
  try {
    const r = spawnSync('git', ['show', spec], { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) return null;
    return typeof r.stdout === 'string' ? r.stdout : null;
  } catch {
    return null;
  }
}

// JS/TS family extensions the AST engine understands.
const JS_TS_EXT = /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/i;

export function isAnalyzablePath(filePath) {
  return JS_TS_EXT.test(String(filePath || ''));
}

/**
 * Analyze a single file's content. Matches the regex rules' scanFileContent
 * signature so the benchmark harness (which calls scanFileContent(file, content))
 * exercises this rule the same way.
 *
 * @param {string} filePath  reported in findings + decides TS stripping
 * @param {string} content
 * @returns {Array} findings (regex-rule finding shape)
 */
export function scanFileContent(filePath, content) {
  if (!isAnalyzablePath(filePath)) return [];
  if (typeof content !== 'string' || content.length === 0) return [];
  const { findings } = analyze(content, filePath, { ts: isTsPath(filePath) });
  return findings;
}

/**
 * scanDiff for the real verify-pr pipeline. Needs full file content, so it reads
 * each changed file from disk under opts.projectRoot.
 *
 * @param {object} parsedDiff
 * @param {{ projectRoot?: string }} [opts]
 * @returns {Array} findings
 */
export function scanDiff(parsedDiff, opts = {}) {
  if (!parsedDiff || !Array.isArray(parsedDiff.files)) return [];
  const projectRoot = opts.projectRoot;
  // Without a working copy we cannot read whole files — skip silently (the regex
  // rules still scan the diff's added lines). This is the heavy package's
  // no-projectRoot call.
  if (!projectRoot) return [];

  const mode = parsedDiff.mode;       // undefined | working | staged | range | full | patch
  const postRef = parsedDiff.postRef; // null | '<ref>'
  // patch: 디스크가 패치와 일치한다는 보장이 없어 AST(전체 파일) 분석을 건너뛴다(regex 룰은 유지).
  if (mode === 'patch') return [];
  // ★ 결정성 수정: staged/range(head ref 있음)는 '검토 대상 diff 의 post-change 내용'을 git show 로
  //   읽는다. working/full/단일-ref range/mode 미정의는 디스크가 곧 post-change 라 디스크를 읽는다.
  //   디스크 직접 읽기를 staged/range 에까지 쓰면 '디스크≠diff' 로 verdict 가 오염돼
  //   '같은 diff → 같은 verdict' 결정성이 깨진다(이 분기가 그 핵심 수정).
  const showRef = mode === 'staged' ? ':' : (mode === 'range' && postRef ? postRef : null);

  const findings = [];
  const seenPaths = new Set();
  for (const file of parsedDiff.files) {
    if (!file || file.binary) continue;
    // Deleted files have no post-change content to analyze.
    if (file.status === 'deleted') continue;
    const rel = file.path;
    if (!rel || seenPaths.has(rel)) continue;
    seenPaths.add(rel);
    if (!isAnalyzablePath(rel)) continue;

    // SECURITY: 경로 탈출 차단 — diff 헤더 경로가 projectRoot 밖(../, 절대경로)을 가리키면 건너뛴다.
    const abs = path.resolve(projectRoot, rel);
    const within = path.relative(projectRoot, abs);
    if (within === '' || within.startsWith('..') || path.isAbsolute(within)) continue;

    let content;
    if (showRef) {
      // staged → `git show :path`, range head → `git show <ref>:path`
      content = gitShowContent(projectRoot, showRef === ':' ? `:${rel}` : `${showRef}:${rel}`);
      if (content == null) continue; // 해당 ref 에 없으면(추가 전 등) 건너뜀 — regex 룰이 커버
    } else {
      try {
        const stat = fs.statSync(abs);
        if (!stat.isFile()) continue;
        content = fs.readFileSync(abs, 'utf8');
      } catch {
        continue; // unreadable → regex rules still cover the diff
      }
    }

    const fileFindings = scanFileContent(rel, content);
    for (const f of fileFindings) findings.push(f);
  }
  return findings;
}

// scanAddedLines is part of the regex rules' surface; the AST engine works on
// whole files, so added-lines-only analysis would lose cross-statement flow.
// Provide a no-op for interface parity (nothing calls it for this rule).
export function scanAddedLines() {
  return [];
}
