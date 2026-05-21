// Claude Code CLI live smoke.
// Uses the local Claude subscription/OAuth session by default, not ANTHROPIC_API_KEY.

import { runClaude } from '../agents/runners/claude.js';

const result = await runClaude({
  agent: 'claude-live-smoke',
  stage: 'plan',
  task: 'Return a minimal HARNESS handoff JSON for a local Claude Code CLI smoke test.',
  model: process.env.HARNESS_CLAUDE_SMOKE_MODEL || 'sonnet',
  sandbox: 'read-only',
  disallowedTools: [],
  promptBody: [
    'Return only one JSON object.',
    'Required shape:',
    '{"decided":"...","rejected":"","risks":"","files":["SMOKE.md"],"remaining":"","issues":[],"verdict":"approve","confidence":0.9}',
  ].join('\n'),
  context: {},
});

const ok = result?.verdict === 'approve'
  && Array.isArray(result.files)
  && result.files.includes('SMOKE.md');

if (!ok) {
  console.error(JSON.stringify(result, null, 2));
  throw new Error('Claude live smoke returned an unexpected handoff');
}

console.log(`Claude CLI live smoke PASS: verdict=${result.verdict}, files=${result.files.join(', ')}`);
