import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { verifyCycle, _humanGateReason, _latestStageHandoff, _readDiffForHandoff } from '../../scripts/orchestrators/verify.js';
import { rmrf } from '../helpers/tmp.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function seedImplementSession(projectRoot, sessionId, extra = {}) {
  const sessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', sessionId);
  const handoffDir = path.join(sessionDir, 'handoffs');
  const diffDir = path.join(sessionDir, 'diffs');
  fs.mkdirSync(handoffDir, { recursive: true });
  fs.mkdirSync(diffDir, { recursive: true });
  const diffPath = path.join(diffDir, '01-implement.diff');
  fs.writeFileSync(diffPath, 'diff --git a/src/example.ts b/src/example.ts\n');
  fs.writeFileSync(path.join(handoffDir, '03-implement.json'), JSON.stringify({
    stage: 'implement',
    agent: 'executor',
    round: 1,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'sonnet',
    decided: 'implemented',
    rejected: '',
    risks: '',
    files: ['src/example.ts'],
    remaining: 'verify',
    diffPath,
    ...extra,
  }, null, 2));
  return { sessionDir, handoffDir, diffPath };
}

test('latestStageHandoff and readDiffForHandoff find work output', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-helpers-'));
  try {
    const { sessionDir, diffPath } = seedImplementSession(projectRoot, 'unit-verify-helpers');
    const handoffs = [
      { stage: 'implement', round: 1, diffPath },
      { stage: 'implement', round: 2 },
      { stage: 'plan', round: 1 },
    ];
    assert.equal(_latestStageHandoff(handoffs, 'implement').round, 2);
    assert.match(_readDiffForHandoff(sessionDir, handoffs[0]), /diff --git/);
  } finally {
    rmrf(projectRoot);
  }
});

test('verify runs Codex review only after work handoff', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-project-root-'));
  const calls = [];
  const dispatcher = async (args) => {
    calls.push(args);
    assert.equal(args.context.verifyOnly, true);
    assert.match(args.context.diff, /diff --git/);
    return {
      stage: args.stage,
      agent: args.agent,
      round: args.context.round,
      session_id: args.sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: 1,
      provider: 'mock',
      model: 'gpt-5-codex',
      decided: `${args.stage} ok`,
      rejected: '',
      risks: '',
      files: ['src/example.ts'],
      remaining: '',
      verdict: 'approve_with_fixes',
      issues: [{ severity: 'medium', category: 'correctness', file: 'src/example.ts', summary: 'needs timeout' }],
    };
  };

  try {
    const { sessionDir, handoffDir } = seedImplementSession(projectRoot, 'unit-verify');
    const r = await verifyCycle({
      task: 'verify example',
      sessionId: 'unit-verify',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(r.verdict, 'approve_with_fixes');
    assert.equal(r.humanGate, false);
    assert.equal(r.secureActive, false);
    assert.equal(r.codexChallenge, null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].agent, 'codex-reviewer');
    assert.equal(calls[0].stage, 'codex-review');
    assert.ok(fs.existsSync(path.join(handoffDir, '05-codex-review.json')));
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'verify-summary.json'), 'utf8'));
    assert.equal(summary.codex_review_run, true);
    assert.equal(summary.codex_challenge_run, false);
    assert.equal(summary.preverify_run, true);
    assert.equal(summary.preverify_findings, 0);
    assert.equal(summary.ship_run, false);
    assert.equal(summary.target_project_mutated, false);
    assert.equal(summary.acceptance_required, true);
    assert.equal(summary.acceptance_count, 3);
    const decision = JSON.parse(fs.readFileSync(path.join(sessionDir, 'decision.json'), 'utf8'));
    assert.equal(decision.status, 'verified');
    assert.equal(decision.apply_allowed, false);
  } finally {
    rmrf(projectRoot);
  }
});

test('verify records deterministic preverify findings before Codex context', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-preverify-'));
  const dispatcher = async (args) => {
    assert.equal(args.context.preverify.gate_required, true);
    assert.ok(args.context.preverify.findings.some(finding => finding.rule_id === 'secret-env-fallback'));
    return {
      stage: args.stage,
      agent: args.agent,
      round: args.context.round,
      session_id: args.sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: 1,
      provider: 'mock',
      model: 'gpt-5-codex',
      decided: `${args.stage} ok`,
      files: ['src/auth/login.ts'],
      verdict: 'approve',
      issues: [],
    };
  };

  try {
    const { sessionDir, diffPath } = seedImplementSession(projectRoot, 'unit-verify-preverify', {
      files: ['src/auth/login.ts'],
    });
    fs.writeFileSync(diffPath, [
      'diff --git a/src/auth/login.ts b/src/auth/login.ts',
      '+const token = process.env.AUTH_TOKEN || "dev-token-123";',
    ].join('\n'));

    const r = await verifyCycle({
      task: 'verify auth token fallback',
      sessionId: 'unit-verify-preverify',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(r.humanGate, true);
    assert.match(r.reason, /preverify/);
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'preverify-summary.json'), 'utf8'));
    assert.equal(summary.gate_required, true);
    const decision = JSON.parse(fs.readFileSync(path.join(sessionDir, 'decision.json'), 'utf8'));
    assert.equal(decision.verdict, 'blocked');
    assert.equal(decision.human_gate, 'required');
  } finally {
    rmrf(projectRoot);
  }
});

test('verify records warning-level evidence and AC coverage checks for quality profile', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-quality-'));
  const dispatcher = async (args) => {
    assert.equal(args.context.profile, 'quality');
    assert.equal(args.context.evidencePolicy.evidenceWarningRequired, true);
    assert.equal(args.context.evidencePolicy.acceptanceCoverageWarning, true);
    return {
      stage: args.stage,
      agent: args.agent,
      round: args.context.round,
      session_id: args.sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: 1,
      provider: 'mock',
      model: 'gpt-5-codex',
      decided: `${args.stage} reviewed`,
      files: ['src/example.ts'],
      verdict: 'approve_with_fixes',
      issues: [{ severity: 'high', category: 'correctness', file: 'src/example.ts', summary: 'needs rollback check' }],
    };
  };

  try {
    const { sessionDir } = seedImplementSession(projectRoot, 'unit-verify-quality');
    const r = await verifyCycle({
      task: 'verify example quality',
      sessionId: 'unit-verify-quality',
      harnessRoot: ROOT,
      projectRoot,
      profile: 'quality',
      dispatcher,
    });

    assert.equal(r.profile, 'quality');
    assert.ok(r.qualityWarnings.some(w => /missing claim/.test(w)));
    assert.ok(r.qualityWarnings.some(w => /AC-001/.test(w)));
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'verify-summary.json'), 'utf8'));
    assert.equal(summary.profile, 'quality');
    assert.equal(summary.evidence_warning_required, true);
    assert.ok(summary.quality_warnings.length >= 2);
    assert.equal(summary.strict_quality, false);
    assert.ok(summary.acceptance_coverage.some(row => row.id === 'AC-001' && row.status === 'missing'));
  } finally {
    rmrf(projectRoot);
  }
});

test('strict quality escalates quality warnings to a fix-required verdict', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-strict-quality-'));
  const dispatcher = async (args) => ({
    stage: args.stage,
    agent: args.agent,
    round: args.context.round,
    session_id: args.sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'gpt-5-codex',
    decided: `${args.stage} approved without AC evidence`,
    files: ['src/example.ts'],
    verdict: 'approve',
    issues: [{ severity: 'high', category: 'correctness', file: 'src/example.ts', summary: 'needs rollback check' }],
  });

  try {
    const { sessionDir } = seedImplementSession(projectRoot, 'unit-verify-strict-quality');
    const r = await verifyCycle({
      task: 'verify strict quality',
      sessionId: 'unit-verify-strict-quality',
      harnessRoot: ROOT,
      projectRoot,
      profile: 'quality',
      strictQuality: true,
      dispatcher,
    });

    assert.equal(r.strictQuality, true);
    assert.equal(r.strictQualityBlocked, true);
    assert.equal(r.verdict, 'approve_with_fixes');
    const codex = JSON.parse(fs.readFileSync(path.join(sessionDir, 'handoffs', '05-codex-review.json'), 'utf8'));
    assert.equal(codex.verdict, 'approve_with_fixes');
    assert.ok(codex.issues.some(issue => /strict quality/.test(issue.summary)));
    const summary = JSON.parse(fs.readFileSync(path.join(sessionDir, 'verify-summary.json'), 'utf8'));
    assert.equal(summary.strict_quality, true);
    assert.equal(summary.strict_quality_blocked, true);
  } finally {
    rmrf(projectRoot);
  }
});

test('verify applies risk policy human gate for financial work even when Codex approves', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-risk-policy-'));
  const dispatcher = async (args) => ({
    stage: args.stage,
    agent: args.agent,
    round: args.context.round,
    session_id: args.sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'gpt-5-codex',
    decided: `${args.stage} ok`,
    files: ['src/dashboard.ts'],
    verdict: 'approve',
    issues: [],
  });

  try {
    const { sessionDir } = seedImplementSession(projectRoot, 'unit-verify-risk-policy', {
      files: ['src/dashboard.ts'],
    });
    const r = await verifyCycle({
      task: 'stock trading dashboard mockup with mock-only orders',
      sessionId: 'unit-verify-risk-policy',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(r.secureActive, true);
    assert.equal(r.humanGate, true);
    assert.match(r.reason, /risk policy/);
    assert.ok(fs.existsSync(path.join(sessionDir, 'HUMAN_GATE')));
  } finally {
    rmrf(projectRoot);
  }
});

test('verify secure mode also runs Codex challenge', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-secure-'));
  const calls = [];
  const dispatcher = async (args) => {
    calls.push(args);
    return {
      stage: args.stage,
      agent: args.agent,
      round: args.context.round,
      session_id: args.sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: 1,
      provider: 'mock',
      model: 'gpt-5-codex',
      decided: `${args.stage} ok`,
      files: [],
      verdict: 'approve',
    };
  };

  try {
    seedImplementSession(projectRoot, 'unit-verify-secure');
    const r = await verifyCycle({
      task: 'verify auth token change',
      sessionId: 'unit-verify-secure',
      harnessRoot: ROOT,
      projectRoot,
      secure: true,
      dispatcher,
    });

    assert.equal(r.secureActive, true);
    assert.ok(r.codexChallenge);
    assert.deepEqual(calls.map(c => c.stage), ['codex-review', 'codex-challenge']);
  } finally {
    rmrf(projectRoot);
  }
});

test('verify writes HUMAN_GATE for critical or block findings', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-gate-'));
  const dispatcher = async (args) => ({
    stage: args.stage,
    agent: args.agent,
    round: args.context.round,
    session_id: args.sessionId,
    timestamp: new Date().toISOString(),
    duration_ms: 1,
    provider: 'mock',
    model: 'gpt-5-codex',
    decided: 'blocked',
    files: ['src/example.ts'],
    verdict: 'block',
    issues: [{ severity: 'critical', category: 'security', file: 'src/example.ts', summary: 'secret leak' }],
  });

  try {
    const { sessionDir } = seedImplementSession(projectRoot, 'unit-verify-gate');
    const r = await verifyCycle({
      task: 'verify secret handling',
      sessionId: 'unit-verify-gate',
      harnessRoot: ROOT,
      projectRoot,
      dispatcher,
    });

    assert.equal(r.humanGate, true);
    assert.match(r.reason, /block|critical/);
    assert.ok(fs.existsSync(path.join(sessionDir, 'HUMAN_GATE')));
    assert.match(_humanGateReason([r.codexReview]), /block|critical/);
  } finally {
    rmrf(projectRoot);
  }
});

test('verify fails clearly without prior implement handoff', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-verify-missing-'));
  const missingSessionDir = path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-verify-missing');
  try {
    await assert.rejects(
      () => verifyCycle({
        task: 'verify missing work',
        sessionId: 'unit-verify-missing',
        harnessRoot: ROOT,
        projectRoot,
        dispatcher: async () => { throw new Error('should not dispatch'); },
      }),
      /requires an implement handoff/
    );
    assert.equal(fs.existsSync(missingSessionDir), false);
  } finally {
    rmrf(projectRoot);
  }
});
