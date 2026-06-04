import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '../../scripts/demo-tamper.js');

test('demo:tamper — 기록을 위조해도 재실행하면 BLOCK 유지(결정성), 정상 종료', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--cleanup', '--json'], {
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  assert.equal(r.status, 0, `데모는 exit 0 이어야 함\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`);

  const out = r.stdout;
  assert.match(out, /1막/, '1막 섹션이 출력되어야 함');
  assert.match(out, /3막/, '3막 섹션이 출력되어야 함');

  // verdict 카드(printVerifyPrSummary)의 BLOCK 이 최소 2번(1막·3막) 나와야 함.
  // (JSON 요약의 "verdict":"BLOCK" 은 콜론 앞에 따옴표가 있어 이 패턴과 매칭되지 않음)
  const blockCards = out.match(/verdict\s+:\s+BLOCK/g) || [];
  assert.ok(blockCards.length >= 2, `BLOCK verdict 카드가 1막·3막 최소 2번 나와야 함, got ${blockCards.length}`);

  // 재실행 결과가 기록이 아니라 재계산에서 옴을 JSON 요약으로 확인
  assert.match(out, /"act3":\{"verdict":"BLOCK","exitCode":2\}/, '3막 재실행이 BLOCK/exit2 여야 함');

  // 격리 sandbox 가 정리되었음
  assert.match(out, /sandbox removed/, '--cleanup 시 sandbox 가 제거되어야 함');
});
