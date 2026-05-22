import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderError, renderBlocked } from '../../scripts/lib/ui-errors.js';

test('renderError emits symbol + message + examples + helpRef', () => {
  const out = renderError({
    message: 'task 인수가 필요합니다.',
    examples: ['nekowork work "BOM 단가 추가"'],
    helpRef: 'nekowork help work',
  }, { noColor: true });
  assert.match(out, /✗.*task 인수/);
  assert.match(out, /예시:/);
  assert.match(out, /nekowork work "BOM 단가 추가"/);
  assert.match(out, /도움말: nekowork help work/);
});

test('renderBlocked emits 3-section block', () => {
  const out = renderBlocked({
    message: 'HUMAN_GATE 가 열려 있어 ship 이 막힘.',
    fields: [['세션', 'p2c-b2-fullcycle'], ['사유', 'codex flagged edge case']],
    nextSteps: [
      { cmd: 'nekowork gate status --session p2c-b2', note: '상세 컨텍스트' },
      { cmd: 'nekowork gate approve --session p2c-b2 --reason "..."' },
    ],
  }, { noColor: true });
  assert.match(out, /⚠.*HUMAN_GATE/);
  assert.match(out, /세션.*p2c-b2-fullcycle/);
  assert.match(out, /사유.*codex flagged/);
  assert.match(out, /해결 방법 →/);
  assert.match(out, /gate approve/);
});

test('renderError handles missing examples and helpRef', () => {
  const out = renderError({
    message: '오류가 발생했습니다.',
  }, { noColor: true });
  assert.match(out, /✗.*오류가 발생/);
  assert.doesNotMatch(out, /예시:/);
  assert.doesNotMatch(out, /도움말:/);
});

test('renderBlocked handles missing fields and nextSteps', () => {
  const out = renderBlocked({
    message: '처리가 진행 중입니다.',
  }, { noColor: true });
  assert.match(out, /⚠.*처리가 진행/);
  assert.doesNotMatch(out, /해결 방법/);
});
