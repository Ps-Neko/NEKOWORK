import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanFileContent,
  scanAddedLines,
  scanDiff,
} from '@ps-neko/nekowork/scripts/lib/rules/secret-fallback.js';
import { parseDiff } from '@ps-neko/nekowork/scripts/lib/diff-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'secret-fallback');

// ---------- direct API tests (inline strings) ----------

test('env-or-literal: critical', () => {
  const f = scanFileContent('x.ts', 'const k = process.env.API_KEY || "sk-test-fallback";');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'critical');
  assert.equal(f[0].pattern, 'env-or-literal');
  assert.equal(f[0].blocks_apply, true);
});

test('nullish ??: critical', () => {
  const f = scanFileContent('x.ts', 'const k = process.env.OPENAI_API_KEY ?? "sk-default";');
  assert.equal(f.length, 1);
  assert.equal(f[0].pattern, 'nullish-fallback');
});

test('port fallback (3000): not flagged', () => {
  const f = scanFileContent('x.ts', 'const port = process.env.PORT || 3000;');
  assert.equal(f.length, 0);
});

test('hostname fallback "localhost": not flagged', () => {
  const f = scanFileContent('x.ts', 'const host = process.env.REDIS_HOST || "localhost";');
  assert.equal(f.length, 0);
});

test('comment-only mention: not flagged', () => {
  const content = `// const key = process.env.API_KEY || "literal";\nconst key = process.env.API_KEY;`;
  const f = scanFileContent('x.ts', content);
  assert.equal(f.length, 0);
});

test('block comment with pattern: not flagged', () => {
  const content = `/* example: const k = process.env.API_KEY || "x"; */\nconst k = process.env.API_KEY;`;
  const f = scanFileContent('x.ts', content);
  assert.equal(f.length, 0);
});

test('finding 의 line 은 1-based', () => {
  const content = `// line 1 comment\nconst k = process.env.API_KEY || "sk-fallback-test";`;
  const f = scanFileContent('x.ts', content);
  assert.equal(f.length, 1);
  assert.equal(f[0].line, 2);
});

test('scanAddedLines: 연속된 추가 라인이 multi-line OR 로 매치', () => {
  const added = [
    { path: 'x.ts', line: 10, content: 'return (' },
    { path: 'x.ts', line: 11, content: '  process.env.KEY_A ||' },
    { path: 'x.ts', line: 12, content: '  process.env.KEY_B ||' },
    { path: 'x.ts', line: 13, content: '  "fallback-secret-value"' },
    { path: 'x.ts', line: 14, content: ');' },
  ];
  const f = scanAddedLines(added);
  assert.ok(f.length >= 1);
  assert.equal(f[0].severity, 'critical');
});

test('scanDiff: parseDiff 출력으로 직접 동작', () => {
  const diff = `diff --git a/src/auth.ts b/src/auth.ts
index 1111111..2222222 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -40,3 +40,4 @@
   if (process.env.API_KEY) {
     return process.env.API_KEY;
   }
+  return process.env.API_KEY || "sk-leaked-fallback-value";
 }
`;
  const parsed = parseDiff(diff);
  const f = scanDiff(parsed);
  assert.equal(f.length, 1);
  assert.equal(f[0].file, 'src/auth.ts');
  assert.equal(f[0].line, 43);
  assert.equal(f[0].severity, 'critical');
});

// ---------- fixture manifest: recall / FP measurement ----------

test('fixture manifest: positive recall + negative FP gate', () => {
  const manifestPath = path.join(FIXTURE_ROOT, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  let positiveCaught = 0;
  let positiveTotal = 0;
  let negativeFalsePositives = 0;
  let negativeTotal = 0;
  const missed = [];
  const falsePositives = [];

  for (const entry of manifest.entries) {
    const filePath = path.join(FIXTURE_ROOT, entry.file);
    const content = fs.readFileSync(filePath, 'utf8');
    const findings = scanFileContent(entry.file, content);

    if (entry.label === 'positive') {
      positiveTotal++;
      if (findings.length > 0) positiveCaught++;
      else missed.push(entry.id);
    } else {
      negativeTotal++;
      if (findings.length > 0) {
        negativeFalsePositives++;
        falsePositives.push({ id: entry.id, findings: findings.map(f => ({ pattern: f.pattern, line: f.line, match: f.match })) });
      }
    }
  }

  const recall = positiveCaught / positiveTotal;
  const fpRate = negativeFalsePositives / negativeTotal;

  // Sanity baseline for synthetic seed. Real 1.0 gate (recall >= 0.90,
  // FP <= 0.10) applies after OSS curation and live-AI fixtures are added.
  // For the synthetic seed we expect:
  //   - recall >= 0.70 (some patterns like if-not-fallback are known gaps)
  //   - FP rate <= 0.20 (allow modest noise on the small synthetic neg set)
  assert.ok(recall >= 0.70, `recall ${recall.toFixed(2)} below 0.70 baseline; missed: ${missed.join(', ')}`);
  assert.ok(fpRate <= 0.20, `FP rate ${fpRate.toFixed(2)} above 0.20 baseline; FPs: ${JSON.stringify(falsePositives)}`);

  // Surface the actual numbers for visibility.
  console.log(`[secret-fallback] synthetic seed: recall=${(recall * 100).toFixed(0)}% (${positiveCaught}/${positiveTotal}), FP=${(fpRate * 100).toFixed(0)}% (${negativeFalsePositives}/${negativeTotal})`);
  if (missed.length) console.log(`[secret-fallback] missed: ${missed.join(', ')}`);
  if (falsePositives.length) console.log(`[secret-fallback] false positives: ${falsePositives.map(fp => fp.id).join(', ')}`);
});

test('finding 출력 스키마: 필수 필드', () => {
  const f = scanFileContent('x.ts', 'const k = process.env.API_KEY || "sk-fallback";');
  assert.equal(f.length, 1);
  const finding = f[0];
  for (const key of ['id', 'rule', 'pattern', 'severity', 'category', 'file', 'line', 'title', 'description', 'recommendation', 'blocks_apply']) {
    assert.ok(key in finding, `missing field: ${key}`);
  }
  assert.equal(finding.rule, 'secret-fallback');
  assert.equal(finding.category, 'secrets');
});

// ---------- URL scheme // false-negative regression ----------

test('URL scheme https:// 이 같은 라인의 secret fallback 을 가리지 않음 (false negative 방지)', () => {
  // Bug: stripCommentsPreservingOffsets 가 "https://" 의 "//" 를 줄 댓글로 오인해
  // 같은 줄 뒤쪽을 모두 지워 secret fallback 을 놓침.
  const content = 'const apiUrl = process.env.API_URL || "https://default.api.example.com/v1"; const secret = process.env.API_KEY || "hardcoded_secret_key_value";';
  const f = scanFileContent('config.ts', content);
  assert.ok(f.length >= 1, `URL 포함 라인 뒤의 secret fallback 을 감지해야 함 (got ${f.length} findings)`);
  const patterns = f.map(x => x.pattern);
  assert.ok(patterns.includes('env-or-literal'), `env-or-literal 패턴이 감지되어야 함 (got: ${patterns.join(', ')})`);
});

test('URL scheme https:// 포함 줄 다음 줄의 secret fallback 도 감지', () => {
  // 두 번째 케이스: URL 이 포함된 줄과 secret 이 포함된 줄이 별개여도 작동해야 함.
  const content = [
    'const baseUrl = "https://api.example.com/endpoint";',
    'const jwtSecret = process.env.JWT_SECRET || "fallback-jwt-secret-value";',
  ].join('\n');
  const f = scanFileContent('config.ts', content);
  assert.ok(f.length >= 1, `URL 다음 줄의 secret fallback 을 감지해야 함 (got ${f.length})`);
  assert.equal(f[0].line, 2, `line 은 2여야 함 (got ${f[0].line})`);
});
