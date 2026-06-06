import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFileContent } from '@ps-neko/nekowork/scripts/lib/rules/hardcoded-credential.js';

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
