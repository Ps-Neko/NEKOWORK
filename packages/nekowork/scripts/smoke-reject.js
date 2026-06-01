#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/cli.js', 'team'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status === 0) {
  console.error('Expected unknown verb `team` to be rejected by the slim package.');
  if (result.stdout) process.stderr.write(result.stdout);
  process.exit(1);
}

const output = `${result.stdout || ''}${result.stderr || ''}`;
if (!output.includes('verify-pr')) {
  console.error('Expected rejection output to list supported verbs (verify-pr).');
  if (output) process.stderr.write(output);
  process.exit(1);
}

console.log('slim package rejects unsupported verb and lists supported verbs');
