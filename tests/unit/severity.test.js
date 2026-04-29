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
