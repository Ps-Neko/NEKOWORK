// 에이전트 dispatch. agent.md frontmatter 읽고 provider runner 로 위임.
// 입력 / 출력은 표준화된 JSON 스키마. 단계 간 컨텍스트는 핸드오프 파일로만.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

import { runMock } from './runners/mock.js';
import { runClaude } from './runners/claude.js';
import { runCodex } from './runners/codex.js';
import { runGemini } from './runners/gemini.js';

const RUNNERS = {
  mock: runMock,
  claude: runClaude,
  codex: runCodex,
  gemini: runGemini,
};

/**
 * 에이전트 한 번 호출.
 * @param {object} opts
 * @param {string} opts.agent           - agent name (예: 'planner')
 * @param {string} opts.stage           - 단계 이름 (예: 'plan')
 * @param {string} opts.task            - 사용자 작업 한 줄
 * @param {object} opts.context         - 디스크 핸드오프 + PRD 등 자료
 * @param {boolean} [opts.live=false]   - 실 LLM 호출
 * @param {string}  [opts.providerOverride] - provider 강제 지정
 * @param {string}  [opts.harnessRoot]
 * @returns {Promise<object>} 핸드오프 객체 (handoff.schema.json 준수)
 */
export async function dispatch(opts) {
  const root = opts.harnessRoot || process.cwd();
  const agentFile = path.join(root, 'agents', `${opts.agent}.md`);
  if (!fs.existsSync(agentFile)) throw new Error(`agent file not found: ${opts.agent}`);

  const raw = fs.readFileSync(agentFile, 'utf8');
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) throw new Error(`agent ${opts.agent} 의 frontmatter 없음`);
  const fm = YAML.parse(fmMatch[1]);
  const body = raw.slice(fmMatch[0].length).trim();

  const provider = opts.providerOverride || (opts.live ? fm.provider : 'mock');
  const runner = RUNNERS[provider];
  if (!runner) throw new Error(`알 수 없는 provider: ${provider}`);

  const startTs = Date.now();
  const result = await runner({
    agent: fm.name,
    stage: opts.stage,
    task: opts.task,
    model: fm.model,
    sandbox: fm.sandbox,
    networkAccess: fm.network_access,
    disallowedTools: fm.disallowedTools || [],
    promptBody: body,
    context: opts.context || {},
    harnessRoot: root,
  });
  const durMs = Date.now() - startTs;

  // 표준화 + 메타데이터 부착
  return {
    stage: opts.stage,
    agent: fm.name,
    round: opts.context?.round || 1,
    timestamp: new Date().toISOString(),
    duration_ms: durMs,
    provider,
    model: fm.model,
    decided: result.decided ?? '',
    rejected: result.rejected ?? '',
    risks: result.risks ?? '',
    files: result.files ?? [],
    remaining: result.remaining ?? '',
    issues: result.issues ?? [],
    verdict: result.verdict,
    confidence: result.confidence ?? null,
  };
}

export function loadAgentFrontmatter(agentName, root = process.cwd()) {
  const f = path.join(root, 'agents', `${agentName}.md`);
  if (!fs.existsSync(f)) return null;
  const raw = fs.readFileSync(f, 'utf8');
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  return YAML.parse(m[1]);
}
