// Claude runner.
// Default live mode uses the local Claude Code CLI subscription/OAuth session.
// Set HARNESS_CLAUDE_RUNNER=sdk to opt into Anthropic SDK/API-key mode.

import { assertDelegatedCliAuth } from '../../core/auth-guard.js';
import { resolveProviderCli } from '../../core/cli-resolver.js';
import { withGitMutationGuard } from '../../core/git-mutation-guard.js';
import { extractJson } from '../../core/json-extractor.js';
import { spawnAndCollect } from '../../core/subprocess.js';

const MODEL_MAP = {
  opus: 'claude-opus-4-7',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
};

export async function runClaude(args) {
  const runner = (process.env.HARNESS_CLAUDE_RUNNER || 'cli').toLowerCase();
  if (runner === 'sdk') return runClaudeSdk(args);
  return runClaudeCli(args);
}

async function runClaudeSdk(args) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required when HARNESS_CLAUDE_RUNNER=sdk. Use Claude Code CLI login for the default runner.');
  }

  let Anthropic;
  try {
    ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
  } catch {
    throw new Error('@anthropic-ai/sdk is not installed. Install it or use the default Claude Code CLI runner.');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const modelId = MODEL_MAP[args.model] || args.model;
  const systemPrompt = buildSystem(args);
  const userPrompt = buildUserMessage(args);

  const resp = await client.messages.create({
    model: modelId,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = resp.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim();
  const jsonText = extractJson(text);
  if (!jsonText) {
    throw new Error('Claude SDK response did not contain JSON. raw:\n' + text.slice(0, 500));
  }

  let parsed;
  try { parsed = JSON.parse(jsonText); }
  catch (e) { throw new Error('Claude SDK response JSON parse failed: ' + e.message); }

  return parsed;
}

async function runClaudeCli(args) {
  assertDelegatedCliAuth('claude');

  const cwd = args.projectRoot || args.harnessRoot || process.cwd();
  const trustRoots = [cwd, args.harnessRoot].filter(Boolean);
  const claudeBin = resolveProviderCli('claude', { root: cwd, roots: trustRoots });
  if (!claudeBin) {
    throw new Error('claude CLI is not installed. Install/login to Claude Code, or explicitly use HARNESS_CLAUDE_RUNNER=sdk with ANTHROPIC_API_KEY.');
  }

  const systemPrompt = buildSystem(args);
  const userPrompt = buildUserMessage(args);
  const modelId = process.env.HARNESS_CLAUDE_MODEL || args.model || 'sonnet';
  const cliArgs = buildCliArgs(args, modelId, systemPrompt);

  const run = () => spawnAndCollect(claudeBin, cliArgs, userPrompt, {
    label: 'claude',
    // 풀사이클 stage 3 implement 는 verify smoke(~25s) 보다 응답이 길어
    // 180s default 로는 timeout 다발. 600s (10분) 로 상향. 환경변수로 추가 조정 가능.
    timeoutMs: Number(process.env.HARNESS_CLAUDE_TIMEOUT_S || 600) * 1000,
    cwd,
  });
  const stdout = args.executionMode === 'workspace-write'
    ? await run()
    : await withGitMutationGuard(
      cwd,
      run,
      { label: 'claude', allowEnvKey: 'HARNESS_CLAUDE_ALLOW_WORKSPACE_MUTATION' },
    );
  const wrapper = parseCliJson(stdout);
  const text = typeof wrapper?.result === 'string' ? wrapper.result : stdout;
  const jsonText = extractJson(text);
  if (!jsonText) {
    throw new Error('Claude CLI response did not contain JSON. raw:\n' + text.slice(0, 500));
  }

  let parsed;
  try { parsed = JSON.parse(jsonText); }
  catch (e) { throw new Error('Claude CLI response JSON parse failed: ' + e.message); }

  if (wrapper?.usage) parsed.usage = normalizeCliUsage(wrapper.usage);
  return parsed;
}

function buildCliArgs(a, modelId, systemPrompt) {
  const args = [
    '-p',
    '--output-format', 'json',
    '--no-session-persistence',
    '--model', modelId,
    '--system-prompt', systemPrompt,
  ];

  if (a.executionMode === 'workspace-write') {
    args.push(
      '--permission-mode', process.env.HARNESS_CLAUDE_EXEC_PERMISSION_MODE || 'acceptEdits',
      '--allowedTools', process.env.HARNESS_CLAUDE_EXEC_TOOLS || 'Edit Write MultiEdit',
    );
  } else {
    args.push('--tools', '', '--permission-mode', 'plan');
  }

  return args;
}

function buildSystem(a) {
  const tools = a.disallowedTools?.length
    ? `\nDisallowed tools: ${a.disallowedTools.join(', ')}`
    : '';
  return `You are the HARNESS agent "${a.agent}" running stage "${a.stage}".${tools}
Sandbox: ${a.sandbox || 'workspace-write'}.
Output rules: respond with ONE JSON object conforming to schemas/handoff.schema.json.
No prose outside JSON. Korean for natural-language fields.
${a.executionMode === 'workspace-write'
    ? 'Workspace-write execution mode: edit files in this isolated git worktree if needed, but do not commit or push. Finish by returning the JSON handoff with changed files and evidence.'
    : 'Non-interactive handoff mode: do not call tools, edit files, run shell commands, wait for approvals, or make commits. If the agent body asks you to implement, test, or commit, summarize the intended change and evidence in JSON only.'}
Keep the JSON concise so the CLI can finish promptly.

Agent body:
${a.promptBody}`;
}

function buildUserMessage(a) {
  const lines = [];
  lines.push('## Task');
  lines.push(a.task || '(none)');
  lines.push('');
  if (a.context?.prd) {
    lines.push('## PRD');
    lines.push('```json');
    lines.push(JSON.stringify(a.context.prd, null, 2));
    lines.push('```');
  }
  if (a.context?.acceptanceCriteria?.length) {
    lines.push('## Acceptance Criteria');
    for (const ac of a.context.acceptanceCriteria) {
      lines.push(`- ${ac.id}: ${ac.desc}`);
    }
    lines.push('');
  }
  if (a.context?.qualityChecklist?.length) {
    lines.push(`## Profile Quality Checklist${a.context.profile ? ` (${a.context.profile})` : ''}`);
    for (const item of a.context.qualityChecklist) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }
  if (a.context?.diff) {
    lines.push('## Git Diff');
    lines.push('```diff');
    lines.push(String(a.context.diff).slice(0, 20000));
    lines.push('```');
  }
  if (a.context?.priorHandoffs?.length) {
    lines.push('## Prior handoffs');
    for (const h of a.context.priorHandoffs) {
      lines.push(`### ${h.stage}`);
      lines.push(`Decided: ${h.decided}`);
      lines.push(`Files: ${(h.files || []).join(', ')}`);
      if (h.verdict) lines.push(`Verdict: ${h.verdict}`);
      lines.push('');
    }
  }
  if (a.context?.round && a.context.round > 1) {
    lines.push(`## Round ${a.context.round}: consider unresolved issues from earlier rounds.`);
  }
  return lines.join('\n');
}

function parseCliJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { return null; }
}

function normalizeCliUsage(usage) {
  const last = Array.isArray(usage.iterations) ? usage.iterations.at(-1) : null;
  return {
    input_tokens: Number(last?.input_tokens ?? usage.input_tokens ?? 0),
    output_tokens: Number(last?.output_tokens ?? usage.output_tokens ?? 0),
    cache_creation_input_tokens: Number(last?.cache_creation_input_tokens ?? usage.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens: Number(last?.cache_read_input_tokens ?? usage.cache_read_input_tokens ?? 0),
    total_cost_usd: Number(usage.total_cost_usd ?? 0),
  };
}

export {
  buildSystem as _buildSystem,
  buildCliArgs as _buildCliArgs,
  buildUserMessage as _buildUserMessage,
  extractJson,
  parseCliJson as _parseCliJson,
  normalizeCliUsage as _normalizeCliUsage,
};
