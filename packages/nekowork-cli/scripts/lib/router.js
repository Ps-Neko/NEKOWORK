// 라우팅 결정 라이브러리.
// 입력: stage, task, files, ecoMode, riskLevel
// 출력: { agent, model, provider, rationale, alternatives }
//
// SKILL nekowork-full-cycle 의 Stage Routing 표 + AGENTS.md 의
// 권한 매트릭스를 코드로 구현.

import fs from 'node:fs';
import path from 'node:path';

const STAGE_TABLE = {
  ideate: {
    required: [{ agent: 'planner' }],
    optional: [{ agent: 'research' }, { agent: 'architect', when: 'ambiguous' }],
  },
  plan: {
    required: [{ agent: 'planner' }],
    optional: [{ agent: 'architect', when: 'ambiguous' }],
  },
  implement: {
    required: [{ agent: 'executor' }],
    optional: [{ agent: 'debugger', when: 'bug' }, { agent: 'test-engineer' }],
  },
  'self-review': {
    required: [{ agent: 'code-reviewer' }],
    optional: [{ agent: 'security-reviewer', when: 'sensitive' }],
  },
  'codex-review':    { required: [{ agent: 'codex-reviewer' }], optional: [] },
  'codex-challenge': { required: [{ agent: 'codex-challenger' }], optional: [] },
  ship:              { required: [{ agent: 'doc-writer' }], optional: [] },
};

const ECO_DOWNGRADE = { opus: 'sonnet', sonnet: 'haiku', haiku: 'haiku' };
const FLOORED_STAGES = new Set(['self-review', 'codex-review', 'codex-challenge']);

/**
 * @param {object} ctx
 * @param {string} ctx.stage
 * @param {string} [ctx.task]
 * @param {string[]} [ctx.files]
 * @param {boolean} [ctx.ecoMode]
 * @param {string} [ctx.riskLevel]
 * @param {string} [ctx.harnessRoot]
 * @returns {object} routing decision
 */
export function decide(ctx) {
  const root = ctx.harnessRoot || process.cwd();
  const table = STAGE_TABLE[ctx.stage];
  if (!table) throw new Error(`unknown stage: ${ctx.stage}`);

  const requiredAgent = table.required[0].agent;
  const fm = loadAgentFm(requiredAgent, root);
  if (!fm) throw new Error(`agent ${requiredAgent} 의 frontmatter 로드 실패`);

  let model = fm.model;
  let downgraded = false;
  if (ctx.ecoMode && ECO_DOWNGRADE[model]) {
    const target = ECO_DOWNGRADE[model];
    if (FLOORED_STAGES.has(ctx.stage) && model === 'sonnet') {
      // floor: 단계 4·5·6 은 sonnet 미만으로 안 내림
    } else {
      model = target;
      downgraded = true;
    }
  }

  const rationale = [];
  rationale.push(`stage=${ctx.stage} 의 required agent=${requiredAgent}`);
  if (downgraded) rationale.push(`eco mode → ${fm.model} 다운그레이드: ${model}`);
  if (ctx.riskLevel === 'critical') rationale.push('risk=critical → human gate 권장');

  // optional 에이전트 escalate 후보
  const alternatives = [];
  for (const opt of table.optional) {
    const ofm = loadAgentFm(opt.agent, root);
    if (!ofm) continue;
    let why = '';
    if (opt.when === 'sensitive' && (ctx.riskLevel === 'high' || ctx.riskLevel === 'critical')) {
      why = `risk=${ctx.riskLevel} → escalate 권장`;
    } else if (opt.when === 'ambiguous') {
      why = '요구사항 모호 시';
    } else if (opt.when === 'bug' && /(bug|fix|회귀|regression)/i.test(ctx.task || '')) {
      why = 'task 키워드가 bug 시사';
    } else if (!opt.when) {
      why = '옵션';
    }
    alternatives.push({ agent: opt.agent, model: ofm.model, when: why });
  }

  return {
    agent: requiredAgent,
    model,
    provider: fm.provider,
    rationale: rationale.join(' / '),
    alternatives,
    eco_mode: !!ctx.ecoMode,
    risk_level: ctx.riskLevel || 'low',
    blast_radius: (ctx.files || []).length,
  };
}

/**
 * routing.jsonl 에 결정 한 줄 append.
 */
export function trace(sessionDir, decision, extras = {}) {
  const f = path.join(sessionDir, 'routing.jsonl');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    stage: extras.stage,
    input_summary: (extras.task || '').slice(0, 280),
    decision: { agent: decision.agent, model: decision.model, provider: decision.provider, rationale: decision.rationale },
    alternatives: decision.alternatives,
    eco_mode: decision.eco_mode,
    risk_level: decision.risk_level,
    blast_radius: decision.blast_radius,
  });
  fs.appendFileSync(f, line + '\n');
}

function loadAgentFm(name, root) {
  const f = path.join(root, 'agents', `${name}.md`);
  if (!fs.existsSync(f)) return null;
  const raw = fs.readFileSync(f, 'utf8');
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^["']|["']$/g, '');
    if (v === 'true') v = true;
    else if (v === 'false') v = false;
    else if (/^\d+$/.test(v)) v = Number(v);
    fm[kv[1]] = v;
  }
  return fm;
}
