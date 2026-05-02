import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { assertDelegatedCliAuth, BLOCKED_ENV } from '../../scripts/core/auth-guard.js';

test('auth guard documents blocked env keys per delegated CLI provider', () => {
  assert.deepEqual(BLOCKED_ENV.claude, ['ANTHROPIC_API_KEY']);
  assert.deepEqual(BLOCKED_ENV.codex, ['OPENAI_API_KEY']);
  assert.deepEqual(BLOCKED_ENV.gemini, ['GEMINI_API_KEY', 'GOOGLE_API_KEY']);
});

test('auth guard allows delegated CLI auth when API keys are absent', () => {
  assert.doesNotThrow(() => assertDelegatedCliAuth('claude', {}));
  assert.doesNotThrow(() => assertDelegatedCliAuth('codex', {}));
  assert.doesNotThrow(() => assertDelegatedCliAuth('gemini', {}));
});

test('auth guard blocks API key override before CLI handoff', () => {
  assert.throws(
    () => assertDelegatedCliAuth('claude', { ANTHROPIC_API_KEY: 'sk-ant' }),
    /ANTHROPIC_API_KEY/
  );
  assert.throws(
    () => assertDelegatedCliAuth('codex', { OPENAI_API_KEY: 'sk-openai' }),
    /OPENAI_API_KEY/
  );
  assert.throws(
    () => assertDelegatedCliAuth('gemini', { GEMINI_API_KEY: 'gem', GOOGLE_API_KEY: 'google' }),
    /GEMINI_API_KEY, GOOGLE_API_KEY/
  );
});

test('auth guard allows explicit metered opt-in', () => {
  assert.doesNotThrow(() => assertDelegatedCliAuth('codex', {
    OPENAI_API_KEY: 'sk-openai',
    HARNESS_AUTH_ALLOW_ENV_OVERRIDE: '1',
  }));
});
