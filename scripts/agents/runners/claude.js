// Claude runner.
// Default live mode uses the local Claude Code CLI subscription/OAuth session.
// Set HARNESS_CLAUDE_RUNNER=sdk to opt into Anthropic SDK/API-key mode.

import { assertDelegatedCliAuth } from '../../core/auth-guard.js';
import { resolveCli } from '../../core/cli-resolver.js';
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

  const claudeBin = resolveCli('claude');
  if (!claudeBin) {
    throw new Error('claude CLI is not installed. Install/login to Claude Code, or explicitly use HARNESS_CLAUDE_RUNNER=sdk with ANTHROPIC_API_KEY.');
  }

  const systemPrompt = buildSystem(args);
  const userPrompt = buildUserMessage(args);
  const modelId = process.env.HARNESS_CLAUDE_MODEL || args.model || 'sonnet';
  const cliArgs = [
    '-p',
    '--output-format', 'json',
    '--no-session-persistence',
    '--tools', '',
    '--model', modelId,
    '--system-prompt', systemPrompt,
  ];

  const stdout = await spawnAndCollect(claudeBin, cliArgs, userPrompt, {
    label: 'claude',
    timeoutMs: Number(process.env.HARNESS_CLAUDE_TIMEOUT_S || 180) * 1000,
  });
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

function buildSystem(a) {
  const tools = a.disallowedTools?.length
    ? `\nDisallowed tools: ${a.disallowedTools.join(', ')}`
    : '';
  return `You are the HARNESS agent "${a.agent}" running stage "${a.stage}".${tools}
Sandbox: ${a.sandbox || 'workspace-write'}.
Output rules: respond with ONE JSON object conforming to schemas/handoff.schema.json.
No prose outside JSON. Korean for natural-language fields.

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
  buildUserMessage as _buildUserMessage,
  extractJson,
  parseCliJson as _parseCliJson,
  normalizeCliUsage as _normalizeCliUsage,
};
