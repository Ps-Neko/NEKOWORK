import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('feedback triage guide preserves alpha safety workflow', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'FEEDBACK-TRIAGE.md'), 'utf8');

  assert.match(doc, /Redact first/);
  assert.match(doc, /check --json/);
  assert.match(doc, /REPORT\.md/);
  assert.match(doc, /ship_ready=false/);
  assert.match(doc, /Do not publish a new alpha/);
  assert.match(doc, /automatic apply, publish, deploy, push, PR/);
});

test('alpha feedback template collects triage classification evidence', () => {
  const template = fs.readFileSync(path.join(ROOT, '.github', 'ISSUE_TEMPLATE', 'alpha-feedback.yml'), 'utf8');

  assert.match(template, /id: feedback_class/);
  assert.match(template, /install failure/);
  assert.match(template, /safety concern/);
  assert.match(template, /id: severity_guess/);
  assert.match(template, /id: target_status/);
});

test('bug report template asks for impact classification', () => {
  const template = fs.readFileSync(path.join(ROOT, '.github', 'ISSUE_TEMPLATE', 'bug-report.yml'), 'utf8');

  assert.match(template, /id: impact/);
  assert.match(template, /install path blocked/);
  assert.match(template, /safety invariant concern/);
});
