import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { preverifyIssues, runPreverify } from '../../scripts/lib/preverify.js';

test('preverify flags secret env fallback before LLM review', () => {
  const result = runPreverify({
    task: 'verify auth config',
    files: ['src/config/auth.ts'],
    diff: [
      'diff --git a/src/config/auth.ts b/src/config/auth.ts',
      '+const token = process.env.AUTH_TOKEN || "dev-token-123";',
    ].join('\n'),
  });

  assert.equal(result.verdict, 'block');
  assert.equal(result.gate_required, true);
  assert.equal(result.requires_codex_challenge, true);
  assert.ok(result.risk_tags.includes('secret'));
  assert.ok(result.findings.some(finding => finding.rule_id === 'secret-env-fallback'));
  const issues = preverifyIssues(result);
  assert.equal(issues[0].category, 'security');
});

test('preverify flags boundary file changes without requiring model context', () => {
  const result = runPreverify({
    task: 'refactor login middleware',
    files: ['src/auth/login.ts', '.github/workflows/deploy.yml'],
    diff: 'diff --git a/src/auth/login.ts b/src/auth/login.ts\n+export const changed = true;\n',
  });

  assert.equal(result.verdict, 'approve_with_fixes');
  assert.equal(result.gate_required, true);
  assert.ok(result.risk_tags.includes('auth'));
  assert.ok(result.risk_tags.includes('deploy'));
  assert.ok(result.findings.some(finding => finding.rule_id === 'auth-boundary-file'));
  assert.ok(result.findings.some(finding => finding.rule_id === 'deploy-boundary-file'));
});

test('preverify approves ordinary low-risk changes', () => {
  const result = runPreverify({
    task: 'update copy',
    files: ['docs/README.md'],
    diff: 'diff --git a/docs/README.md b/docs/README.md\n+hello\n',
  });

  assert.equal(result.verdict, 'approve');
  assert.equal(result.gate_required, false);
  assert.deepEqual(result.findings, []);
});
