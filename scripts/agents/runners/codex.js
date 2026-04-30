// Codex runner: OpenAI Codex CLI 를 subprocess 로 호출.
// 환경: codex 바이너리 필요. 없으면 throw.
//
// 호출 패턴 (codex 0.124.0+ 비대화형 검증):
//   codex exec --sandbox read-only [--profile <name>] < prompt
// stdin 으로 prompt 전달, stdout 의 `codex` 라벨 다음 JSON 객체를 응답으로 사용.
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
import { classifyCategory, classifySeverity, deriveVerdict } from '../../lib/severity.js';

export async function runCodex(args) {
  const codexBin = which('codex');
  if (!codexBin) {
    throw new Error('codex CLI 미설치. https://github.com/openai/codex 또는 --provider=mock 사용.');
  }

  const stage = args.stage === 'codex-challenge' ? 'challenge' : 'review';
  const promptText = buildPrompt(args);

  // codex 0.124.0+ 비대화형 모드: `codex exec` + 명시적 sandbox.
  // 인증·CLI 마찰을 줄이기 위해 stdin 으로 직접 prompt 전달.
  const cliArgs = ['exec', '--sandbox', 'read-only'];

  // profile 은 사용자의 `~/.codex/config.toml` 의존이므로 환경변수로 옵션화.
  // stage 별 분리: HARNESS_CODEX_PROFILE_REVIEW / HARNESS_CODEX_PROFILE_CHALLENGE.
  // 또는 공통: HARNESS_CODEX_PROFILE.
  const profile = process.env[`HARNESS_CODEX_PROFILE_${stage.toUpperCase()}`]
    || process.env.HARNESS_CODEX_PROFILE;
  if (profile) {
    cliArgs.push('--profile', profile);
  }
  if (process.env.HARNESS_CODEX_EXTRA_ARGS) {
    cliArgs.push(...process.env.HARNESS_CODEX_EXTRA_ARGS.split(' '));
  }

  const stdout = await spawnAndCollect(codexBin, cliArgs, promptText);
  // codex CLI 0.125+ stdout: "user\n<prompt echo>\n\ncodex\n<응답>".
  // echo 된 user prompt 에 ```json``` 펜스가 있으면 extractJson 이 오매칭하므로,
  // "codex" 라벨 (단독 줄) 이후만 파싱한다.
  const labelMatch = stdout.match(/(^|\n)codex\r?\n/);
  const cleaned = labelMatch
    ? stdout.slice(labelMatch.index + labelMatch[0].length)
    : stdout;
  const json = extractJson(cleaned);
  if (!json) {
    throw new Error('Codex 응답에서 JSON 을 찾지 못함. raw:\n' + stdout.slice(0, 500));
  }
  return normalizeHandoff(JSON.parse(json));
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
    const child = spawnCodexProcess(bin, args);
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

function spawnCodexProcess(bin, args) {
  const isWinShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin);
  if (!isWinShim) {
    return spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  }

  const comspec = process.env.ComSpec || 'cmd.exe';
  return spawn(comspec, ['/d', '/c', bin, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
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

function normalizeHandoff(raw) {
  if (!raw || typeof raw !== 'object') return raw;

  const pick = (...keys) => {
    for (const key of keys) {
      if (raw[key] !== undefined) return raw[key];
    }
    return undefined;
  };

  const rawIssues = pick('issues', 'Issues');
  const rawRisks = pick('risks', 'Risks');
  const issueSource = Array.isArray(rawIssues) ? rawIssues : (Array.isArray(rawRisks) ? rawRisks : []);
  const issues = issueSource.map(normalizeIssue);

  const lower = {
    decided: stringifyField(pick('decided', 'Decided', 'decision', 'Decision')),
    rejected: stringifyField(pick('rejected', 'Rejected')),
    risks: stringifyField(Array.isArray(rawRisks) ? rawRisks.map(r => r.issue || r.summary || r.message || JSON.stringify(r)).join('; ') : rawRisks),
    files: normalizeFiles(pick('files', 'Files')),
    remaining: stringifyField(pick('remaining', 'Remaining')),
    issues,
    verdict: normalizeVerdict(pick('verdict', 'Verdict'), issues, pick('decided', 'Decided')),
  };

  if (pick('confidence', 'Confidence') != null) {
    const n = Number(pick('confidence', 'Confidence'));
    if (Number.isFinite(n)) lower.confidence = n;
  }

  return lower;
}

function normalizeIssue(issue) {
  const i = issue && typeof issue === 'object' ? issue : { summary: String(issue || '') };
  const summary = String(i.summary || i.issue || i.message || i.title || '').slice(0, 200) || 'Codex reported an issue';
  const normalized = {
    severity: i.severity,
    category: i.category,
    file: i.file || i.path,
    line: Number.isInteger(i.line) ? i.line : undefined,
    summary,
    why: i.why || i.issue || i.message,
    suggested_fix: i.suggested_fix ?? i.fix ?? null,
  };
  normalized.category = classifyCategory(normalized);
  normalized.severity = classifySeverity(normalized);
  for (const key of Object.keys(normalized)) {
    if (normalized[key] === undefined) delete normalized[key];
  }
  return normalized;
}

function normalizeFiles(files) {
  if (!files) return [];
  if (Array.isArray(files)) return files.map(String);
  return [String(files)];
}

function stringifyField(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function normalizeVerdict(verdict, issues, decided) {
  const v = String(verdict || '').toLowerCase();
  if (['block', 'approve_with_fixes', 'approve'].includes(v)) return v;
  if (['request_changes', 'changes_requested', 'fix', 'gate'].includes(v)) return deriveVerdict(issues.length ? issues : [{ severity: 'high', category: 'correctness', summary: String(decided || 'changes requested') }]);
  return deriveVerdict(issues);
}

export { buildPrompt as _buildPrompt, normalizeHandoff as _normalizeHandoff };
