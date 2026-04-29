// Codex runner: OpenAI Codex CLI 를 subprocess 로 호출.
// 환경: codex 바이너리 필요. 없으면 throw.
//
// 호출 패턴:
//   codex --profile review --sandbox-mode read-only --no-network < prompt.md
//
// Codex 는 Claude 컨텍스트를 받지 않는다. 입력은:
//   - system prompt (codex-reviewer 페르소나)
//   - git diff
//   - handoffs/04-self-review.md (Claude self-review 5필드 요약)
//   - prd-<id>.md
//
// 출력: stdout 의 JSON. 5필드 + issues + verdict.

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export async function runCodex(args) {
  const codexBin = which('codex');
  if (!codexBin) {
    throw new Error('codex CLI 미설치. https://github.com/openai/codex 또는 --provider=mock 사용.');
  }

  const profile = args.stage === 'codex-challenge' ? 'challenge' : 'review';
  const promptText = buildPrompt(args);

  // 인증·CLI 마찰을 줄이기 위해 stdin 으로 직접 prompt 전달.
  // Codex CLI 가 비대화형 모드를 지원해야 함. 이 부분은 실 환경에서 검증 필요.
  const cliArgs = ['--profile', profile];
  if (process.env.HARNESS_CODEX_EXTRA_ARGS) {
    cliArgs.push(...process.env.HARNESS_CODEX_EXTRA_ARGS.split(' '));
  }

  const stdout = await spawnAndCollect(codexBin, cliArgs, promptText);
  const json = extractJson(stdout);
  if (!json) {
    throw new Error('Codex 응답에서 JSON 을 찾지 못함. raw:\n' + stdout.slice(0, 500));
  }
  return JSON.parse(json);
}

function buildPrompt(a) {
  const lines = [];
  if (a.stage === 'codex-review') {
    lines.push('# 시스템 프롬프트');
    lines.push('당신은 이 변경을 처음 보는 시니어 리뷰어다. Claude self-review 가 놓쳤을 critical / high 만 보고하라.');
    lines.push('');
  } else if (a.stage === 'codex-challenge') {
    lines.push('# 시스템 프롬프트');
    lines.push('당신은 적대적 보안 리서처다. 이 코드를 부수려 들어라. 구체적 공격 시나리오를 issue.why 에 기술하라.');
    lines.push('');
  }
  lines.push('출력은 schemas/handoff.schema.json 에 부합하는 JSON 객체 하나.');
  lines.push('');
  lines.push('# 입력');
  if (a.context?.diff) {
    lines.push('## Git Diff');
    lines.push('```diff');
    lines.push(String(a.context.diff).slice(0, 30000));
    lines.push('```');
  }
  if (a.context?.priorHandoffs?.length) {
    lines.push('## 이전 단계 핸드오프 (5필드만)');
    for (const h of a.context.priorHandoffs) {
      lines.push(`### ${h.stage}`);
      lines.push(`- Decided: ${h.decided}`);
      lines.push(`- Files: ${(h.files || []).join(', ')}`);
      if (h.verdict) lines.push(`- Verdict: ${h.verdict}`);
    }
  }
  if (a.context?.prd) {
    lines.push('## PRD');
    lines.push('```json');
    lines.push(JSON.stringify(a.context.prd, null, 2));
    lines.push('```');
  }
  return lines.join('\n');
}

function spawnAndCollect(bin, args, stdin) {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'], shell: isWin });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`codex exit ${code}\nstderr:\n${err}`));
      else resolve(out);
    });
    child.stdin.end(stdin);
    setTimeout(() => {
      try { child.kill(); } catch {}
      reject(new Error('codex timeout'));
    }, Number(process.env.HARNESS_CODEX_TIMEOUT_S || 180) * 1000);
  });
}

function which(bin) {
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').map(e => e.toLowerCase())
    : [''];
  for (const dir of (process.env.PATH || '').split(sep)) {
    if (!dir) continue;
    for (const x of exts) {
      const full = path.join(dir, bin + x);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

export function extractJson(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/```json\s*([\s\S]*?)```/i);
  if (m) return m[1].trim();
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export { buildPrompt as _buildPrompt };
