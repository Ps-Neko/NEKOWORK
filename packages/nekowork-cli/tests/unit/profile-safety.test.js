import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateProfileSafety } from '../../scripts/lib/profile-safety.js';

test('profile safety accepts profiles that keep core modules and safe defaults', () => {
  const result = validateProfileSafety({
    profiles: {
      developer: {
        modules: ['rules-core', 'agents-core', 'hooks-runtime', 'platform-configs', 'workflow-quality'],
        defaults: { mutation_policy: 'single_executor', human_gate_on_critical: true },
      },
    },
  });

  assert.deepEqual(result.errors, []);
});

test('profile safety rejects missing core modules', () => {
  const result = validateProfileSafety({
    profiles: {
      unsafe: {
        modules: ['workflow-quality'],
      },
    },
  });

  assert.ok(result.errors.some(e => e.includes('rules-core')));
  assert.ok(result.errors.some(e => e.includes('agents-core')));
});

test('profile safety rejects defaults that weaken gates', () => {
  const result = validateProfileSafety({
    profiles: {
      unsafe: {
        modules: ['rules-core', 'agents-core', 'hooks-runtime', 'platform-configs'],
        defaults: {
          disable_codex_review: true,
          human_gate_on_critical: false,
          mutation_policy: 'parallel_write',
          outbound_network: 'allow',
        },
      },
    },
  });

  assert.ok(result.errors.some(e => e.includes('disable_codex_review')));
  assert.ok(result.errors.some(e => e.includes('human_gate_on_critical')));
  assert.ok(result.errors.some(e => e.includes('mutation_policy')));
  assert.ok(result.errors.some(e => e.includes('outbound_network')));
});
