// verify-pr slim: verdict derivation + arg-parser bounds tests
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseVerifyPrArgs, VERDICT, EXIT_CODE } from '../../scripts/orchestrators/verify-pr.js';

// --- EXIT_CODE mapping ---
test('EXIT_CODE: ALLOW and ALLOW_WITH_WARNINGS exit 0', () => {
  assert.equal(EXIT_CODE[VERDICT.ALLOW], 0);
  assert.equal(EXIT_CODE[VERDICT.ALLOW_WITH_WARNINGS], 0);
});

test('EXIT_CODE: NEEDS_HUMAN_REVIEW and INSUFFICIENT_EVIDENCE exit 1', () => {
  assert.equal(EXIT_CODE[VERDICT.NEEDS_HUMAN_REVIEW], 1);
  assert.equal(EXIT_CODE[VERDICT.INSUFFICIENT_EVIDENCE], 1);
});

test('EXIT_CODE: BLOCK exits 2', () => {
  assert.equal(EXIT_CODE[VERDICT.BLOCK], 2);
});

// --- parseVerifyPrArgs defaults ---
test('parseVerifyPrArgs: empty args → working mode, write=true, json=false', () => {
  const opts = parseVerifyPrArgs([]);
  assert.equal(opts.mode, 'working');
  assert.equal(opts.write, true);
  assert.equal(opts.json, false);
});

test('parseVerifyPrArgs: --from-patch sets patch mode + patchPath', () => {
  const opts = parseVerifyPrArgs(['--from-patch', 'some/file.patch']);
  assert.equal(opts.mode, 'patch');
  assert.equal(opts.patchPath, 'some/file.patch');
});

test('parseVerifyPrArgs: --range sets range mode + range value', () => {
  const opts = parseVerifyPrArgs(['--range', 'main...HEAD']);
  assert.equal(opts.mode, 'range');
  assert.equal(opts.range, 'main...HEAD');
});

test('parseVerifyPrArgs: --full-scan sets full mode', () => {
  const opts = parseVerifyPrArgs(['--full-scan']);
  assert.equal(opts.mode, 'full');
});

test('parseVerifyPrArgs: --no-write and --json toggle flags', () => {
  const opts = parseVerifyPrArgs(['--no-write', '--json']);
  assert.equal(opts.write, false);
  assert.equal(opts.json, true);
});

test('parseVerifyPrArgs: --from-patch as last arg throws bounds error', () => {
  assert.throws(
    () => parseVerifyPrArgs(['--from-patch']),
    /requires a value/i
  );
});

test('parseVerifyPrArgs: --range as last arg throws bounds error', () => {
  assert.throws(
    () => parseVerifyPrArgs(['--range']),
    /requires a value/i
  );
});

test('parseVerifyPrArgs: --comment-file as last arg throws bounds error', () => {
  assert.throws(
    () => parseVerifyPrArgs(['--comment-file']),
    /requires a value/i
  );
});

test('parseVerifyPrArgs: --project-root as last arg throws bounds error', () => {
  assert.throws(
    () => parseVerifyPrArgs(['--project-root']),
    /requires a value/i
  );
});

test('parseVerifyPrArgs: --include as last arg throws bounds error', () => {
  assert.throws(
    () => parseVerifyPrArgs(['--include']),
    /requires a value/i
  );
});

test('parseVerifyPrArgs: --include accumulates multiple values', () => {
  const opts = parseVerifyPrArgs(['--include', 'src/', '--include', 'lib/']);
  assert.deepEqual(opts.includePaths, ['src/', 'lib/']);
});
