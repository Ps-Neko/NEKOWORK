import fs from 'node:fs';
import path from 'node:path';
import { buildDefaultAcceptanceCriteria } from '../lib/acceptance-criteria.js';
import { classifyRisk } from '../lib/risk-classifier.js';

export function classifyAskTask(task = '') {
  const classification = classifyRisk({ task, files: [] });
  return {
    risk: classification.risk,
    tags: classification.tags,
    requiresCodexChallenge: classification.requiresCodexChallenge,
    requiresHumanGate: classification.requiresHumanGate,
  };
}

export function buildQuestionGate(task = '') {
  const classification = classifyAskTask(task);
  const questions = [
    'What outcome should count as done?',
    'What is explicitly out of scope?',
    'What files, surfaces, or user flows are allowed to change?',
  ];

  if (task.trim().split(/\s+/).filter(Boolean).length <= 6) {
    questions.push('Should NEKOWORK proceed with reasonable assumptions, or wait for more detail?');
  }
  if (classification.tags.includes('product-ui')) {
    questions.push('Is this a mock/demo UI, or should it be production-ready behavior?');
    questions.push('What target user and required screen states should guide the UI?');
  }
  if (classification.tags.includes('financial')) {
    questions.push('Must all broker/order/payment behavior stay mock-only for this cycle?');
    questions.push('What warning or demo-only labeling is required to avoid real-money confusion?');
  }
  if (classification.tags.includes('security')) {
    questions.push('Which auth, token, permission, or secret boundaries are allowed to change?');
    questions.push('Should Codex challenge and human gate be mandatory even if review passes?');
  }
  if (classification.tags.includes('deploy')) {
    questions.push('Is production deployment explicitly allowed, or should this stop at release readiness?');
  }
  if (classification.tags.includes('data')) {
    questions.push('Is data loss possible, and what backup or rollback condition is required?');
  }

  return {
    stage: 'question-gate',
    agent: 'question-gate',
    round: 1,
    timestamp: new Date().toISOString(),
    provider: 'local',
    model: 'deterministic',
    decided: 'Question gate only. No provider call, shell command, or project file mutation is required.',
    rejected: 'Implementation, live provider execution, shipping, and multi-worker file writes are out of scope for ask.',
    risks: `risk=${classification.risk}; tags=${classification.tags.length ? classification.tags.join(',') : 'none'}; human_gate=${classification.requiresHumanGate ? 'required-if-continuing' : 'not-required-by-ask'}`,
    files: [],
    remaining: 'Answer the blocking questions or continue to plan with documented assumptions.',
    risk_level: classification.risk,
    questions,
    success_criteria: buildDefaultAcceptanceCriteria(task, 3),
    assumptions: [
      'All ambiguous work defaults to no-ship.',
      'Multi-worker phases are read-only unless a later work/review cycle grants one executor write authority.',
      'Secure, financial, deploy, or destructive data work cannot bypass Codex verification and human gate policy.',
    ],
    requires_human_gate: classification.requiresHumanGate,
  };
}

export async function askGate(opts) {
  const harnessRoot = opts.harnessRoot || process.cwd();
  const projectRoot = opts.projectRoot || harnessRoot;
  const sessionId = opts.sessionId || `ask-${Date.now()}`;
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  fs.mkdirSync(handoffDir, { recursive: true });

  const handoff = buildQuestionGate(opts.task || '');
  handoff.session_id = sessionId;
  writeAskArtifacts(sessionDir, handoffDir, sessionId, opts.task || '', handoff);

  return {
    sessionId,
    sessionDir,
    handoff,
  };
}

function writeAskArtifacts(sessionDir, handoffDir, sessionId, task, handoff) {
  fs.writeFileSync(path.join(sessionDir, 'ask.json'), JSON.stringify({
    sessionId,
    task,
    generated_at: handoff.timestamp,
    risk_level: handoff.risk_level,
    requires_human_gate: handoff.requires_human_gate,
    questions: handoff.questions,
    success_criteria: handoff.success_criteria,
    assumptions: handoff.assumptions,
  }, null, 2));

  fs.writeFileSync(path.join(handoffDir, '00-question-gate.json'), JSON.stringify(handoff, null, 2));
  fs.writeFileSync(path.join(handoffDir, '00-question-gate.md'), renderQuestionGate(handoff));
}

function renderQuestionGate(h) {
  return [
    '# Handoff: question-gate',
    '',
    `Decided: ${h.decided}`,
    `Rejected: ${h.rejected}`,
    `Risks: ${h.risks}`,
    'Files: ',
    `Remaining: ${h.remaining}`,
    '',
    'Questions:',
    ...h.questions.map((q, i) => `${i + 1}. ${q}`),
    '',
    'Draft success criteria:',
    ...h.success_criteria.map(ac => `- ${ac.id}: ${ac.desc}`),
    '',
    'Assumptions:',
    ...h.assumptions.map((a, i) => `${i + 1}. ${a}`),
    '',
  ].join('\n');
}
