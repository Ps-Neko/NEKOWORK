import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paint, nextBlock, isColorEnabled, kvBlock } from '../../scripts/lib/ui-format.js';

test('paint wraps text with ANSI when color enabled', () => {
  const out = paint('ok', 'OK', { force: true });
  assert.ok(out.includes('\x1b[32m'));  // green tone for 'ok'
  assert.ok(out.includes('\x1b[0m'));   // reset
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

test('kvBlock pads keys to max width and joins rows', () => {
  const out = kvBlock([
    ['session', 'work-2026-05-13-a3f7'],
    ['diff', '(none)'],
  ], { noColor: true });
  const lines = out.split('\n');
  assert.equal(lines.length, 2);
  // keys padded to width=7 ("session"), then two-space gap, then value
  assert.match(lines[0], /^ {2}session {2}work-2026-05-13-a3f7$/);
  assert.match(lines[1], /^ {2}diff {5}\(none\)$/);  // 'diff' padded to 7 chars = 'diff   '
});

test('kvBlock paints keys with dim tone when color forced', () => {
  const out = kvBlock([['k', 'v']], { force: true });
  // dim tone is `\x1b[90m`
  assert.ok(out.includes('\x1b[90m'));
  assert.ok(out.includes('v'));
});
