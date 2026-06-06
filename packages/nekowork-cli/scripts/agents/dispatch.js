// 에이전트 dispatch. agent.md frontmatter 읽고 provider runner 로 위임.
// 입력 / 출력은 표준화된 JSON 스키마. 단계 간 컨텍스트는 핸드오프 파일로만.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

import { runMock } from './runners/mock.js';
import { runClaude } from './runners/claude.js';
import { runCodex } from './runners/codex.js';
import { runGemini } from './runners/gemini.js';
import { runInternal } from './runners/internal.js';
import { decide as routeDecide, trace as routeTrace } from '../lib/router.js';
import { record as costRecord } from '../lib/costs.js';
import { classifyRisk } from '@ps-neko/nekowork/scripts/lib/risk-classifier.js';

const RUNNERS = {
  mock: runMock,
  claude: runClaude,
  codex: runCodex,
  gemini: runGemini,
  internal: runInternal,
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
 * @param {string}  [opts.projectRoot]
 * @returns {Promise<object>} 핸드오프 객체 (handoff.schema.json 준수)
 */
export async function dispatch(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  const agentFile = path.join(harnessRoot, 'agents', `${opts.agent}.md`);
  if (!fs.existsSync(agentFile)) throw new Error(`agent file not found: ${opts.agent}`);

  const raw = fs.readFileSync(agentFile, 'utf8');
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) throw new Error(`agent ${opts.agent} 의 frontmatter 없음`);
  const fm = YAML.parse(fmMatch[1]);
  const body = raw.slice(fmMatch[0].length).trim();

  const provider = opts.providerOverride
    || process.env.HARNESS_PROVIDER_OVERRIDE
    || (opts.live ? fm.provider : 'mock');
  const runner = RUNNERS[provider];
  if (!runner) throw new Error(`알 수 없는 provider: ${provider}`);

  // routing trace
  if (opts.sessionDir) {
    try {
      const decision = routeDecide({
        stage: opts.stage,
        task: opts.task,
        files: opts.context?.files || [],
        ecoMode: !!process.env.HARNESS_ECO,
        riskLevel: classifyRisk({ task: opts.task || '', files: opts.context?.files || [] }).risk,
        harnessRoot,
      });
      decision.provider = provider;
      decision.model = fm.model;
      routeTrace(opts.sessionDir, decision, { stage: opts.stage, task: opts.task });
    } catch { /* trace 실패는 dispatch 자체를 막지 않음 */ }
  }

  const startTs = Date.now();
  const result = await runner({
    agent: fm.name,
    stage: opts.stage,
    task: opts.task,
    model: fm.model,
    sandbox: opts.sandboxOverride || fm.sandbox,
    networkAccess: fm.network_access,
    disallowedTools: fm.disallowedTools || [],
    promptBody: body,
    context: opts.context || {},
    harnessRoot,
    projectRoot,
    executionMode: opts.executionMode,
  });
  const durMs = Date.now() - startTs;

  // cost record (mock 도 0 으로 기록 — 호출 카운트 가시성)
  try {
    costRecord({
      session: opts.sessionId || 'default',
      stage: opts.stage,
      agent: fm.name,
      provider,
      model: fm.model,
      input_tokens: result.usage?.input_tokens || 0,
      output_tokens: result.usage?.output_tokens || 0,
      duration_ms: durMs,
    });
  } catch { /* 비용 기록 실패는 무시 */ }

  // 표준화 + 메타데이터 부착. 런너의 임의 필드는 통과시키지 않고,
  // orchestrator 가 명시적으로 쓰는 메타데이터만 보존한다.
  const standardKeys = new Set([
    'decided','rejected','risks','files','remaining','issues','verdict','confidence','usage',
  ]);
  const passthroughKeys = new Set(['prdSeed', 'diffPath', 'executionWorkspace']);
  const passthrough = {};
  for (const [k, v] of Object.entries(result || {})) {
    if (!standardKeys.has(k) && passthroughKeys.has(k)) passthrough[k] = v;
  }

  const handoff = {
    stage: opts.stage,
    agent: fm.name,
    round: opts.context?.round || 1,
    session_id: opts.sessionId || undefined,
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
    ...passthrough,
  };
  if (result.confidence != null) handoff.confidence = result.confidence;
  for (const [k, v] of Object.entries(handoff)) {
    if (v === undefined) delete handoff[k];
  }
  return handoff;
}

/** agent.md frontmatter 파싱. 파일이 없거나 frontmatter 없으면 null 반환. */
export function loadAgentFrontmatter(agentName, root = process.cwd()) {
  const f = path.join(root, 'agents', `${agentName}.md`);
  if (!fs.existsSync(f)) return null;
  const raw = fs.readFileSync(f, 'utf8');
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  return YAML.parse(m[1]);
}
