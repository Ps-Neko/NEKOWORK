// Internal provider runner.
// Calls an explicit local command using the NEKOWORK internal-provider JSON protocol.

import { extractJson } from '../../core/json-extractor.js';
import { withGitMutationGuard } from '../../core/git-mutation-guard.js';
import { spawnAndCollect } from '../../core/subprocess.js';

export async function runInternal(args) {
  const command = buildInternalCommand(process.env);
  const cwd = args.projectRoot || args.harnessRoot || process.cwd();
  const prompt = buildInternalPrompt(args);

  const run = () => spawnAndCollect(command.bin, command.args, prompt, {
    label: 'internal-provider',
    timeoutMs: Number(process.env.HARNESS_INTERNAL_PROVIDER_TIMEOUT_S || 180) * 1000,
    cwd,
  });

  const stdout = args.executionMode === 'workspace-write'
    ? await run()
    : await withGitMutationGuard(
      cwd,
      run,
      { label: 'internal-provider', allowEnvKey: 'HARNESS_INTERNAL_PROVIDER_ALLOW_WORKSPACE_MUTATION' },
    );

  return parseInternalResponse(stdout);
}

function buildInternalCommand(env = process.env) {
  const bin = String(env.HARNESS_INTERNAL_PROVIDER_COMMAND || '').trim();
  if (!bin) {
    throw new Error('HARNESS_INTERNAL_PROVIDER_COMMAND is required when HARNESS_PROVIDER_OVERRIDE=internal.');
  }

  const argsJson = env.HARNESS_INTERNAL_PROVIDER_ARGS_JSON;
  if (!argsJson) return { bin, args: [] };

  let parsed;
  try {
    parsed = JSON.parse(argsJson);
  } catch (error) {
    throw new Error(`HARNESS_INTERNAL_PROVIDER_ARGS_JSON must be a JSON array: ${error.message}`);
  }
  if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) {
    throw new Error('HARNESS_INTERNAL_PROVIDER_ARGS_JSON must be a JSON array of strings.');
  }
  return { bin, args: parsed };
}

function buildInternalPrompt(args) {
  return JSON.stringify({
    protocol: 'nekowork.internal-provider.v1',
    stage: args.stage,
    agent: args.agent,
    model: args.model,
    sandbox: args.sandbox,
    network_access: args.networkAccess,
    execution_mode: args.executionMode || 'handoff',
    task: args.task || '',
    system: [
      `You are the NEKOWORK agent "${args.agent}" running stage "${args.stage}".`,
      'Return exactly one JSON object conforming to schemas/handoff.schema.json.',
      'Do not commit, push, publish, deploy, or mutate the target project unless execution_mode is workspace-write.',
    ].join('\n'),
    agent_body: args.promptBody || '',
    context: args.context || {},
  }, null, 2);
}

function parseInternalResponse(stdout) {
  const json = extractJson(stdout);
  if (!json) {
    throw new Error('Internal provider response did not contain JSON. raw:\n' + String(stdout || '').slice(0, 500));
  }

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`Internal provider response JSON parse failed: ${error.message}`);
  }

  return parsed;
}

export {
  buildInternalCommand as _buildInternalCommand,
  buildInternalPrompt as _buildInternalPrompt,
  parseInternalResponse as _parseInternalResponse,
};
