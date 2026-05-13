import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-inst-'));
process.env.HARNESS_HOME = TMP;
process.env.HARNESS_INSTINCT_PROMOTE_THRESHOLD = '3';

const { record, list, get, promote, prune } = await import('../../scripts/lib/instincts.js');

test('record: 첫 호출 → count=1, confidence=1/3', () => {
  const r = record({ kind: 'routing', key: 'auth→security-reviewer', summary: '인증 코드 → security-reviewer escalate' });
  assert.equal(r.count, 1);
  assert.ok(Math.abs(r.confidence - 1/3) < 0.001);
});

test('record: 같은 패턴 두 번 → count=2', () => {
  const r = record({ kind: 'routing', key: 'auth→security-reviewer' });
  assert.equal(r.count, 2);
});

test('record: 임계 도달 → confidence=1', () => {
  const r = record({ kind: 'routing', key: 'auth→security-reviewer' });
  assert.equal(r.count, 3);
  assert.equal(r.confidence, 1);
});

test('list: kind 필터', () => {
  record({ kind: 'issue-pattern', key: 'sql-injection-login', summary: 'login query 에 injection 가능' });
  const r = list({ kind: 'routing' });
  assert.ok(r.length >= 1);
  assert.ok(r.every(i => i.kind === 'routing'));
});

test('list: minConfidence', () => {
  const r = list({ minConfidence: 1 });
  assert.ok(r.length >= 1);
  assert.ok(r.every(i => i.confidence >= 1));
});

test('promote: 임계 미만이면 거절', () => {
  // sql-injection-login 은 count=1 → confidence < 1
  const all = list({ kind: 'issue-pattern' });
  const target = all.find(i => i.key === 'sql-injection-login');
  assert.ok(target);
  assert.throws(() => promote(target.id), /confidence/);
});

test('promote: 임계 도달 → promoted=true', () => {
  const all = list({ kind: 'routing', minConfidence: 1 });
  assert.ok(all.length >= 1);
  const id = all[0].id;
  assert.throws(() => promote(id), /reviewed-by is required/);
  const r = promote(id, { reviewedBy: 'unit-reviewer', reason: 'diverse evidence reached the reviewed-memory threshold' });
  assert.equal(r.promoted, true);
  assert.ok(r.promoted_at);
  assert.equal(r.review_status, 'adopted');
  assert.equal(r.reviewed_by, 'unit-reviewer');
  assert.match(r.review_reason, /reviewed-memory threshold/);
});

test('prune: dry-run 은 파일 안 지움', () => {
  const beforeCount = fs.readdirSync(path.join(TMP, 'instincts')).filter(f => f.endsWith('.json')).length;
  prune({ olderDays: 0, dryRun: true });
  const afterCount = fs.readdirSync(path.join(TMP, 'instincts')).filter(f => f.endsWith('.json')).length;
  assert.equal(beforeCount, afterCount);
});

test('prune: olderDays=0 + 미승격 + confidence<1 → 제거', () => {
  // sql-injection-login 만 해당.
  const result = prune({ olderDays: 0, dryRun: false });
  assert.ok(result.removed.length >= 1, 'removed should include sql-injection-login');
});

test('get: 존재하지 않는 id → null', () => {
  assert.equal(get('deadbeef0000'), null);
});

test('evidence 누적은 최대 20개', () => {
  for (let i = 0; i < 25; i++) {
    record({ kind: 'fix-flow', key: 'long-evidence', evidence: { round: i } });
  }
  const all = list({ kind: 'fix-flow' });
  const target = all.find(i => i.key === 'long-evidence');
  assert.ok(target);
  assert.ok(target.evidence.length <= 20);
});

const { ready } = await import('../../scripts/lib/instincts.js');

test('ready: confidence < 1 → blocked (confidence)', () => {
  // 새 인스팅트, 1번만 record
  record({ kind: 'routing', key: 'just-once-pattern', evidence: { sessionId: 's1' } });
  const r = ready();
  const blk = r.blocked.find(b => b.key === 'just-once-pattern');
  assert.ok(blk);
  assert.match(blk.reason, /confidence/);
});

test('ready: 동일 sessionId 만 → diversity 낮아 blocked', () => {
  for (let i = 0; i < 3; i++) {
    record({ kind: 'fix-flow', key: 'same-session-only', evidence: { sessionId: 'one' } });
  }
  const r = ready({ minDiversity: 0.5 });
  const blk = r.blocked.find(b => b.key === 'same-session-only');
  assert.ok(blk);
  assert.match(blk.reason, /diversity/);
});

test('ready: 다양 session + 임계 → ready 후보', () => {
  for (const sid of ['a', 'b', 'c']) {
    record({ kind: 'routing', key: 'diverse-pattern', evidence: { sessionId: sid } });
  }
  const r = ready({ minDiversity: 0.5, maxStaleDays: 365 });
  const ok = r.ready.find(x => x.key === 'diverse-pattern');
  assert.ok(ok, '다양 session 인스팅트는 ready 에 들어와야 함');
  assert.ok(ok.diversity >= 0.5);
});

test('ready: 이미 promoted → blocked (already_promoted)', () => {
  for (const sid of ['x', 'y', 'z']) {
    record({ kind: 'routing', key: 'promote-target', evidence: { sessionId: sid } });
  }
  const r1 = ready({ maxStaleDays: 365 });
  const target = r1.ready.find(x => x.key === 'promote-target');
  assert.ok(target);
  promote(target.id, { reviewedBy: 'unit-reviewer', reason: 'ready candidate explicitly adopted in test' });
  const r2 = ready({ maxStaleDays: 365 });
  const blk = r2.blocked.find(b => b.id === target.id);
  assert.ok(blk);
  assert.equal(blk.reason, 'already_promoted');
});
