import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  loadUpstreamArtifact,
  loadUpstreamBundle,
  UPSTREAM_EXCERPT_LIMIT,
} from '../../scripts/lib/upstream-artifacts.js';
import { rmrf } from '../helpers/tmp.js';

function mkProject(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('loadUpstreamArtifact returns null when no auto file and no explicit', () => {
  const projectRoot = mkProject('upstream-none-');
  try {
    assert.equal(loadUpstreamArtifact('context', projectRoot), null);
    assert.equal(loadUpstreamArtifact('domain', projectRoot), null);
    assert.equal(loadUpstreamArtifact('spec', projectRoot), null);
    assert.equal(loadUpstreamArtifact('plan', projectRoot), null);
  } finally {
    rmrf(projectRoot);
  }
});

test('loadUpstreamArtifact auto-picks projectRoot file by canonical name', () => {
  const projectRoot = mkProject('upstream-auto-');
  try {
    const body = 'domain body';
    fs.writeFileSync(path.join(projectRoot, 'DOMAIN.md'), body);
    const a = loadUpstreamArtifact('domain', projectRoot);
    assert.ok(a);
    assert.equal(a.path, 'DOMAIN.md');
    assert.equal(a.source, 'auto');
    assert.equal(a.size, Buffer.byteLength(body, 'utf8'));
    assert.equal(a.sha1, crypto.createHash('sha1').update(body).digest('hex'));
    assert.equal(a.truncated, false);
    assert.equal(a.excerpt, body);
  } finally {
    rmrf(projectRoot);
  }
});

test('loadUpstreamArtifact honors explicit path even if auto file also exists', () => {
  const projectRoot = mkProject('upstream-explicit-');
  try {
    fs.writeFileSync(path.join(projectRoot, 'SPEC.md'), 'auto body');
    const explicitPath = path.join(projectRoot, 'custom-spec.md');
    fs.writeFileSync(explicitPath, 'explicit body');
    const a = loadUpstreamArtifact('spec', projectRoot, explicitPath);
    assert.equal(a.path, 'custom-spec.md');
    assert.equal(a.source, 'explicit');
    assert.equal(a.excerpt, 'explicit body');
  } finally {
    rmrf(projectRoot);
  }
});

test('loadUpstreamArtifact throws when explicit path missing', () => {
  const projectRoot = mkProject('upstream-explicit-missing-');
  try {
    assert.throws(
      () => loadUpstreamArtifact('plan', projectRoot, path.join(projectRoot, 'nope.md')),
      /plan file not found/i,
    );
  } finally {
    rmrf(projectRoot);
  }
});

test('loadUpstreamArtifact truncates oversize files at the limit and flags truncated=true', () => {
  const projectRoot = mkProject('upstream-truncate-');
  try {
    const body = 'a'.repeat(UPSTREAM_EXCERPT_LIMIT + 1024);
    fs.writeFileSync(path.join(projectRoot, 'context.md'), body);
    const a = loadUpstreamArtifact('context', projectRoot);
    assert.equal(a.truncated, true);
    assert.equal(a.size, Buffer.byteLength(body, 'utf8'));
    assert.equal(a.excerpt.length, UPSTREAM_EXCERPT_LIMIT);
  } finally {
    rmrf(projectRoot);
  }
});

test('loadUpstreamArtifact rejects unknown kind', () => {
  assert.throws(() => loadUpstreamArtifact('bogus', '/tmp'), /unknown upstream artifact kind/i);
});

test('loadUpstreamBundle returns all four slots with null defaults', () => {
  const projectRoot = mkProject('upstream-bundle-');
  try {
    fs.writeFileSync(path.join(projectRoot, 'context.md'), 'ctx');
    fs.writeFileSync(path.join(projectRoot, 'PLAN.md'), 'plan body');
    const bundle = loadUpstreamBundle(projectRoot);
    assert.ok(bundle.context);
    assert.equal(bundle.domain, null);
    assert.equal(bundle.spec, null);
    assert.ok(bundle.plan);
    assert.equal(bundle.plan.path, 'PLAN.md');
  } finally {
    rmrf(projectRoot);
  }
});
