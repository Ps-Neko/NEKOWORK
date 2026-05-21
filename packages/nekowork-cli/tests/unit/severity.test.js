import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  classifyCategory, classifySeverity, severityCounts, deriveVerdict, riskLevel
} from '../../scripts/lib/severity.js';

test('명시 category 가 있으면 그대로', () => {
  assert.equal(classifyCategory({ category: 'security', summary: 'foo' }), 'security');
});

test('휴리스틱: SQL injection → security', () => {
  assert.equal(classifyCategory({ summary: 'SQL injection in query builder' }), 'security');
});

test('휴리스틱: race condition → correctness, severity high', () => {
  const i = { summary: 'race condition in cache' };
  assert.equal(classifyCategory(i), 'correctness');
  assert.equal(classifySeverity(i), 'high');
});

test('security + injection 키워드 → critical', () => {
  const i = { summary: 'SQL injection allows auth bypass' };
  assert.equal(classifyCategory(i), 'security');
  assert.equal(classifySeverity(i), 'critical');
});

test('verdict: critical 1+ → block', () => {
  const issues = [{ severity: 'critical', summary: 'x', category: 'security' }];
  assert.equal(deriveVerdict(issues), 'block');
});

test('verdict: high 만 → approve_with_fixes', () => {
  const issues = [{ severity: 'high', summary: 'x', category: 'security' }];
  assert.equal(deriveVerdict(issues), 'approve_with_fixes');
});

test('verdict: 비어있으면 approve', () => {
  assert.equal(deriveVerdict([]), 'approve');
});

test('riskLevel: auth path + 5 파일 → critical', () => {
  const r = riskLevel(['src/auth/jwt.ts', 'a', 'b', 'c', 'd', 'e'], 'JWT 추가');
  assert.equal(r, 'critical');
});

test('riskLevel: 일반 path 1 파일 → low', () => {
  assert.equal(riskLevel(['src/utils/format.ts'], '포맷 함수'), 'low');
});

test('severityCounts 합산', () => {
  const issues = [
    { severity: 'critical', summary: 'a', category: 'security' },
    { severity: 'high',     summary: 'b', category: 'correctness' },
    { severity: 'high',     summary: 'c', category: 'correctness' },
    { severity: 'low',      summary: 'd', category: 'docs' },
  ];
  const c = severityCounts(issues);
  assert.deepEqual(c, { critical: 1, high: 2, medium: 0, low: 1, info: 0 });
});

test('verdict: high > 5 → block (다수 high 안전망)', () => {
  const issues = Array.from({ length: 6 }, (_, i) => ({ severity: 'high', summary: `h${i}`, category: 'correctness' }));
  assert.equal(deriveVerdict(issues), 'block');
});

test('verdict: high 5 이하 → approve_with_fixes (한도 내)', () => {
  const issues = Array.from({ length: 5 }, (_, i) => ({ severity: 'high', summary: `h${i}`, category: 'correctness' }));
  assert.equal(deriveVerdict(issues), 'approve_with_fixes');
});

test('verdict: confidence < 0.6 → block (codex 모호 응답)', () => {
  assert.equal(deriveVerdict([], { confidence: 0.5 }), 'block');
});

test('verdict: confidence >= 0.6 + 이슈 없음 → approve', () => {
  assert.equal(deriveVerdict([], { confidence: 0.8 }), 'approve');
});

test('verdict: blast_radius >= 10 + 이슈 1+ → approve_with_fixes (큰 변경 강등)', () => {
  const issues = [{ severity: 'low', summary: 'x', category: 'docs' }];
  assert.equal(deriveVerdict(issues, { blastRadius: 12 }), 'approve_with_fixes');
});

test('verdict: blast_radius >= 10 + 이슈 없음 → approve (issue 없으면 강등 안 함)', () => {
  assert.equal(deriveVerdict([], { blastRadius: 15 }), 'approve');
});

test('verdict: 후방 호환 — opts 미전달 시 기존 동작 유지', () => {
  // opts 없는 호출 → 기존 룰만 적용 (high > 5 트리거 안 함, confidence 무시)
  const issues = Array.from({ length: 6 }, (_, i) => ({ severity: 'high', summary: `h${i}`, category: 'correctness' }));
  // 기존 동작: high 6개여도 critical 0 이면 fixes 였음. 새 룰에선 6 > 5 라 block.
  // 즉 opts 없어도 새 룰 적용됨. 후방 호환은 opts.confidence/blastRadius 미전달이면
  // 그 부분만 비활성. 본 테스트는 high 한도가 opts 와 무관함을 명시.
  assert.equal(deriveVerdict(issues), 'block', 'high > 5 룰은 opts 없이도 트리거');
  // confidence/blastRadius 룰은 opts 필요
  assert.equal(deriveVerdict([{ severity: 'low', summary: 'x', category: 'docs' }]), 'approve', 'low 만 + opts 없음 → approve');
});
