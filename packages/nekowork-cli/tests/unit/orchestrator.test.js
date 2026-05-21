// review 오케스트레이터 단위 테스트. mock provider 로 결정론적.
// node:test based orchestrator checks.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { reviewCycle, SENSITIVE_PATTERNS } from '../../scripts/orchestrators/review.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const handoffSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'handoff.schema.json'), 'utf8'));
const validateHandoff = ajv.compile(handoffSchema);

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

test('legacy review writes review-summary.json', async () => {
  const sessionId = 'unit-review-summary';
  const sessionDir = path.join(ROOT, '.harness', 'state', 'sessions', sessionId);
  fs.rmSync(sessionDir, { recursive: true, force: true });

  const r = await reviewCycle({
    task: 'legacy summary smoke',
    sessionId,
    harnessRoot: ROOT,
    fast: true,
    noShip: true,
    noCodex: true,
  });

  const summary = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'review-summary.json'), 'utf8'));
  assert.equal(summary.mode, 'legacy-full-review-cycle');
  assert.equal(summary.compatibility_command, 'review-cycle');
  assert.equal(summary.recommended_wrapper, 'run');
  assert.equal(summary.no_ship, true);
  assert.equal(summary.no_codex, true);
  assert.deepEqual(summary.stages, r.handoffs.map(h => h.stage));
});

test('stopAfter=plan 이면 implement 이전에 멈춘다', async () => {
  const r = await reviewCycle({
    task: '계획만 작성',
    sessionId: 'unit-stop-plan',
    harnessRoot: ROOT,
    stopAfter: 'plan',
    noShip: true,
  });
  assert.equal(r.stoppedAt, 'plan');
  assert.equal(r.verdict, 'planned');
  assert.deepEqual(r.handoffs.map(h => h.stage), ['ideate', 'plan']);
});

test('projectRoot 지정 시 session state 는 대상 프로젝트에 쓰고 agent catalog 는 harnessRoot 에서 읽는다', async () => {
  const sessionId = 'unit-project-root-split';
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-review-project-root-'));
  const harnessSessionDir = path.join(ROOT, '.harness', 'state', 'sessions', sessionId);
  fs.rmSync(harnessSessionDir, { recursive: true, force: true });

  try {
    const r = await reviewCycle({
      task: '포팅 대상 계획 검증',
      sessionId,
      harnessRoot: ROOT,
      projectRoot,
      stopAfter: 'plan',
      noShip: true,
    });

    assert.equal(path.resolve(r.sessionDir), path.join(projectRoot, '.harness', 'state', 'sessions', sessionId));
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'handoffs', '01-ideate.json')));
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'handoffs', '02-plan.json')));
    assert.equal(fs.existsSync(harnessSessionDir), false, 'harnessRoot 에 session state 를 쓰면 안 됨');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('--no-codex 이면 Codex 단계만 건너뛴다', async () => {
  const r = await reviewCycle({
    task: 'auth 문서 수정',
    sessionId: 'unit-no-codex',
    harnessRoot: ROOT,
    noCodex: true,
    noShip: true,
  });
  const stages = r.handoffs.map(h => h.stage);
  assert.ok(stages.includes('self-review'));
  assert.ok(!stages.includes('codex-review'));
  assert.ok(!stages.includes('codex-challenge'));
  assert.equal(r.secureActive, false);
});

test('--secure 와 --fast 는 함께 쓰면 실패한다', async () => {
  await assert.rejects(
    () => reviewCycle({
      task: 'auth 변경',
      sessionId: 'unit-fast-secure-conflict',
      harnessRoot: ROOT,
      fast: true,
      secure: true,
      noShip: true,
    }),
    /--secure 와 --fast/
  );
});

test('핸드오프 파일이 디스크에 잘 떨어진다', async () => {
  const r = await reviewCycle({
    task: '간단 기능',
    sessionId: 'unit-disk',
    harnessRoot: ROOT,
    noShip: true,
  });
  for (const h of r.handoffs) {
    const md = path.join(r.sessionDir, 'handoffs', `${handoffBase(h)}.md`);
    const json = md.replace(/\.md$/, '.json');
    assert.ok(fs.existsSync(md), `${md} exists`);
    assert.ok(fs.existsSync(json), `${json} exists`);
    const data = JSON.parse(fs.readFileSync(json, 'utf8'));
    assert.equal(validateHandoff(data), true, `${json}: ${ajv.errorsText(validateHandoff.errors)}`);
  }
});

test('round 2 handoff 는 round suffix 로 보존되어 stage 파일을 덮어쓰지 않는다', async () => {
  fs.rmSync(path.join(ROOT, '.harness', 'state', 'sessions', 'unit-round-files'), { recursive: true, force: true });
  const r = await reviewCycle({
    task: 'round 파일 보존',
    sessionId: 'unit-round-files',
    harnessRoot: ROOT,
    noShip: true,
    noCodex: true,
  });

  const files = fs.readdirSync(path.join(r.sessionDir, 'handoffs')).filter(f => f.endsWith('.json')).sort();
  assert.ok(files.includes('03-implement.json'));
  assert.ok(files.includes('03-implement-r2.json'));
  assert.ok(files.includes('04-self-review.json'));
  assert.ok(files.includes('04-self-review-r2.json'));
  assert.equal(files.length, r.handoffs.length, '디스크 handoff 수가 메모리 handoff 수와 같아야 함');
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

test('SENSITIVE_PATTERNS: 21개 보안 카테고리 키워드 모두 자동 감지', () => {
  const samples = {
    // 기존 9개
    'src/auth/login.js': true,
    'src/crypto/aes.js': true,
    'src/payment/checkout.js': true,
    'src/session/store.js': true,
    'docs/permission-model.md': true,
    'src/oauth/device-flow.js': true,
    'lib/jwt-verify.js': true,
    'config/password-policy.js': true,
    'config/secret-rotation.js': true,
    // 신규 12개
    'src/token/refresh.js': true,
    'src/apikey/rotate.js': true,
    'src/api-key/rotate.js': true,
    'src/api_key/rotate.js': true,
    'src/cert/issue.js': true,
    'src/tls/config.js': true,
    'src/ssl/handshake.js': true,
    'src/mtls/verify.js': true,
    'src/csrf/middleware.js': true,
    'src/cors/policy.js': true,
    'src/xss/sanitize.js': true,
    'src/webhook/handler.js': true,
    // false positive 방어
    'src/utils.js': false,
    'src/monkey-patch.js': false,
    'README.md': false,
    'src/database/query.js': false,
  };
  for (const [filePath, shouldMatch] of Object.entries(samples)) {
    const hit = SENSITIVE_PATTERNS.some(re => re.test(filePath));
    assert.equal(hit, shouldMatch, `${filePath}: 기대 ${shouldMatch}, 실제 ${hit}`);
  }
});

function pad(stage) {
  const map = { ideate: '01', plan: '02', implement: '03', 'self-review': '04', 'codex-review': '05', 'codex-challenge': '06', ship: '07' };
  return map[stage] || '00';
}

function handoffBase(h) {
  const round = Number(h.round || 1);
  return `${pad(h.stage)}-${h.stage}${round > 1 ? `-r${round}` : ''}`;
}
