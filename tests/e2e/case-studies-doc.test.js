import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('third-party case study records external repository evidence', () => {
  const file = path.join(ROOT, 'docs', 'case-studies', 'SINDRESORHUS-IS-PLAIN-OBJ.md');
  const doc = fs.readFileSync(file, 'utf8');

  assert.match(doc, /https:\/\/github\.com\/sindresorhus\/is-plain-obj/);
  assert.match(doc, /97f38e8836f86a642cce98fc6ab3058bc36df181/);
  assert.match(doc, /npm test/);
  assert.match(doc, /1 test passed/);
  assert.match(doc, /strict_quality_blocked/);
  assert.match(doc, /target_project_mutated/);
  assert.match(doc, /No package source files were modified/);
});
