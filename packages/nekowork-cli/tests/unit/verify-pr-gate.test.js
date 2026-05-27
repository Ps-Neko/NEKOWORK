import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { checksBlockedByRisk } from '../../scripts/orchestrators/verify-pr.js';

test('gate: critical finding blocks check execution', () => {
  assert.equal(checksBlockedByRisk([{ rule: 'secret-fallback', severity: 'critical', pattern: 'x' }]), true);
});

test('gate: package-lockfile-risk install-hook blocks execution', () => {
  assert.equal(checksBlockedByRisk([{ rule: 'package-lockfile-risk', severity: 'high', pattern: 'install-hook-postinstall' }]), true);
});

test('gate: package-lockfile-risk script-* blocks execution', () => {
  assert.equal(checksBlockedByRisk([{ rule: 'package-lockfile-risk', severity: 'critical', pattern: 'script-curl-bash' }]), true);
});

test('gate: test-or-security-disable blocks execution', () => {
  assert.equal(checksBlockedByRisk([{ rule: 'test-or-security-disable', severity: 'high', pattern: 'it-skip' }]), true);
});

test('gate: plain dependency change does NOT block execution', () => {
  assert.equal(checksBlockedByRisk([{ rule: 'package-lockfile-risk', severity: 'high', pattern: 'dependency-git-url' }]), false);
});

test('gate: no findings → not blocked', () => {
  assert.equal(checksBlockedByRisk([]), false);
});
