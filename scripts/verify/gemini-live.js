// Gemini CLI live smoke.
// Uses the local Gemini/gcloud session by default, not GEMINI_API_KEY.

import { runGemini } from '../agents/runners/gemini.js';

const started = Date.now();
let result;
try {
  result = await runGemini({
    agent: 'gemini-live-smoke',
    stage: 'ideate',
    task: [
      'Return a minimal HARNESS handoff JSON for a local Gemini CLI smoke test.',
      'Do not browse, do not call tools, and do not modify files.',
    ].join(' '),
    model: process.env.HARNESS_GEMINI_SMOKE_MODEL || 'gemini-2.5-flash',
    sandbox: 'read-only',
    disallowedTools: ['Write', 'Edit', 'Bash'],
    promptBody: [
      'Return only one JSON object.',
      'Required shape:',
      '{"decided":"Gemini CLI smoke passed","rejected":"","risks":"","files":["GEMINI_SMOKE.md"],"remaining":"","issues":[],"verdict":"approve","confidence":0.9}',
    ].join('\n'),
    context: {},
  });
} catch (e) {
  const msg = String(e?.message || e);
  if (/Auth method|GEMINI_API_KEY|GOOGLE_GENAI_USE/i.test(msg)) {
    console.error([
      'Gemini CLI is installed, but headless auth is not configured.',
      'Run interactive `gemini` once and choose Login with Google, or configure Vertex/ADC auth for headless mode.',
      'HARNESS still blocks GEMINI_API_KEY/GOOGLE_API_KEY by default; use delegated Google/Gemini auth unless you explicitly opt into API-key billing.',
    ].join('\n'));
    process.exit(2);
  }
  throw e;
}

const ok = result?.verdict === 'approve'
  && Array.isArray(result.files)
  && result.files.includes('GEMINI_SMOKE.md');

if (!ok) {
  console.error(JSON.stringify(result, null, 2));
  throw new Error('Gemini live smoke returned an unexpected handoff');
}

console.log(`Gemini CLI live smoke PASS: verdict=${result.verdict}, files=${result.files.join(', ')}, duration_ms=${Date.now() - started}`);
