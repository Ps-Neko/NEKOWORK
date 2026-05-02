// Gemini runner: Gemini CLI subprocess.
// 환경: gemini 바이너리 (npm i -g @google/gemini-cli).
// 미보유 시 throw → 오케스트레이터가 mock fallback.

import { assertDelegatedCliAuth } from '../../core/auth-guard.js';
import { resolveCli } from '../../core/cli-resolver.js';
import { extractJson } from '../../core/json-extractor.js';
import { spawnAndCollect } from '../../core/subprocess.js';

export async function runGemini(args) {
  assertDelegatedCliAuth('gemini');

  const bin = resolveCli('gemini');
  if (!bin) {
    throw new Error('gemini CLI 미설치. npm i -g @google/gemini-cli 후 다시 시도.');
  }

  const prompt = buildPrompt(args);
  const stdout = await spawnAndCollect(bin, ['--quiet'], prompt, {
    label: 'gemini',
    timeoutMs: Number(process.env.HARNESS_GEMINI_TIMEOUT_S || 120) * 1000,
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
