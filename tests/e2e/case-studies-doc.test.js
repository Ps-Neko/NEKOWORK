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

test('auth parser case study records security-profile evidence', () => {
  const file = path.join(ROOT, 'docs', 'case-studies', 'JSHTTP-BASIC-AUTH.md');
  const doc = fs.readFileSync(file, 'utf8');

  assert.match(doc, /https:\/\/github\.com\/jshttp\/basic-auth/);
  assert.match(doc, /1ba386f174d4b3633037c7231ac6718549520bf0/);
  assert.match(doc, /npm run specs/);
  assert.match(doc, /28 tests passed/);
  assert.match(doc, /profile": "security/);
  assert.match(doc, /codex_challenge_run: true/);
  assert.match(doc, /approve_with_fixes/);
  assert.match(doc, /No package source files were modified/);
});

test('python protocol case study records non-node strict-quality evidence', () => {
  const file = path.join(ROOT, 'docs', 'case-studies', 'PYTHON-HYPER-H11.md');
  const doc = fs.readFileSync(file, 'utf8');

  assert.match(doc, /https:\/\/github\.com\/python-hyper\/h11/);
  assert.match(doc, /62c5068c971579d61fa1b55373390e12f25fd856/);
  assert.match(doc, /python -m pytest h11\\tests/);
  assert.match(doc, /78 tests passed/);
  assert.match(doc, /profile": "quality/);
  assert.match(doc, /strict_quality_blocked": true/);
  assert.match(doc, /pyproject\.toml/);
  assert.match(doc, /No package source files were modified/);
});
