import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { classifyRisk, gateReasonFromFindings, isSensitiveWork, SENSITIVE_PATTERNS } from '@ps-neko/nekowork/scripts/lib/risk-classifier.js';

test('risk classifier tags financial UI work and requires challenge plus human gate', () => {
  const result = classifyRisk({ task: 'stock trading dashboard mockup with mock-only broker orders' });
  assert.equal(result.risk, 'high');
  assert.ok(result.tags.includes('financial'));
  assert.ok(result.tags.includes('product-ui'));
  assert.equal(result.requiresCodexChallenge, true);
  assert.equal(result.requiresHumanGate, true);
});

test('risk classifier detects Korean security and UI terms using ASCII escapes', () => {
  const result = classifyRisk({ task: '\uC778\uC99D \uD1A0\uD070 \uB300\uC2DC\uBCF4\uB4DC \uBAA9\uC5C5' });
  assert.ok(result.tags.includes('security'));
  assert.ok(result.tags.includes('product-ui'));
  assert.equal(result.requiresCodexChallenge, true);
});

test('sensitive pattern export remains security-focused', () => {
  assert.equal(SENSITIVE_PATTERNS.some(re => re.test('src/auth/login.js')), true);
  assert.equal(SENSITIVE_PATTERNS.some(re => re.test('src/database/query.js')), false);
  assert.equal(isSensitiveWork({ files: ['src/oauth/device-flow.js'] }), true);
});

test('gate reason is derived from blocking or critical verification findings', () => {
  assert.equal(gateReasonFromFindings([{ stage: 'codex-review', verdict: 'block', issues: [] }]), 'codex-review returned block');
  assert.equal(
    gateReasonFromFindings([{ stage: 'codex-review', verdict: 'approve', issues: [{ severity: 'critical' }] }]),
    'codex-review reported critical issue',
  );
  assert.equal(gateReasonFromFindings([{ stage: 'codex-review', verdict: 'approve', issues: [] }]), null);
});
