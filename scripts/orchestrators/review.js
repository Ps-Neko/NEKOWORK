// 7단계 review 오케스트레이터.
// claude-led-codex-review SKILL 의 Stage Routing 표를 코드로 구현.
//
// 핵심 규칙:
//   - 단계 5/6 의 verdict 가 block 또는 critical/high 발견 시 fix loop (executor 재호출, round++)
//   - round 한도 = 3. critical 발견 또는 round ≥ 3 → human gate.
//   - --secure 또는 보안 카테고리(auth/crypto/token/cert/csrf/webhook 등) 변경 자동 감지 → 단계 6 활성.
//   - --fast → 단계 1·6 스킵. --secure 와 동시 사용은 거절.
//   - --no-ship → 단계 7 생략.

import fs from 'node:fs';
import path from 'node:path';
import { dispatch } from '../agents/dispatch.js';
import { applyExecutionDiff, withExecutionWorkspace } from '../core/execution-workspace.js';
import { record as instinctRecord } from '../lib/instincts.js';
import { isSensitiveWork } from '../lib/risk-classifier.js';

const STAGE_INDEX = {
  ideate: '01', plan: '02', implement: '03', 'self-review': '04',
  'codex-review': '05', 'codex-challenge': '06', ship: '07',
};

const ROUND_LIMIT = Number(process.env.HARNESS_REVIEW_ROUND_LIMIT || 3);
// 단어 경계(\b)는 [A-Za-z0-9_] 사이에 매칭하지 않으므로 'session_id' 의 'session' 처럼
// _ 로 이어진 경우는 매칭 안 됨. 변형은 별도 패턴으로 명시한다.
export { SENSITIVE_PATTERNS } from '../lib/risk-classifier.js';
const LEGACY_SENSITIVE_PATTERNS = [
  // 인증 / 세션 / 시크릿
  /\bauth\b/i, /\bcrypto\b/i, /\bpayment\b/i, /\bsession\b/i,
  /\bpermission\b/i, /\boauth\b/i, /\bjwt\b/i, /\bpassword\b/i, /\bsecret\b/i,
  // 자격증명 / 토큰
  /\btoken\b/i, /\bapikey\b/i, /\bapi[-_]key\b/i,
  // 인증서 / 전송보안
  /\bcert\b/i, /\btls\b/i, /\bssl\b/i, /\bmtls\b/i,
  // 웹 보안
  /\bcsrf\b/i, /\bcors\b/i, /\bxss\b/i,
  // 외부 검증 누락 다발
  /\bwebhook\b/i,
];

export async function reviewCycle(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  const sessionId = opts.sessionId || `review-${Date.now()}`;
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  fs.mkdirSync(path.join(sessionDir, 'handoffs'), { recursive: true });

  const live = !!opts.live;
  const fast = !!opts.fast;
  const noShip = !!opts.noShip;
  const noCodex = !!opts.noCodex;
  let secureRequested = !!opts.secure;
  if (fast && secureRequested) {
    throw new Error('--secure 와 --fast 는 함께 쓸 수 없습니다. 보안 검증이 필요하면 --secure 만 사용하세요.');
  }
  if (noCodex && secureRequested) {
    throw new Error('--no-codex 와 --secure 는 함께 쓸 수 없습니다. 보안 검증이 필요하면 Codex 단계를 유지하세요.');
  }

  const summaryBase = {
    task: opts.task,
    live,
    fast,
    noShip,
    noCodex,
    secureRequested,
  };

  const log = (msg) => console.log(`[review:${sessionId}] ${msg}`);

  log(`task: ${opts.task}`);
  log(`mode: ${live ? 'live' : 'mock'}${fast ? ' --fast' : ''}${noShip ? ' --no-ship' : ''}${noCodex ? ' --no-codex' : ''}${secureRequested ? ' --secure' : ''}`);
  if (path.resolve(harnessRoot) !== path.resolve(projectRoot)) {
    log(`harness root: ${harnessRoot}`);
    log(`project root: ${projectRoot}`);
  }

  const handoffs = [];
  const writeHandoff = (h) => {
    const base = handoffBase(h);
    fs.writeFileSync(path.join(sessionDir, 'handoffs', `${base}.md`), renderHandoff(h));
    fs.writeFileSync(path.join(sessionDir, 'handoffs', `${base}.json`), JSON.stringify(h, null, 2));
    handoffs.push(h);
    // 인스팅트 자동 누적
    try {
      // 이슈 패턴: severity + category + 파일 prefix
      for (const i of (h.issues || [])) {
        instinctRecord({
          kind: 'issue-pattern',
          key: `${i.severity || '?'}/${i.category || '?'}/${(i.file || '').split('/')[0] || '_'}`,
          summary: `${i.severity}/${i.category} in ${i.file || '?'}: ${i.summary || ''}`.slice(0, 200),
          evidence: { sessionId, stage: h.stage, file: i.file, summary: i.summary },
          scope: 'global',
        });
      }
      // verdict 흐름
      if (h.verdict) {
        instinctRecord({
          kind: 'fix-flow',
          key: `${h.stage}→${h.verdict}@round${h.round || 1}`,
          summary: `${h.stage} round ${h.round || 1} → ${h.verdict}`,
          evidence: { sessionId, stage: h.stage, verdict: h.verdict, round: h.round || 1 },
          scope: 'global',
        });
      }
    } catch { /* instinct 실패는 review 자체를 막지 않음 */ }
  };

  // ---- 1. ideate ----
  if (!fast) {
    log('1 ideate');
    const h1 = await runWithFallback({ agent: 'planner', stage: 'ideate', task: opts.task, live, harnessRoot, projectRoot });
    writeHandoff(h1);
  } else {
    log('1 ideate skipped (--fast)');
  }

  // ---- 2. plan ----
  log('2 plan');
  const h2 = await runWithFallback({ agent: 'planner', stage: 'plan', task: opts.task, live, harnessRoot, projectRoot });
  writeHandoff(h2);

  // mock 일 경우 prdSeed 가 같이 옴. PRD 저장.
  if (h2.prdSeed) {
    fs.writeFileSync(path.join(sessionDir, 'prd.json'), JSON.stringify(h2.prdSeed, null, 2));
  }
  if (opts.stopAfter === 'plan') {
    const result = {
      sessionId,
      sessionDir,
      mode: 'legacy-full-review-cycle',
      handoffs,
      files: dedupe(h2.files || []),
      secureActive: false,
      verdict: 'planned',
      humanGate: false,
      stoppedAt: 'plan',
      targetProjectMutated: false,
    };
    writeReviewSummary(sessionDir, result, summaryBase);
    return result;
  }
  const prd = readPrd(sessionDir);
  let currentDiff = opts.diff || '';
  let targetProjectMutated = false;

  // sensitive path 감지
  const sensitiveHit = isSensitiveWork({ task: opts.task, files: h2.files || [] });

  // ---- 3. implement ----
  log('3 implement');
  const impl3 = await runImplementStage({
    agent: 'executor', stage: 'implement', task: opts.task, live, harnessRoot, projectRoot, sessionDir, sessionId,
    context: { prd, acCount: prd?.acceptance?.length || 3 },
  });
  const h3 = impl3.handoff;
  if (impl3.diff) currentDiff = impl3.diff;
  writeHandoff(h3);

  // ---- 4. self-review (round loop) ----
  let reviewRound = 0;
  let lastVerdict = null;
  const allFiles = [...(h3.files || []), ...(impl3.files || [])];
  while (true) {
    reviewRound++;
    log(`4 self-review (round ${reviewRound})`);
    const hSelf = await runWithFallback({
      agent: 'code-reviewer', stage: 'self-review', task: opts.task, live, harnessRoot, projectRoot, sessionDir, sessionId,
      context: { round: reviewRound, prd, priorHandoffs: handoffs.slice(-3), diff: currentDiff },
    });
    hSelf.round = reviewRound;
    writeHandoff(hSelf);
    lastVerdict = hSelf.verdict;
    if (hasCritical(hSelf.issues) || reviewRound >= ROUND_LIMIT) {
      if (hasCritical(hSelf.issues)) return humanGate(sessionDir, 'critical 발견 (단계 4)', sessionId, handoffs, summaryBase);
      if (reviewRound >= ROUND_LIMIT && lastVerdict !== 'approve') {
        return humanGate(sessionDir, `round ≥ ${ROUND_LIMIT}, verdict=${lastVerdict}`, sessionId, handoffs, summaryBase);
      }
    }
    if (lastVerdict === 'approve') break;
    if (lastVerdict === 'block' || lastVerdict === 'approve_with_fixes') {
      log(`fix-loop: executor round ${reviewRound + 1}`);
      const implFix = await runImplementStage({
        agent: 'executor', stage: 'implement', task: opts.task, live, harnessRoot, projectRoot, sessionDir, sessionId,
        context: { prd, round: reviewRound + 1, issues: hSelf.issues, diff: currentDiff },
      });
      const hFix = implFix.handoff;
      hFix.round = reviewRound + 1;
      if (implFix.diff) currentDiff = implFix.diff;
      allFiles.push(...(hFix.files || []), ...(implFix.files || []));
      writeHandoff(hFix);
      continue;
    }
    break;
  }
  if (opts.stopAfter === 'self-review') {
    const result = {
      sessionId,
      sessionDir,
      mode: 'legacy-full-review-cycle',
      handoffs,
      files: dedupe(allFiles),
      secureActive: false,
      verdict: lastVerdict || 'approve',
      humanGate: false,
      stoppedAt: 'self-review',
      targetProjectMutated: false,
    };
    writeReviewSummary(sessionDir, result, summaryBase);
    return result;
  }

  // ---- 5 + 6. codex-review + codex-challenge (병렬 실행) ----
  // 두 단계는 같은 입력(prd / priorHandoffs / diff)을 받고 컨텍스트가 독립이다.
  // Promise.all 로 동시 호출 → codex CLI 호출 시간(가장 큰 비용)을 1회 비용으로 단축.
  // stage 5 critical 시 stage 6 결과는 폐기 (직렬 동작과 의미 동일).
  const wantChallenge = !noCodex && (secureRequested || sensitiveHit) && !fast;
  if (noCodex) {
    log('5+6 codex-review/codex-challenge skipped (--no-codex)');
  } else {
    log(wantChallenge
      ? `5+6 codex-review + codex-challenge (병렬, ${secureRequested ? '--secure' : 'sensitive 자동'})`
      : '5 codex-review');
  }

  const codexCommonContext = { round: 1, prd, priorHandoffs: handoffs.slice(-3), diff: currentDiff };
  if (!noCodex) {
    const codexPromises = [
      runWithFallback({
        agent: 'codex-reviewer', stage: 'codex-review', task: opts.task, live, harnessRoot, projectRoot, sessionDir, sessionId,
        context: codexCommonContext,
      }),
    ];
    if (wantChallenge) {
      codexPromises.push(runWithFallback({
        agent: 'codex-challenger', stage: 'codex-challenge', task: opts.task, live, harnessRoot, projectRoot, sessionDir, sessionId,
        context: codexCommonContext,
      }));
    }
    const codexResults = await Promise.all(codexPromises);
    const h5 = codexResults[0];
    const h6 = codexResults[1] || null;

    writeHandoff(h5);
    if (hasCritical(h5.issues)) {
      return humanGate(sessionDir, 'codex-review 에서 critical 발견', sessionId, handoffs, summaryBase);
    }
    if (opts.stopAfter === 'codex-review') {
      const result = {
        sessionId,
        sessionDir,
        mode: 'legacy-full-review-cycle',
        handoffs,
        files: dedupe(allFiles),
        secureActive: wantChallenge,
        verdict: h5.verdict || 'approve',
        humanGate: false,
        stoppedAt: 'codex-review',
        targetProjectMutated: false,
      };
      writeReviewSummary(sessionDir, result, summaryBase);
      return result;
    }

    if (h6) {
      writeHandoff(h6);
      if (hasCritical(h6.issues)) {
        return humanGate(sessionDir, 'codex-challenge 에서 critical 발견', sessionId, handoffs, summaryBase);
      }
    } else {
      log(`6 codex-challenge skipped${fast ? ' (--fast)' : ' (sensitive 미감지, --secure 미지정)'}`);
    }
  }

  if (live && currentDiff.trim()) {
    try {
      const applied = applyExecutionDiff(projectRoot, currentDiff);
      if (applied) {
        fs.writeFileSync(path.join(sessionDir, 'APPLIED_DIFF'), `applied_at: ${new Date().toISOString()}\n`);
        targetProjectMutated = true;
      }
    } catch (e) {
      return humanGate(sessionDir, `live executor diff apply failed: ${e.message}`, sessionId, handoffs, summaryBase);
    }
  }

  // ---- 7. ship ----
  if (noShip) {
    log('7 ship skipped (--no-ship)');
  } else {
    log('7 ship');
    const h7 = await runWithFallback({
      agent: 'doc-writer', stage: 'ship', task: opts.task, live, harnessRoot, projectRoot, sessionDir, sessionId,
      context: { prd, priorHandoffs: handoffs },
    });
    writeHandoff(h7);
  }

  const result = {
    sessionId,
    sessionDir,
    mode: 'legacy-full-review-cycle',
    handoffs,
    files: dedupe(allFiles),
    secureActive: wantChallenge,
    verdict: 'approve',
    humanGate: false,
    stoppedAt: noShip ? 'codex-review' : 'ship',
    targetProjectMutated,
  };
  writeReviewSummary(sessionDir, result, summaryBase);
  return result;
}

// ----------------

async function runWithFallback({ agent, stage, task, live, harnessRoot, projectRoot, context, sessionDir, sessionId, executionMode }) {
  try {
    return await dispatch({ agent, stage, task, live, harnessRoot, projectRoot, context, sessionDir, sessionId, executionMode });
  } catch (e) {
    if (live) {
      if (process.env.HARNESS_LIVE_ALLOW_MOCK_FALLBACK !== '1') {
        throw new Error(`${agent}/${stage} live 실패: ${e.message}`);
      }
      console.error(`[review] ${agent}/${stage} live 실패 → mock 폴백(HARNESS_LIVE_ALLOW_MOCK_FALLBACK=1): ${e.message}`);
      return await dispatch({
        agent, stage, task, live: false, harnessRoot, projectRoot, context,
        providerOverride: 'mock', sessionDir, sessionId, executionMode,
      });
    }
    throw e;
  }
}

async function runImplementStage({ agent, stage, task, live, harnessRoot, projectRoot, context, sessionDir, sessionId }) {
  if (!live) {
    const handoff = await runWithFallback({ agent, stage, task, live, harnessRoot, projectRoot, context, sessionDir, sessionId });
    return { handoff, diff: null, files: [] };
  }

  const round = context?.round || 1;
  const execution = await withExecutionWorkspace(
    projectRoot,
    sessionDir,
    async (workspaceRoot) => runWithFallback({
      agent,
      stage,
      task,
      live,
      harnessRoot,
      projectRoot: workspaceRoot,
      context,
      sessionDir,
      sessionId,
      executionMode: 'workspace-write',
    }),
    { sessionId, stage, round, baseDiff: context?.diff || '' },
  );

  const handoff = execution.result;
  handoff.files = dedupe([...(handoff.files || []), ...execution.files]);
  if (execution.diffPath) handoff.diffPath = execution.diffPath;
  if (execution.worktreeRoot) handoff.executionWorkspace = execution.worktreeRoot;
  return { handoff, diff: execution.diff, files: execution.files };
}

function readPrd(sessionDir) {
  const f = path.join(sessionDir, 'prd.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

function hasCritical(issues) {
  return Array.isArray(issues) && issues.some(i => i.severity === 'critical');
}

function humanGate(sessionDir, reason, sessionId, handoffs, summaryBase = {}) {
  const f = path.join(sessionDir, 'HUMAN_GATE');
  fs.writeFileSync(f, `reason: ${reason}\nat: ${new Date().toISOString()}\n`);
  console.error(`[review] HUMAN_GATE: ${reason}`);
  const result = {
    sessionId,
    sessionDir,
    mode: 'legacy-full-review-cycle',
    handoffs,
    humanGate: true,
    reason,
    verdict: 'block',
    stoppedAt: 'human-gate',
    targetProjectMutated: false,
  };
  writeReviewSummary(sessionDir, result, summaryBase);
  return result;
}

function writeReviewSummary(sessionDir, result, summary = {}) {
  fs.writeFileSync(path.join(sessionDir, 'review-summary.json'), JSON.stringify({
    sessionId: result.sessionId,
    task: summary.task || null,
    mode: 'legacy-full-review-cycle',
    compatibility_command: 'review-cycle',
    recommended_wrapper: 'run',
    live: Boolean(summary.live),
    fast: Boolean(summary.fast),
    no_ship: Boolean(summary.noShip),
    no_codex: Boolean(summary.noCodex),
    secure_requested: Boolean(summary.secureRequested),
    secure_active: Boolean(result.secureActive),
    human_gate: Boolean(result.humanGate),
    reason: result.reason || null,
    stopped_at: result.stoppedAt || (result.humanGate ? 'human-gate' : 'ship'),
    verdict: result.verdict || (result.humanGate ? 'block' : 'approve'),
    handoff_count: result.handoffs?.length || 0,
    stages: (result.handoffs || []).map(h => h.stage),
    files: result.files || [],
    target_project_mutated: Boolean(result.targetProjectMutated),
    next_step: result.humanGate
      ? 'resolve the human gate before continuing'
      : 'prefer run/work/verify/ship for new decomposed workflows',
  }, null, 2));
}

function dedupe(arr) { return [...new Set(arr)]; }

function handoffBase(h) {
  const nn = STAGE_INDEX[h.stage] || '00';
  const round = Number(h.round || 1);
  const roundSuffix = round > 1 ? `-r${round}` : '';
  return `${nn}-${h.stage}${roundSuffix}`;
}

function renderHandoff(h) {
  const lines = [];
  lines.push(`# Handoff: ${h.stage}  (round ${h.round || 1}, agent: ${h.agent}, ${h.provider}/${h.model})`);
  lines.push('');
  lines.push(`**Decided**: ${h.decided || ''}`);
  if (h.rejected)  lines.push(`**Rejected**: ${h.rejected}`);
  if (h.risks)     lines.push(`**Risks**: ${h.risks}`);
  lines.push(`**Files**: ${(h.files || []).join(', ')}`);
  if (h.remaining) lines.push(`**Remaining**: ${h.remaining}`);
  if (h.verdict)   lines.push(`**Verdict**: ${h.verdict}${h.confidence != null ? ` (confidence ${h.confidence})` : ''}`);
  if (h.issues?.length) {
    lines.push('');
    lines.push('## Issues');
    for (const i of h.issues) {
      lines.push(`- [${i.severity}/${i.category}] ${i.file || ''}${i.line ? ':' + i.line : ''} — ${i.summary}`);
    }
  }
  lines.push('');
  lines.push(`<sub>provider=${h.provider} model=${h.model} duration_ms=${h.duration_ms}</sub>`);
  return lines.join('\n') + '\n';
}
