import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { reviewCycle } from '../../scripts/orchestrators/review.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function mkProject(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('reviewCycle stopAfter=plan records upstream domain and spec when auto-picked', async () => {
  const projectRoot = mkProject('harness-review-upstream-auto-');
  try {
    fs.writeFileSync(path.join(projectRoot, 'DOMAIN.md'), '# Domain\nA Widget has SKU and price.');
    fs.writeFileSync(path.join(projectRoot, 'SPEC.md'), '# Spec\nUser can filter by price.');

    const r = await reviewCycle({
      task: 'add price filter',
      sessionId: 'unit-review-upstream-auto',
      harnessRoot: ROOT,
      projectRoot,
      stopAfter: 'plan',
    });

    assert.equal(r.stoppedAt, 'plan');
    const planInputsPath = path.join(r.sessionDir, 'plan-inputs.json');
    assert.ok(fs.existsSync(planInputsPath), 'plan-inputs.json must be written when stopAfter=plan');
    const planInputs = JSON.parse(fs.readFileSync(planInputsPath, 'utf8'));
    assert.ok(planInputs.upstream, 'plan-inputs.upstream must exist');
    assert.equal(planInputs.upstream.domain.path, 'DOMAIN.md');
    assert.equal(planInputs.upstream.domain.source, 'auto');
    assert.equal(planInputs.upstream.spec.path, 'SPEC.md');
    assert.equal(planInputs.upstream.spec.source, 'auto');
    assert.equal(planInputs.upstream.context, null);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('reviewCycle honors explicit --domain-file / --spec-file paths', async () => {
  const projectRoot = mkProject('harness-review-upstream-explicit-');
  try {
    const domainPath = path.join(projectRoot, 'custom-domain.md');
    const specPath = path.join(projectRoot, 'custom-spec.md');
    fs.writeFileSync(domainPath, 'custom domain body');
    fs.writeFileSync(specPath, 'custom spec body');
    fs.writeFileSync(path.join(projectRoot, 'DOMAIN.md'), 'should be ignored');

    const r = await reviewCycle({
      task: 'something',
      sessionId: 'unit-review-upstream-explicit',
      harnessRoot: ROOT,
      projectRoot,
      domainFile: domainPath,
      specFile: specPath,
      stopAfter: 'plan',
    });

    const planInputs = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'plan-inputs.json'), 'utf8'));
    assert.equal(planInputs.upstream.domain.path, 'custom-domain.md');
    assert.equal(planInputs.upstream.domain.source, 'explicit');
    assert.equal(planInputs.upstream.spec.path, 'custom-spec.md');
    assert.equal(planInputs.upstream.spec.source, 'explicit');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('reviewCycle leaves plan-inputs.upstream.domain null when no DOMAIN.md present', async () => {
  const projectRoot = mkProject('harness-review-upstream-empty-');
  try {
    const r = await reviewCycle({
      task: 'nothing here',
      sessionId: 'unit-review-upstream-empty',
      harnessRoot: ROOT,
      projectRoot,
      stopAfter: 'plan',
    });
    const planInputs = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'plan-inputs.json'), 'utf8'));
    assert.equal(planInputs.upstream.domain, null);
    assert.equal(planInputs.upstream.spec, null);
    assert.equal(planInputs.upstream.context, null);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('reviewCycle throws when explicit --domain-file points to missing path', async () => {
  const projectRoot = mkProject('harness-review-upstream-missing-');
  try {
    await assert.rejects(
      reviewCycle({
        task: 'x',
        sessionId: 'unit-review-upstream-missing',
        harnessRoot: ROOT,
        projectRoot,
        domainFile: path.join(projectRoot, 'nope.md'),
        stopAfter: 'plan',
      }),
      /domain file not found/i,
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
