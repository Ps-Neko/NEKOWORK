import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paint, nextBlock, isColorEnabled } from '../../scripts/lib/ui-format.js';

test('paint wraps text with ANSI when color enabled', () => {
  const out = paint('ok', 'OK', { force: true });
  assert.match(out, /\[/);
  assert.ok(out.includes('OK'));
});

test('paint returns plain text when NO_COLOR set', () => {
  const out = paint('ok', 'OK', { noColor: true });
  assert.equal(out, 'OK');
});

test('isColorEnabled respects NO_COLOR env', () => {
  assert.equal(isColorEnabled({ env: { NO_COLOR: '1' }, isTTY: true }), false);
  assert.equal(isColorEnabled({ env: {}, isTTY: false }), false);
  assert.equal(isColorEnabled({ env: {}, isTTY: true }), true);
});

test('nextBlock renders Next arrow with items', () => {
  const out = nextBlock([
    { cmd: 'nekowork verify --session a3f7', note: 'Codex 검증' },
    { cmd: 'nekowork report --session a3f7', note: 'evidence 미리 보기' },
  ], { force: false, noColor: true });
  assert.match(out, /Next/);
  assert.match(out, /nekowork verify/);
  assert.match(out, /Codex 검증/);
});
