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
