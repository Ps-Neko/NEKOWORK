import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-costs-'));
process.env.HARNESS_HOME = TMP;

const { record, list, summarize } = await import('../../scripts/lib/costs.js');

test('record: opus 1k in / 1k out → ~$0.09', () => {
  const r = record({ agent: 'planner', stage: 'plan', provider: 'claude', model: 'opus', input_tokens: 1000, output_tokens: 1000 });
  assert.ok(r.estimate_usd > 0);
  assert.ok(r.estimate_usd < 0.2);
});

test('list/summarize: 두 건 합산', () => {
  record({ agent: 'executor', stage: 'implement', provider: 'claude', model: 'sonnet', input_tokens: 5000, output_tokens: 2000 });
  const rows = list({ since: 'all' });
  assert.equal(rows.length, 2);
  const sum = summarize(rows);
  assert.ok(sum.total_usd > 0);
  assert.ok('claude' in sum.by_provider);
  assert.ok('opus' in sum.by_model);
  assert.ok('sonnet' in sum.by_model);
});

test('list since=1h 는 그대로 (방금 기록), since=1s 는 0건', async () => {
  const recent = list({ since: '1h' });
  assert.ok(recent.length >= 2);
  await new Promise(r => setTimeout(r, 1100));
  const noneSinceFuture = list({ since: '1s' });
  assert.equal(noneSinceFuture.length, 0);
});
