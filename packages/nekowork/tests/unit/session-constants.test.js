import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUMMARY_FILES, MARKERS } from '../../scripts/lib/session-constants.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const libDir = path.join(here, '..', '..', 'scripts', 'lib');
const orchDir = path.join(here, '..', '..', 'scripts', 'orchestrators');

test('session-constants exposes the superset SUMMARY_FILES (incl. preverify + report)', () => {
  // The fuller list from decision.js is the canonical superset; report.js had
  // drifted and was missing these two before extraction.
  assert.ok(SUMMARY_FILES.includes('preverify-summary.json'));
  assert.ok(SUMMARY_FILES.includes('report-summary.json'));
  assert.equal(SUMMARY_FILES.length, 12);
  assert.equal(MARKERS.length, 6);
});

test('decision.js and report.js both import the shared session constants (no local copy)', () => {
  const decisionSrc = fs.readFileSync(path.join(libDir, 'decision.js'), 'utf8');
  const reportSrc = fs.readFileSync(path.join(orchDir, 'report.js'), 'utf8');

  // Both modules import from the shared module...
  assert.match(decisionSrc, /from '\.\/session-constants\.js'/);
  assert.match(reportSrc, /from '\.\.\/lib\/session-constants\.js'/);

  // ...and neither re-declares its own SUMMARY_FILES / MARKERS arrays.
  assert.doesNotMatch(decisionSrc, /const SUMMARY_FILES = \[/);
  assert.doesNotMatch(decisionSrc, /const MARKERS = \[/);
  assert.doesNotMatch(reportSrc, /const SUMMARY_FILES = \[/);
  assert.doesNotMatch(reportSrc, /const MARKERS = \[/);
});

test('the shared arrays are ESM singletons — same object identity across importers', async () => {
  // A second dynamic import of the same module URL must yield the identical
  // array references, proving decision.js and report.js share one source.
  const again = await import('../../scripts/lib/session-constants.js');
  assert.equal(again.SUMMARY_FILES, SUMMARY_FILES);
  assert.equal(again.MARKERS, MARKERS);
});
