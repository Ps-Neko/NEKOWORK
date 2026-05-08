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

test('external run kit collects public evidence without private source', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'EXTERNAL-RUN.md'), 'utf8');
  const template = fs.readFileSync(path.join(ROOT, '.github', 'ISSUE_TEMPLATE', 'external-run.yml'), 'utf8');
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

  assert.match(doc, /1 external user/);
  assert.match(doc, /1 real repo or real local project/);
  assert.match(doc, /1 REPORT\.md trust card/);
  assert.match(doc, /Do not ask users to run `apply`, commit, push, publish, deploy, or open a PR/);
  assert.match(doc, /not mathematically proven correctness/);
  assert.match(template, /id: final_state/);
  assert.match(template, /SHIP_READY/);
  assert.match(template, /NO_SHIP/);
  assert.match(template, /HUMAN_GATE/);
  assert.match(template, /id: quote/);
  assert.match(template, /Maintainers may cite my optional quote publicly/);
  assert.match(readme, /external run kit/);
});

test('bug report template asks for impact classification', () => {
  const template = fs.readFileSync(path.join(ROOT, '.github', 'ISSUE_TEMPLATE', 'bug-report.yml'), 'utf8');

  assert.match(template, /id: impact/);
  assert.match(template, /install path blocked/);
  assert.match(template, /safety invariant concern/);
});
