import fs from 'node:fs';
import path from 'node:path';
import { buildDefaultAcceptanceCriteria } from '../lib/acceptance-criteria.js';
import { classifyRisk } from '../lib/risk-classifier.js';
import { profilePolicy } from '../lib/profile-policy.js';
import { loadUpstreamArtifact, hasAnyUpstream } from '../lib/upstream-artifacts.js';

export function classifyAskTask(task = '') {
  const classification = classifyRisk({ task, files: [] });
  return {
    risk: classification.risk,
    tags: classification.tags,
    requiresCodexChallenge: classification.requiresCodexChallenge,
    requiresHumanGate: classification.requiresHumanGate,
  };
}

export function buildQuestionGate(task = '', opts = {}) {
  const classification = classifyAskTask(task);
  const policy = profilePolicy(opts.profile);
  const questions = [
    'What outcome should count as done?',
    'Who is the target user or operator, and what problem should this solve?',
    'What is the smallest MVP scope for this cycle?',
    'What is explicitly out of scope?',
    'What files, surfaces, or user flows are allowed to change?',
    'What launch or readiness risk should block ship?',
  ];

  if (task.trim().split(/\s+/).filter(Boolean).length <= 6) {
    questions.push('Should NEKOWORK proceed with reasonable assumptions, or wait for more detail?');
  }
  if (classification.tags.includes('product-ui')) {
    questions.push('Is this a mock/demo UI, or should it be production-ready behavior?');
    questions.push('What target user and required screen states should guide the UI?');
    questions.push('What UX confusion or unsafe user assumption should the design prevent?');
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
  if (policy.profile === 'product') {
    questions.push('What non-goal should be protected if scope pressure appears?');
    questions.push('What QA acceptance criteria would make this launch-ready?');
  }
  if (policy.profile === 'quality') {
    questions.push('What test-first plan should exist before implementation starts?');
    questions.push('What evidence should prove each acceptance criterion passed?');
  }

  return {
    stage: 'question-gate',
    agent: 'question-gate',
    round: 1,
    timestamp: new Date().toISOString(),
    provider: 'local',
    model: 'deterministic',
    profile: policy.profile || undefined,
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

  const upstream = { context: loadUpstreamArtifact('context', projectRoot, opts.contextFile) };

  const handoff = buildQuestionGate(opts.task || '', { profile: opts.profile });
  handoff.session_id = sessionId;
  if (hasAnyUpstream(upstream)) handoff.upstream_artifacts = upstream;
  writeAskArtifacts(sessionDir, handoffDir, sessionId, opts.task || '', handoff, upstream);

  return {
    sessionId,
    sessionDir,
    handoff,
    upstreamArtifacts: upstream,
  };
}

function writeAskArtifacts(sessionDir, handoffDir, sessionId, task, handoff, upstream) {
  const policy = profilePolicy(handoff.profile);
  fs.writeFileSync(path.join(sessionDir, 'ask.json'), JSON.stringify({
    sessionId,
    task,
    generated_at: handoff.timestamp,
    risk_level: handoff.risk_level,
    profile: handoff.profile || null,
    profile_checklist: policy.checklist,
    requires_human_gate: handoff.requires_human_gate,
    questions: handoff.questions,
    success_criteria: handoff.success_criteria,
    assumptions: handoff.assumptions,
    upstream_artifacts: upstream || { context: null },
  }, null, 2));

  fs.writeFileSync(path.join(handoffDir, '00-question-gate.json'), JSON.stringify(handoff, null, 2));
  fs.writeFileSync(path.join(handoffDir, '00-question-gate.md'), renderQuestionGate(handoff, upstream));
}

function renderQuestionGate(h, upstream) {
  const lines = [
    '# Handoff: question-gate',
    '',
    `Decided: ${h.decided}`,
    `Rejected: ${h.rejected}`,
    `Risks: ${h.risks}`,
    'Files: ',
    `Remaining: ${h.remaining}`,
    '',
  ];
  if (upstream?.context) {
    const c = upstream.context;
    lines.push(`Upstream context: ${c.path} (${c.size}B, sha1=${c.sha1.slice(0, 12)}${c.truncated ? ', truncated' : ''})`);
    lines.push('');
  }
  lines.push('Questions:');
  for (let i = 0; i < h.questions.length; i++) lines.push(`${i + 1}. ${h.questions[i]}`);
  lines.push('');
  lines.push('Draft success criteria:');
  for (const ac of h.success_criteria) lines.push(`- ${ac.id}: ${ac.desc}`);
  lines.push('');
  lines.push('Assumptions:');
  for (let i = 0; i < h.assumptions.length; i++) lines.push(`${i + 1}. ${h.assumptions[i]}`);
  lines.push('');
  return lines.join('\n');
}
