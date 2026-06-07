import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanFileContent } from '../../scripts/lib/rules/insecure-tls.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'insecure-tls');

test('rejectUnauthorized: false → high', () => {
  const f = scanFileContent('x.js', 'new https.Agent({ rejectUnauthorized: false });');
  assert.equal(f[0].pattern, 'reject-unauthorized-false');
  assert.equal(f[0].severity, 'high');
});

test('NODE_TLS_REJECT_UNAUTHORIZED = "0" → high', () => {
  const f = scanFileContent('x.js', 'process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";');
  assert.equal(f[0].pattern, 'node-tls-reject-env');
});

test('verify=False (python) → high', () => {
  const f = scanFileContent('x.py', 'requests.get(url, verify=False)');
  assert.equal(f[0].pattern, 'python-verify-false');
});

test('InsecureSkipVerify: true (go) → high', () => {
  const f = scanFileContent('x.go', 'tls.Config{InsecureSkipVerify: true}');
  assert.equal(f[0].pattern, 'go-insecure-skip-verify');
});

test('rejectUnauthorized: true → not flagged', () => {
  const f = scanFileContent('x.js', 'new https.Agent({ rejectUnauthorized: true });');
  assert.equal(f.length, 0);
});

test('verify=True → not flagged', () => {
  const f = scanFileContent('x.py', 'requests.get(url, verify=True)');
  assert.equal(f.length, 0);
});

test('fixture manifest: recall + FP gate', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, 'manifest.json'), 'utf8'));
  let posCaught = 0, posTotal = 0, fp = 0, negTotal = 0;
  const missed = [];
  for (const e of manifest.entries) {
    const content = fs.readFileSync(path.join(FIXTURE_ROOT, e.file), 'utf8');
    const findings = scanFileContent(e.file, content);
    if (e.label === 'positive') {
      posTotal++;
      if (findings.length > 0) posCaught++; else missed.push(e.id);
    } else {
      negTotal++;
      if (findings.length > 0) fp++;
    }
  }
  const recall = posCaught / posTotal;
  assert.ok(recall >= 0.95, `recall ${recall.toFixed(2)} below 0.95; missed: ${missed.join(', ')}`);
  assert.ok(fp / negTotal <= 0.10, `FP rate above 0.10`);
});

// ---------- R2-8: curl -k / wget --no-check-certificate ----------

test('curl -k: high', () => {
  assert.ok(scanFileContent('x.sh', 'curl -k https://x.com').some(t => t.pattern === 'curl-insecure' && t.severity === 'high'));
});

test('curl --insecure mid-command: high', () => {
  assert.ok(scanFileContent('x.sh', 'curl -sSL --insecure https://x.com').some(t => t.pattern === 'curl-insecure'));
});

test('wget --no-check-certificate: high', () => {
  assert.ok(scanFileContent('x.sh', 'wget --no-check-certificate https://x.com').some(t => t.pattern === 'wget-no-check-certificate'));
});

test('curl --cacert / plain wget: not flagged (R2-8 FP guard)', () => {
  assert.equal(scanFileContent('x.sh', 'curl --cacert ca.pem https://x.com').length, 0);
  assert.equal(scanFileContent('x.sh', 'wget https://x.com').length, 0);
});
