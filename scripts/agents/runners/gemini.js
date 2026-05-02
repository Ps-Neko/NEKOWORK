// Gemini runner: calls the local Gemini CLI subprocess.
// Default auth is delegated to the user's local gemini/gcloud session.

import { assertDelegatedCliAuth } from '../../core/auth-guard.js';
import { resolveCli } from '../../core/cli-resolver.js';
import { withGitMutationGuard } from '../../core/git-mutation-guard.js';
import { extractJson } from '../../core/json-extractor.js';
import { spawnAndCollect } from '../../core/subprocess.js';

export async function runGemini(args) {
  assertDelegatedCliAuth('gemini');

  const bin = resolveCli('gemini');
  if (!bin) {
    throw new Error('gemini CLI is not installed. Install/login to Gemini CLI, or use --provider=mock.');
  }

  const prompt = buildPrompt(args);
  const cwd = args.harnessRoot || process.cwd();
  const stdout = await withGitMutationGuard(
    cwd,
    () => spawnAndCollect(bin, ['--quiet'], prompt, {
      label: 'gemini',
      timeoutMs: Number(process.env.HARNESS_GEMINI_TIMEOUT_S || 120) * 1000,
      cwd,
    }),
    { label: 'gemini', allowEnvKey: 'HARNESS_GEMINI_ALLOW_WORKSPACE_MUTATION' },
  );

  const json = extractJson(stdout);
  if (!json) throw new Error('Gemini response did not contain JSON. raw:\n' + stdout.slice(0, 500));
  return JSON.parse(json);
}

function buildPrompt(a) {
  return [
    `# System: HARNESS agent "${a.agent}" stage "${a.stage}".`,
    'Output exactly one JSON object shaped like schemas/handoff.schema.json.',
    `Sandbox: ${a.sandbox || 'read-only'}.`,
    'Non-interactive handoff mode: do not call tools, edit files, run shell commands, wait for approvals, or make commits.',
    'No prose outside JSON. Korean for natural-language fields unless the task asks otherwise.',
    '',
    `# Task: ${a.task || '(none)'}`,
    a.promptBody ? '## Agent Body\n' + a.promptBody : '',
    a.context?.diff ? '## Git Diff\n```diff\n' + String(a.context.diff).slice(0, 30000) + '\n```' : '',
    a.context?.prd ? '## PRD\n```json\n' + JSON.stringify(a.context.prd, null, 2) + '\n```' : '',
  ].filter(Boolean).join('\n');
}

export { buildPrompt as _buildPrompt };
