// Verify that live runner prompt builders include the upstream artifact
// excerpts from context.upstream so live LLMs actually see DOMAIN/SPEC/PLAN
// instead of only the deterministic mock having access to them.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { _buildUserMessage as buildClaudeUserMessage } from '../../scripts/agents/runners/claude.js';
import { _buildPrompt as buildCodexPrompt } from '../../scripts/agents/runners/codex.js';
import { _buildPrompt as buildGeminiPrompt } from '../../scripts/agents/runners/gemini.js';

function fixtureUpstream() {
  return {
    context: {
      path: 'context.md', source: 'auto', size: 12, sha1: 'a'.repeat(40),
      truncated: false, excerpt: 'CTX body marker',
    },
    domain: {
      path: 'DOMAIN.md', source: 'auto', size: 12, sha1: 'b'.repeat(40),
      truncated: false, excerpt: 'DOMAIN body marker',
    },
    spec: {
      path: 'SPEC.md', source: 'explicit', size: 12, sha1: 'c'.repeat(40),
      truncated: false, excerpt: 'SPEC body marker',
    },
    plan: {
      path: 'PLAN.md', source: 'auto', size: 12, sha1: 'd'.repeat(40),
      truncated: true, excerpt: 'PLAN body marker',
    },
  };
}

function commonArgs(extraContext = {}) {
  return {
    agent: 'planner',
    stage: 'plan',
    task: 'pick test',
    model: 'opus',
    sandbox: 'read-only',
    promptBody: 'agent body',
    context: { upstream: fixtureUpstream(), ...extraContext },
  };
}

test('claude runner buildUserMessage embeds every upstream artifact excerpt', () => {
  const msg = buildClaudeUserMessage(commonArgs());
  assert.match(msg, /Upstream Context \(context\.md\)/);
  assert.match(msg, /CTX body marker/);
  assert.match(msg, /Upstream Domain \(DOMAIN\.md\)/);
  assert.match(msg, /DOMAIN body marker/);
  assert.match(msg, /Upstream Spec \(SPEC\.md\)/);
  assert.match(msg, /SPEC body marker/);
  assert.match(msg, /Upstream Plan \(PLAN\.md, truncated\)/);
  assert.match(msg, /PLAN body marker/);
});

test('claude runner buildUserMessage omits upstream sections when none present', () => {
  const msg = buildClaudeUserMessage({ ...commonArgs(), context: { round: 1 } });
  assert.doesNotMatch(msg, /Upstream Context/);
  assert.doesNotMatch(msg, /Upstream Domain/);
});

test('codex runner buildPrompt embeds upstream artifact excerpts', () => {
  const prompt = buildCodexPrompt(commonArgs());
  assert.match(prompt, /Upstream Context/);
  assert.match(prompt, /CTX body marker/);
  assert.match(prompt, /Upstream Plan/);
  assert.match(prompt, /PLAN body marker/);
});

test('gemini runner buildPrompt embeds upstream artifact excerpts', () => {
  const prompt = buildGeminiPrompt(commonArgs());
  assert.match(prompt, /Upstream Domain/);
  assert.match(prompt, /DOMAIN body marker/);
  assert.match(prompt, /Upstream Spec/);
  assert.match(prompt, /SPEC body marker/);
});
