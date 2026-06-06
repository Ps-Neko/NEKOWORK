import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-vault-'));
process.env.HARNESS_HOME = TMP;
process.env.HARNESS_KEYCHAIN_DISABLED = '1';   // unit 은 keychain off 강제, 실 keychain 은 optional smoke

const { save, load, remove, list, backend, redact, audit } = await import('../../scripts/lib/token-vault.js');

test('encrypted-file: save → load round-trip', async () => {
  process.env.HARNESS_TOKEN_STORE_KIND = 'encrypted-file';
  const file = await save('p1', { access_token: 'sec123', scope: 'repo' });
  assert.match(String(file), /p1\.json$/);
  const back = await load('p1');
  assert.equal(back.access_token, 'sec123');
  assert.equal(back.scope, 'repo');
  assert.ok(back.saved_at);
});

test('encrypted-file: 없는 provider 는 null', async () => {
  process.env.HARNESS_TOKEN_STORE_KIND = 'encrypted-file';
  assert.equal(await load('nope'), null);
});

test('encrypted-file: remove 두 번 → true / false', async () => {
  process.env.HARNESS_TOKEN_STORE_KIND = 'encrypted-file';
  await save('p2', { access_token: 'x' });
  assert.equal(await remove('p2'), true);
  assert.equal(await remove('p2'), false);
});

test('encrypted-file: list 는 saved provider 포함', async () => {
  process.env.HARNESS_TOKEN_STORE_KIND = 'encrypted-file';
  await save('p3', { access_token: 'x' });
  await save('p4', { access_token: 'y' });
  const ls = await list();
  assert.ok(ls.includes('p3'));
  assert.ok(ls.includes('p4'));
});

test('auto + keychain disabled → file fallback', async () => {
  process.env.HARNESS_TOKEN_STORE_KIND = 'auto';
  assert.equal(await backend(), 'file');
});

test('os-keychain 강제 + keychain disabled → throw', async () => {
  process.env.HARNESS_TOKEN_STORE_KIND = 'os-keychain';
  await assert.rejects(() => backend(), /keychain 가용 불가/);
});

test('redact: GitHub gho_ 토큰 마스킹', () => {
  assert.equal(redact('gho_' + 'a'.repeat(40)), '***REDACTED-GH***');
});

test('redact: 짧은 문자열은 그대로', () => {
  assert.equal(redact('hello'), 'hello');
});

// ── 신규 regression: 낮춰진 임계값 + 공급자 패턴 ──

test('redact: 32자 순수 알파뉴메릭 키는 마스킹됨 (임계값 20으로 하향)', () => {
  const key32 = 'a'.repeat(32);
  assert.equal(redact(key32), '***REDACTED***');
});

test('redact: 19자 문자열은 catch-all 에 해당 안 됨 (over-redact 방지)', () => {
  const s = 'a'.repeat(19);
  assert.equal(redact(s), s);
});

test('redact: Anthropic sk-ant- 키 마스킹됨', () => {
  const antKey = 'sk-ant-api03-' + 'A'.repeat(20);
  assert.ok(redact(antKey).includes('***REDACTED-ANT***'), `expected ANT redaction but got: ${redact(antKey)}`);
});

test('redact: Stripe sk_live_ 키 마스킹됨', () => {
  const stripeKey = 'sk_live_' + 'B'.repeat(24);
  assert.ok(redact(stripeKey).includes('***REDACTED-STRIPE***'), `expected STRIPE redaction but got: ${redact(stripeKey)}`);
});

test('redact: Stripe sk_test_ 키 마스킹됨', () => {
  const stripeTestKey = 'sk_test_' + 'C'.repeat(24);
  assert.ok(redact(stripeTestKey).includes('***REDACTED-STRIPE***'), `expected STRIPE redaction but got: ${redact(stripeTestKey)}`);
});

test('redact: OpenAI sk- 키 마스킹됨', () => {
  const openaiKey = 'sk-' + 'D'.repeat(48);
  assert.ok(redact(openaiKey).includes('***REDACTED-OPENAI***') || redact(openaiKey).includes('***REDACTED***'), `expected OPENAI/generic redaction but got: ${redact(openaiKey)}`);
});

test('redact: 일반 짧은 단어는 마스킹 안 됨', () => {
  assert.equal(redact('normalword'), 'normalword');
  assert.equal(redact('short'), 'short');
});

test('audit: access_token / token 키 자동 redact, 다른 키는 보존', () => {
  process.env.HARNESS_TOKEN_STORE_KIND = 'encrypted-file';
  audit('test.event', { access_token: 'sec', token: 'tk', other: 'visible' });
  const auditDir = path.join(TMP, 'audit');
  const files = fs.readdirSync(auditDir).filter((f) => f.endsWith('.jsonl'));
  assert.ok(files.length >= 1);
  const last = fs.readFileSync(path.join(auditDir, files[0]), 'utf8').trim().split('\n').pop();
  const obj = JSON.parse(last);
  assert.equal(obj.access_token, '***REDACTED***');
  assert.equal(obj.token, '***REDACTED***');
  assert.equal(obj.other, 'visible');
});
