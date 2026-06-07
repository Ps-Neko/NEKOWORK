// severity: classifyCategory / classifySeverity / riskLevel / severityCounts / deriveVerdict
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  classifyCategory,
  classifySeverity,
  riskLevel,
  severityCounts,
  deriveVerdict,
} from '../../scripts/lib/severity.js';

// ---------------------------------------------------------------------------
// classifyCategory
// ---------------------------------------------------------------------------

test('classifyCategory: explicit category wins over heuristics', () => {
  assert.equal(classifyCategory({ category: 'custom', summary: 'sql injection in auth' }), 'custom');
});

test('classifyCategory: security keywords route to security', () => {
  assert.equal(classifyCategory({ summary: 'JWT secret leaked' }), 'security');
  assert.equal(classifyCategory({ summary: '', why: 'possible sql injection' }), 'security');
});

test('classifyCategory: correctness keywords route to correctness', () => {
  assert.equal(classifyCategory({ summary: 'off by one in loop boundary' }), 'correctness');
  assert.equal(classifyCategory({ summary: 'null dereference' }), 'correctness');
});

test('classifyCategory: performance keywords route to performance', () => {
  assert.equal(classifyCategory({ summary: 'n+1 query slows the page' }), 'performance');
  assert.equal(classifyCategory({ summary: 'high latency under load' }), 'performance');
});

test('classifyCategory: test keywords route to test', () => {
  assert.equal(classifyCategory({ summary: 'missing assert in coverage' }), 'test');
});

test('classifyCategory: docs keywords route to docs', () => {
  assert.equal(classifyCategory({ summary: 'update the readme changelog' }), 'docs');
});

test('classifyCategory: no signal falls back to style', () => {
  assert.equal(classifyCategory({ summary: 'rename a variable for clarity' }), 'style');
  assert.equal(classifyCategory({}), 'style');
});

// ---------------------------------------------------------------------------
// classifySeverity
// ---------------------------------------------------------------------------

test('classifySeverity: explicit severity wins', () => {
  assert.equal(classifySeverity({ severity: 'low', summary: 'sql injection bypass leak' }), 'low');
});

test('classifySeverity: security + dangerous keyword is critical', () => {
  assert.equal(classifySeverity({ summary: 'auth bypass via crafted token' }), 'critical');
  assert.equal(classifySeverity({ summary: 'secret exposure in logs' }), 'critical');
  // category must resolve to security (auth) AND carry a dangerous keyword (deserializ).
  assert.equal(classifySeverity({ summary: 'auth flaw', why: 'unsafe deserialize of jwt' }), 'critical');
});

test('classifySeverity: plain security is high', () => {
  assert.equal(classifySeverity({ summary: 'password stored without hashing' }), 'high');
});

test('classifySeverity: correctness + race/crash keyword is high', () => {
  assert.equal(classifySeverity({ summary: 'race condition deadlock', why: 'race' }), 'high');
  assert.equal(classifySeverity({ summary: 'null deref causes crash' }), 'high');
});

test('classifySeverity: docs is low', () => {
  assert.equal(classifySeverity({ summary: 'fix typo in readme comment' }), 'low');
});

test('classifySeverity: default is medium', () => {
  assert.equal(classifySeverity({ summary: 'rename a variable' }), 'medium');
  // correctness without race/crash keyword falls through to medium
  assert.equal(classifySeverity({ summary: 'off by one boundary error' }), 'medium');
});

// ---------------------------------------------------------------------------
// riskLevel — ordering and tallies
// ---------------------------------------------------------------------------

test('riskLevel: security path with >= 5 files is critical', () => {
  const files = ['src/auth/login.js', 'a.js', 'b.js', 'c.js', 'd.js'];
  assert.equal(riskLevel(files, 'task'), 'critical');
});

test('riskLevel: security path with < 5 files is high', () => {
  assert.equal(riskLevel(['src/auth/login.js'], 'task'), 'high');
});

test('riskLevel: security keyword in task triggers security even with no files', () => {
  assert.equal(riskLevel([], 'rotate the jwt secret'), 'high');
});

test('riskLevel: non-security with >= 20 files is high', () => {
  const files = Array.from({ length: 20 }, (_, i) => `src/file${i}.js`);
  assert.equal(riskLevel(files, 'refactor'), 'high');
});

test('riskLevel: non-security with >= 5 files is medium', () => {
  const files = ['a.js', 'b.js', 'c.js', 'd.js', 'e.js'];
  assert.equal(riskLevel(files, 'refactor'), 'medium');
});

test('riskLevel: small non-security change is low', () => {
  assert.equal(riskLevel(['src/util.js'], 'tweak'), 'low');
  assert.equal(riskLevel(), 'low');
});

test('riskLevel: ordering precedence — critical > high > medium > low', () => {
  // security + many files outranks the >=20 plain rule
  const sec5 = ['src/auth/x.js', 'a.js', 'b.js', 'c.js', 'd.js'];
  assert.equal(riskLevel(sec5, ''), 'critical');
  // security beats the medium (>=5) threshold
  const sec1plus = ['src/payment/charge.js', 'a.js'];
  assert.equal(riskLevel(sec1plus, ''), 'high');
  // 20 plain beats 5 plain
  assert.equal(riskLevel(Array.from({ length: 20 }, (_, i) => `f${i}.js`), ''), 'high');
});

// ---------------------------------------------------------------------------
// severityCounts — tallies
// ---------------------------------------------------------------------------

test('severityCounts: empty array yields all zeros', () => {
  assert.deepEqual(severityCounts([]), { critical: 0, high: 0, medium: 0, low: 0, info: 0 });
  assert.deepEqual(severityCounts(), { critical: 0, high: 0, medium: 0, low: 0, info: 0 });
});

test('severityCounts: tallies explicit severities', () => {
  const issues = [
    { severity: 'critical' },
    { severity: 'high' },
    { severity: 'high' },
    { severity: 'medium' },
    { severity: 'low' },
    { severity: 'info' },
  ];
  assert.deepEqual(severityCounts(issues), { critical: 1, high: 2, medium: 1, low: 1, info: 1 });
});

test('severityCounts: classifies issues without explicit severity', () => {
  const issues = [
    { summary: 'auth bypass leak' },     // critical
    { summary: 'password not hashed' },  // high (security)
    { summary: 'rename variable' },      // medium (default)
    { summary: 'fix readme typo' },      // low (docs)
  ];
  assert.deepEqual(severityCounts(issues), { critical: 1, high: 1, medium: 1, low: 1, info: 0 });
});

test('severityCounts: unknown severity values are ignored (no key)', () => {
  assert.deepEqual(severityCounts([{ severity: 'bogus' }]), { critical: 0, high: 0, medium: 0, low: 0, info: 0 });
});

// ---------------------------------------------------------------------------
// deriveVerdict — every branch
// ---------------------------------------------------------------------------

test('deriveVerdict: critical > 0 blocks', () => {
  assert.equal(deriveVerdict([{ severity: 'critical' }]), 'block');
});

test('deriveVerdict: high > 5 blocks', () => {
  const issues = Array.from({ length: 6 }, () => ({ severity: 'high' }));
  assert.equal(deriveVerdict(issues), 'block');
});

test('deriveVerdict: confidence < 0.6 blocks even with no findings', () => {
  assert.equal(deriveVerdict([], { confidence: 0.59 }), 'block');
});

test('deriveVerdict: confidence >= 0.6 with no critical/high does not block', () => {
  assert.equal(deriveVerdict([], { confidence: 0.6 }), 'approve');
  assert.equal(deriveVerdict([{ severity: 'medium' }], { confidence: 0.95 }), 'approve_with_fixes');
});

test('deriveVerdict: high in [1,5] is approve_with_fixes', () => {
  assert.equal(deriveVerdict([{ severity: 'high' }]), 'approve_with_fixes');
  const five = Array.from({ length: 5 }, () => ({ severity: 'high' }));
  assert.equal(deriveVerdict(five), 'approve_with_fixes');
});

test('deriveVerdict: medium present is approve_with_fixes', () => {
  assert.equal(deriveVerdict([{ severity: 'medium' }]), 'approve_with_fixes');
});

test('deriveVerdict: large blast radius with any issue downgrades to approve_with_fixes', () => {
  assert.equal(deriveVerdict([{ severity: 'low' }], { blastRadius: 10 }), 'approve_with_fixes');
});

test('deriveVerdict: large blast radius with zero issues stays approve', () => {
  assert.equal(deriveVerdict([], { blastRadius: 50 }), 'approve');
});

test('deriveVerdict: zero issues is approve', () => {
  assert.equal(deriveVerdict([]), 'approve');
  assert.equal(deriveVerdict(), 'approve');
});

test('deriveVerdict: low-only issues with no weights is approve', () => {
  assert.equal(deriveVerdict([{ severity: 'low' }, { severity: 'low' }]), 'approve');
});

test('deriveVerdict: block precedence — critical outranks confidence and high rules', () => {
  // critical present plus low confidence still resolves as block (first rule)
  assert.equal(deriveVerdict([{ severity: 'critical' }], { confidence: 0.1 }), 'block');
});
