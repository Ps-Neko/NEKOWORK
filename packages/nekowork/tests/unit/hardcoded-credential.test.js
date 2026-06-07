import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFileContent } from '../../scripts/lib/rules/hardcoded-credential.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'hardcoded-credential');

test('AWS access key id: critical', () => {
  const f = scanFileContent('x.ts', 'const k = "AKIAIOSFODNN7EXAMPLE";');
  assert.equal(f[0].pattern, 'aws-access-key-id');
  assert.equal(f[0].severity, 'critical');
});

test('Stripe sk_live: critical', () => {
  // Assemble the test string at runtime to avoid tripping push-protection
  // scanners that pattern-match `sk_live_<alnum>{20+}` in source.
  const fake = ['sk', 'live', 'NEKOWORKfixtureFAKEnotREAL00'].join('_');
  const f = scanFileContent('x.ts', `const k = "${fake}";`);
  assert.equal(f[0].pattern, 'stripe-secret-key');
});

test('GitHub PAT: critical', () => {
  const f = scanFileContent('x.ts', 'const t = "ghp_abcdefghijklmnopqrstuvwxyz012345ABCD";');
  assert.equal(f[0].pattern, 'github-personal-access-token');
});

test('Slack token: critical', () => {
  // Split prefix so source text doesn't carry the full `xoxb-<...>` shape.
  const prefix = 'xo' + 'xb-';
  const f = scanFileContent('x.ts', `const t = "${prefix}NEKO-FIXTURE-NOT-A-REAL-TOKEN";`);
  assert.equal(f[0].pattern, 'slack-token');
});

test('Google API key: critical', () => {
  const f = scanFileContent('x.ts', 'const k = "AIza0123456789012345678901234567890abcd";');
  assert.equal(f[0].pattern, 'google-api-key');
});

test('PEM private key: critical', () => {
  const content = '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----';
  const f = scanFileContent('id_rsa', content);
  assert.equal(f[0].pattern, 'private-key-pem');
});

test('PEM public key: not flagged', () => {
  const content = '-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----';
  const f = scanFileContent('id_rsa.pub', content);
  assert.equal(f.length, 0);
});

test('sk- placeholder ("sk-dev-example"): filter blocks', () => {
  const f = scanFileContent('x.ts', 'const p = "sk-dev-example-replace";');
  assert.equal(f.length, 0);
});

test('sk-leaked-fallback: filter blocks (placeholder)', () => {
  const f = scanFileContent('x.ts', 'const p = "sk-leaked-fallback-secret";');
  assert.equal(f.length, 0);
});

test('pk_test_ stripe: not flagged (only sk_live/sk_test/pk_live)', () => {
  const f = scanFileContent('x.ts', 'const p = "pk_test_TYooMQauvdEDq54NiTphI7jx";');
  assert.equal(f.length, 0);
});

test('주석 안 AKIA 는 무시', () => {
  const f = scanFileContent('x.ts', '// example: AKIAIOSFODNN7EXAMPLE\nconst k = "ok";\n');
  assert.equal(f.length, 0);
});

test('SendGrid SG. key: critical', () => {
  const body = 'SG.' + 'a'.repeat(0) + 'lCJCvaStuvd1yXBdXYn3Ew' + '.' + 'UQK1K3Mc3KEurFbbqNqSR9HtsFFBhLR5Dzxl2sMp770';
  const f = scanFileContent('x.ts', `const k = "${body}";`);
  assert.equal(f[0].pattern, 'sendgrid-api-key');
});

test('npm token: critical', () => {
  const f = scanFileContent('x.ts', 'const t = "npm_pbqDrlW2lSxN0pv0aQrqPw2zh3Yg37UvWYw3";');
  assert.equal(f[0].pattern, 'npm-access-token');
});

test('Mailgun key: critical', () => {
  // R2-4: the Mailgun signature is now context-gated — a bare `key-<32hex>`
  // matches too many generic slugs, so a mailgun/mg marker is required.
  const f = scanFileContent('x.ts', 'const MAILGUN_KEY = "key-56924ec30c0390a8a72745ac903e8493";');
  assert.ok(f.some(x => x.pattern === 'mailgun-api-key'));
});

test('Docker Hub PAT: critical', () => {
  const f = scanFileContent('x.ts', 'const t = "dckr_pat_ng0TpaoazuyWWcuuK8l4BYyUMNfW";');
  assert.equal(f[0].pattern, 'dockerhub-pat');
});

test('base64-encoded AWS key (Buffer.from): critical', () => {
  // base64 of: const x = "AKIAIOSFODNN7EXAMPLE"
  const b64 = 'Y29uc3QgeCA9ICJBS0lBSU9TRk9ETk43RVhBTVBMRSI=';
  const f = scanFileContent('x.ts', `const v = Buffer.from("${b64}", "base64").toString();`);
  assert.ok(f.some(x => x.pattern === 'base64-encoded-credential'));
});

test('base64 of benign text: not flagged as credential', () => {
  const b64 = Buffer.from('hello world this is fine').toString('base64');
  const f = scanFileContent('x.ts', `const v = Buffer.from("${b64}", "base64").toString();`);
  assert.equal(f.filter(x => x.pattern === 'base64-encoded-credential').length, 0);
});

test('Supabase service_role JWT: critical', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2MDAwMDAwMDB9.abcdefghijklmnop1234567890ABCDEF';
  const f = scanFileContent('x.ts', `const k = "${jwt}";`);
  assert.ok(f.some(x => x.pattern === 'supabase-service-role-jwt' && x.severity === 'critical'));
});

test('Supabase anon JWT: not critical (high JWT only)', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwfQ.abcdefghijklmnop1234567890ABCDEF';
  const f = scanFileContent('x.ts', `const k = "${jwt}";`);
  assert.equal(f.filter(x => x.severity === 'critical').length, 0);
});

test('sk- placeholder words (placeholder/sample/dummy/mock/your/todo): filtered', () => {
  for (const w of ['placeholder', 'sample', 'dummy', 'mock', 'your', 'todo']) {
    const f = scanFileContent('x.ts', `const p = "sk-${w}-not-a-real-key-here";`);
    assert.equal(f.length, 0, `sk-${w} should be filtered`);
  }
});

test('sk- near-zero-entropy body: filtered', () => {
  const f = scanFileContent('x.ts', 'const p = "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx";');
  assert.equal(f.length, 0);
});

test('fixture manifest: recall + FP gate', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, 'manifest.json'), 'utf8'));
  let posCaught = 0, posTotal = 0, criticalFp = 0, negTotal = 0;
  const missed = [], fps = [];
  for (const e of manifest.entries) {
    const content = fs.readFileSync(path.join(FIXTURE_ROOT, e.file), 'utf8');
    const findings = scanFileContent(e.file, content);
    if (e.label === 'positive') {
      posTotal++;
      if (findings.length > 0) posCaught++;
      else missed.push(e.id);
    } else {
      negTotal++;
      const cr = findings.filter(f => f.severity === 'critical');
      if (cr.length > 0) {
        criticalFp++;
        fps.push({ id: e.id, pattern: cr[0].pattern });
      }
    }
  }
  const recall = posCaught / posTotal;
  const fpRate = criticalFp / negTotal;
  assert.ok(recall >= 0.90, `recall ${recall.toFixed(2)} below 0.90; missed: ${missed.join(', ')}`);
  assert.ok(fpRate <= 0.10, `CRITICAL FP rate ${fpRate.toFixed(2)} above 0.10; FPs: ${JSON.stringify(fps)}`);
  console.log(`[hardcoded-credential] synthetic seed: recall=${(recall * 100).toFixed(0)}% (${posCaught}/${posTotal}), CRITICAL FP=${(fpRate * 100).toFixed(0)}% (${criticalFp}/${negTotal})`);
});

// ---------- R2-4: Mailgun context gate ----------

test('Mailgun key with mailgun marker: critical', () => {
  const f = scanFileContent('x.js', 'const mailgunKey = "key-0123456789abcdef0123456789abcdef";');
  assert.ok(f.some(x => x.pattern === 'mailgun-api-key' && x.severity === 'critical'));
});

test('Mailgun key via MAILGUN_API_KEY field: critical', () => {
  const f = scanFileContent('x.js', 'MAILGUN_API_KEY = "key-0123456789abcdef0123456789abcdef"');
  assert.ok(f.some(x => x.pattern === 'mailgun-api-key'));
});

test('generic key-<32hex> without mailgun marker: not flagged as mailgun', () => {
  const f = scanFileContent('x.js', 'const cacheKey = "key-0123456789abcdef0123456789abcdef";');
  assert.ok(!f.some(x => x.pattern === 'mailgun-api-key'), `generic key- slug must not match mailgun: ${JSON.stringify(f)}`);
});

test('"monkey" identifier does not trigger mailgun gate', () => {
  const f = scanFileContent('x.js', 'const monkey = "key-aaaaaaaabbbbbbbbccccccccdddddddd";');
  assert.ok(!f.some(x => x.pattern === 'mailgun-api-key'));
});
