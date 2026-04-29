import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import path from 'node:path';
import { decide } from '../../scripts/lib/router.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('plan 단계 → planner / opus / claude', () => {
  const d = decide({ stage: 'plan', task: '기능 추가', files: [], harnessRoot: ROOT });
  assert.equal(d.agent, 'planner');
  assert.equal(d.model, 'opus');
  assert.equal(d.provider, 'claude');
});

test('eco mode: opus → sonnet 다운그레이드 (단계 plan)', () => {
  const d = decide({ stage: 'plan', ecoMode: true, harnessRoot: ROOT });
  assert.equal(d.model, 'sonnet');
  assert.ok(d.eco_mode);
});

test('eco mode floor: 단계 self-review 는 sonnet 미만 안 내림', () => {
  const d = decide({ stage: 'self-review', ecoMode: true, harnessRoot: ROOT });
  // code-reviewer 는 opus → eco 시 sonnet 으로 내림. 그러나 self-review 는 floor=sonnet.
  assert.equal(d.model, 'sonnet');
});

test('codex-review → codex-reviewer / codex provider', () => {
  const d = decide({ stage: 'codex-review', harnessRoot: ROOT });
  assert.equal(d.agent, 'codex-reviewer');
  assert.equal(d.provider, 'codex');
});

test('blast radius / risk_level 보존', () => {
  const d = decide({
    stage: 'self-review',
    files: ['a.ts', 'b.ts', 'c.ts'],
    riskLevel: 'high',
    harnessRoot: ROOT,
  });
  assert.equal(d.blast_radius, 3);
  assert.equal(d.risk_level, 'high');
});

test('ship 단계 → doc-writer / haiku', () => {
  const d = decide({ stage: 'ship', harnessRoot: ROOT });
  assert.equal(d.agent, 'doc-writer');
  assert.equal(d.model, 'haiku');
});
