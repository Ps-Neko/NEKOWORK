// 실 OS keychain 종단 검증. 기본 npm test 에서 실행되지 않음 (tests/optional/ 은 패턴에 미포함).
// 수동 실행: HARNESS_KEYCHAIN_SMOKE=1 npm run test:keychain
// 또는 직접: HARNESS_KEYCHAIN_SMOKE=1 node --test tests/optional/keychain-smoke.test.js

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

const SMOKE = process.env.HARNESS_KEYCHAIN_SMOKE === '1';

test('keychain: set / get / remove 사이클 (실 OS keychain)', { skip: !SMOKE }, async () => {
  delete process.env.HARNESS_KEYCHAIN_DISABLED;
  const k = await import('../../scripts/lib/keychain.js');

  const available = await k.isAvailable();
  if (!available) {
    assert.fail('keychain 미가용. 실행 환경에 OS keychain 이 있어야 합니다.');
  }

  const account = '__harness_smoke__';
  await k.set(account, 'hello-keychain');
  const v = await k.get(account);
  assert.equal(v, 'hello-keychain');

  const removed = await k.remove(account);
  assert.equal(removed, true);

  // 삭제 후 동작
  assert.equal(await k.get(account), null);
  assert.equal(await k.remove(account), false);
});
