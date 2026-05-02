// review 오케스트레이터 단위 테스트. mock provider 로 결정론적.
// node:test based orchestrator checks.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { reviewCycle } from '../../scripts/orchestrators/review.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('mock 풀사이클: --secure 없이도 auth 키워드면 단계 6 활성', async () => {
  const r = await reviewCycle({
    task: 'auth 미들웨어 추가',
    sessionId: 'unit-secure-auto',
    harnessRoot: ROOT,
    noShip: true,
  });
  assert.equal(r.humanGate, false);
  assert.equal(r.secureActive, true);
  const stages = r.handoffs.map(h => h.stage);
  assert.ok(stages.includes('codex-challenge'), 'auth 자동 활성으로 challenge 가 와야 함');
});

test('mock 풀사이클: --fast 면 단계 1·6 스킵', async () => {
  const r = await reviewCycle({
    task: '리팩토링 cleanup',
    sessionId: 'unit-fast',
    harnessRoot: ROOT,
    fast: true,
    noShip: true,
  });
  const stages = r.handoffs.map(h => h.stage);
  assert.ok(!stages.includes('ideate'), 'ideate skipped');
  assert.ok(!stages.includes('codex-challenge'), 'challenge skipped');
});

test('mock 풀사이클: 단계 4 round 1 → fix loop → round 2 approve', async () => {
  const r = await reviewCycle({
    task: '결제 환불 버그 수정',
    sessionId: 'unit-fixloop',
    harnessRoot: ROOT,
    noShip: true,
  });
  const selfReviews = r.handoffs.filter(h => h.stage === 'self-review');
  assert.equal(selfReviews.length, 2, 'self-review 가 2번 (round 1 fix-loop, round 2 approve)');
  assert.equal(selfReviews[0].verdict, 'approve_with_fixes');
  assert.equal(selfReviews[1].verdict, 'approve');
});

test('--no-ship 이면 단계 7 없음', async () => {
  const r = await reviewCycle({
    task: '문서 갱신',
    sessionId: 'unit-noship',
    harnessRoot: ROOT,
    noShip: true,
  });
  assert.ok(!r.handoffs.find(h => h.stage === 'ship'), 'ship skipped');
});

test('핸드오프 파일이 디스크에 잘 떨어진다', async () => {
  const r = await reviewCycle({
    task: '간단 기능',
    sessionId: 'unit-disk',
    harnessRoot: ROOT,
    noShip: true,
  });
  for (const h of r.handoffs) {
    const md = path.join(r.sessionDir, 'handoffs', `${pad(h.stage)}-${h.stage}.md`);
    const json = md.replace(/\.md$/, '.json');
    assert.ok(fs.existsSync(md), `${md} exists`);
    assert.ok(fs.existsSync(json), `${json} exists`);
  }
});

test('live provider 실패는 기본적으로 mock fallback 하지 않는다', async () => {
  const oldPath = process.env.PATH;
  const oldFallback = process.env.HARNESS_LIVE_ALLOW_MOCK_FALLBACK;
  process.env.PATH = '';
  delete process.env.HARNESS_LIVE_ALLOW_MOCK_FALLBACK;
  try {
    await assert.rejects(
      () => reviewCycle({
        task: 'live 실패 검증',
        sessionId: 'unit-live-no-fallback',
        harnessRoot: ROOT,
        live: true,
        fast: true,
        noShip: true,
      }),
      /planner\/plan live 실패/
    );
  } finally {
    process.env.PATH = oldPath;
    if (oldFallback === undefined) delete process.env.HARNESS_LIVE_ALLOW_MOCK_FALLBACK;
    else process.env.HARNESS_LIVE_ALLOW_MOCK_FALLBACK = oldFallback;
  }
});

function pad(stage) {
  const map = { ideate: '01', plan: '02', implement: '03', 'self-review': '04', 'codex-review': '05', 'codex-challenge': '06', ship: '07' };
  return map[stage] || '00';
}
