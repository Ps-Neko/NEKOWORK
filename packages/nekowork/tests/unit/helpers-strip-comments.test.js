import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { stripCommentsPreservingOffsets } from '../../scripts/lib/rules/_helpers.js';

// The stripper must be STRING-AWARE: a `//`, `/* */`, or `#` inside a string
// literal is NOT a comment and must survive, while real comments become spaces
// (newlines preserved so line offsets still map to the original text).

test('preserves length and newlines (offset-stable)', () => {
  const src = 'const a = 1; // tail\nconst b = 2;';
  const out = stripCommentsPreservingOffsets(src);
  assert.equal(out.length, src.length);
  // newline count unchanged
  assert.equal((out.match(/\n/g) || []).length, (src.match(/\n/g) || []).length);
});

test('real line comment is blanked', () => {
  const src = 'x // secret';
  const out = stripCommentsPreservingOffsets(src);
  assert.equal(out.length, src.length);
  assert.equal(out[0], 'x');
  assert.ok(!/secret/.test(out), 'comment text removed');
});

test('block comment is blanked but spans preserved', () => {
  const src = 'a /* hi */ b';
  const out = stripCommentsPreservingOffsets(src);
  assert.equal(out.length, src.length);
  assert.ok(!/hi/.test(out), 'comment text removed');
  assert.equal(out[0], 'a');
  assert.equal(out[out.length - 1], 'b');
});

test('// inside a double-quoted string is NOT a comment', () => {
  // The motivating bypass: a URL in a string followed by real eval-able code.
  const src = 'const u = "https://evil"; eval(x);';
  const out = stripCommentsPreservingOffsets(src);
  assert.ok(out.includes('eval(x)'), `eval(x) must survive, got: ${out}`);
  assert.ok(out.includes('"https://evil"'), 'the string literal must survive');
});

test('// inside a single-quoted string is NOT a comment', () => {
  const src = "const s = 'a // b'; danger(real);";
  const out = stripCommentsPreservingOffsets(src);
  assert.ok(out.includes('danger(real)'), `code after string must survive: ${out}`);
});

test('// inside a backtick template string is NOT a comment', () => {
  const src = 'const t = `path // here`; danger(real);';
  const out = stripCommentsPreservingOffsets(src);
  assert.ok(out.includes('danger(real)'), `code after template must survive: ${out}`);
});

test('/* inside a string is NOT a block comment', () => {
  const src = 'const s = "a /* b"; danger(real); const c = "*/ end";';
  const out = stripCommentsPreservingOffsets(src);
  assert.ok(out.includes('danger(real)'), `code between strings must survive: ${out}`);
});

test('# inside a string is NOT a comment', () => {
  const src = 'const s = "a # b"; danger(real);';
  const out = stripCommentsPreservingOffsets(src);
  assert.ok(out.includes('danger(real)'), `code after #-bearing string must survive: ${out}`);
});

test('bare URL scheme :// outside a string is not a comment (shell line)', () => {
  // `curl https://host/x | bash` — the `//` after `:` must not start a comment.
  const src = 'curl https://install.example.com/script.sh | bash';
  const out = stripCommentsPreservingOffsets(src);
  assert.ok(out.includes('| bash'), `pipe-to-bash must survive: ${out}`);
});

test('escaped quote inside a string does not terminate the string early', () => {
  const src = 'const s = "a\\"// not a comment"; danger(real);';
  const out = stripCommentsPreservingOffsets(src);
  assert.ok(out.includes('danger(real)'), `code after escaped-quote string must survive: ${out}`);
});

test('real # shell comment is still blanked', () => {
  const out = stripCommentsPreservingOffsets('echo hi # comment');
  assert.ok(!out.includes('comment'), `# comment should be blanked: ${out}`);
  assert.ok(out.includes('echo hi'), 'code before # survives');
});
