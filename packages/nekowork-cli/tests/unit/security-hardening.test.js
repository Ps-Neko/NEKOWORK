import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  checkSecurityHardening,
  isPinnedActionRef,
  isSemverMcpPin,
} from '../../scripts/ci/security-hardening.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('security hardening accepts pinned major-version and SHA action refs', () => {
  assert.equal(isPinnedActionRef('actions/checkout@v5'), true);
  assert.equal(isPinnedActionRef('actions/checkout@v5.0.1'), true);
  assert.equal(isPinnedActionRef(`owner/action@${'a'.repeat(40)}`), true);
  assert.equal(isPinnedActionRef('actions/checkout@main'), false);
  assert.equal(isPinnedActionRef('actions/checkout@latest'), false);
  assert.equal(isPinnedActionRef('actions/checkout'), false);
});

test('security hardening validates exact semver MCP pins', () => {
  assert.equal(isSemverMcpPin('@modelcontextprotocol/server-github@2025.4.8'), true);
  assert.equal(isSemverMcpPin('server-memory@1.2.3'), true);
  assert.equal(isSemverMcpPin('@modelcontextprotocol/server-github@latest'), false);
  assert.equal(isSemverMcpPin('@modelcontextprotocol/server-github'), false);
});

test('security hardening passes the repository policy', () => {
  const report = checkSecurityHardening(ROOT);
  assert.deepEqual(report.errors, []);
  assert.equal(report.stats.workflows, 2);
  assert.ok(report.stats.actions >= 2);
});

test('security hardening catches unsafe workflow triggers and action refs', () => {
  const root = makeFixtureRoot();
  fs.writeFileSync(path.join(root, '.github', 'workflows', 'bad.yml'), [
    'name: bad',
    'on:',
    '  pull_request_target:',
    'permissions:',
    '  contents: read',
    'jobs:',
    '  bad:',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 99',
    '    steps:',
    '      - uses: actions/checkout@main',
    '',
  ].join('\n'));

  const report = checkSecurityHardening(root);
  assert.match(report.errors.join('\n'), /pull_request_target is forbidden/);
  assert.match(report.errors.join('\n'), /exceeds dead-man max 20/);
  assert.match(report.errors.join('\n'), /actions\/checkout@main/);
});

test('security hardening requires OIDC for static cloud credential secrets', () => {
  const root = makeFixtureRoot();
  fs.writeFileSync(path.join(root, '.github', 'workflows', 'cloud.yml'), [
    'name: cloud',
    'on:',
    '  workflow_dispatch:',
    'permissions:',
    '  contents: read',
    'jobs:',
    '  deploy:',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 10',
    '    steps:',
    '      - run: echo "${{ secrets.AWS_ACCESS_KEY_ID }}"',
    '',
  ].join('\n'));

  const report = checkSecurityHardening(root);
  assert.match(report.errors.join('\n'), /AWS_ACCESS_KEY_ID/);
});

function makeFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-security-hardening-'));
  fs.mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agent.yaml'), [
    'security:',
    '  mcp_pin_required: true',
    '  dead_man_switch:',
    '    enabled: true',
    '    max_ci_job_minutes: 20',
    '    require_explicit_live_opt_in: true',
    '  oidc:',
    '    required_for_cloud_credentials: true',
    '    static_cloud_secret_patterns:',
    '      - AWS_ACCESS_KEY_ID',
    '      - AWS_SECRET_ACCESS_KEY',
    '      - AZURE_CLIENT_SECRET',
    '      - GOOGLE_APPLICATION_CREDENTIALS',
    '  supply_chain:',
    '    package_lock_required: true',
    '    require_mcp_semver_pin: true',
    'mcp:',
    '  external_servers:',
    '    - name: github',
    '      pin: "@modelcontextprotocol/server-github@2025.4.8"',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    dependencies: { yaml: '^2.6.1' },
  }, null, 2));
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}\n');
  return root;
}
