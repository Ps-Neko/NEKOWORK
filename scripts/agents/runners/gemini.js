// Gemini runner: Gemini CLI subprocess.
// 환경: gemini 바이너리 (npm i -g @google/gemini-cli).
// 미보유 시 throw → 오케스트레이터가 mock fallback.

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { assertDelegatedCliAuth } from '../../core/auth-guard.js';

export async function runGemini(args) {
  assertDelegatedCliAuth('gemini');

  const bin = which('gemini');
  if (!bin) {
    throw new Error('gemini CLI 미설치. npm i -g @google/gemini-cli 후 다시 시도.');
  }

  const prompt = buildPrompt(args);
  const isWin = process.platform === 'win32';

  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(bin, ['--quiet'], { stdio: ['pipe', 'pipe', 'pipe'], shell: isWin });
    let out = '', err = '';
    child.stdout.on('data', d => (out += d.toString()));
    child.stderr.on('data', d => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`gemini exit ${code}\nstderr:\n${err}`));
      else resolve(out);
    });
    child.stdin.end(prompt);
    setTimeout(() => { try { child.kill(); } catch {}; reject(new Error('gemini timeout')); }, 120000);
  });

  const json = extractJson(stdout);
  if (!json) throw new Error('gemini 응답에서 JSON 을 찾지 못함');
  return JSON.parse(json);
}

function buildPrompt(a) {
  return [
    `# 시스템: HARNESS agent "${a.agent}" stage "${a.stage}".`,
    '출력: schemas/handoff.schema.json 에 부합하는 JSON 한 객체.',
    '',
    `# Task: ${a.task || '(none)'}`,
    a.context?.diff ? '## Git Diff\n```diff\n' + String(a.context.diff).slice(0, 30000) + '\n```' : '',
    a.context?.prd ? '## PRD\n```json\n' + JSON.stringify(a.context.prd, null, 2) + '\n```' : '',
  ].filter(Boolean).join('\n');
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

function extractJson(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/i);
  if (m) return m[1].trim();
  const s = text.indexOf('{');
  if (s < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = s; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return text.slice(s, i + 1); }
  }
  return null;
}
