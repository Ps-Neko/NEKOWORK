import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { askGate, buildQuestionGate, classifyAskTask } from '../../scripts/orchestrators/ask.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const handoffSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'handoff.schema.json'), 'utf8'));
const validateHandoff = ajv.compile(handoffSchema);

test('ask classifies financial UI tasks as high risk with human gate if continuing', () => {
  const c = classifyAskTask('stock trading dashboard mockup with mock-only orders');
  assert.equal(c.risk, 'high');
  assert.ok(c.tags.includes('financial'));
  assert.ok(c.tags.includes('product-ui'));
  assert.equal(c.requiresCodexChallenge, true);
  assert.equal(c.requiresHumanGate, true);
});

test('question gate handoff stays schema-valid and read-only', () => {
  const handoff = buildQuestionGate('React dashboard mockup');
  assert.equal(handoff.stage, 'question-gate');
  assert.equal(handoff.provider, 'local');
  assert.deepEqual(handoff.files, []);
  assert.ok(handoff.questions.length >= 4);
  assert.equal(handoff.success_criteria.length, 3);
  assert.equal(validateHandoff(handoff), true, JSON.stringify(validateHandoff.errors));
});

test('product and quality profiles add question templates', () => {
  const product = buildQuestionGate('new dashboard', { profile: 'product' });
  assert.equal(product.profile, 'product');
  assert.ok(product.questions.some(q => /MVP scope/.test(q)));
  assert.ok(product.questions.some(q => /non-goal/.test(q)));
  assert.equal(validateHandoff(product), true, JSON.stringify(validateHandoff.errors));

  const quality = buildQuestionGate('refactor parser', { profile: 'quality' });
  assert.equal(quality.profile, 'quality');
  assert.ok(quality.questions.some(q => /test-first plan/i.test(q)));
  assert.ok(quality.questions.some(q => /acceptance criterion/i.test(q)));
  assert.equal(validateHandoff(quality), true, JSON.stringify(validateHandoff.errors));
});

test('ask writes question-gate artifacts into the target project session', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ask-project-root-'));
  try {
    const r = await askGate({
      task: 'auth token rotation plan',
      sessionId: 'unit-ask',
      harnessRoot: ROOT,
      projectRoot,
    });

    assert.equal(path.resolve(r.sessionDir), path.join(projectRoot, '.harness', 'state', 'sessions', 'unit-ask'));
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'ask.json')));
    const ask = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'ask.json'), 'utf8'));
    assert.deepEqual(ask.profile_checklist, []);
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'handoffs', '00-question-gate.json')));
    assert.ok(fs.existsSync(path.join(r.sessionDir, 'handoffs', '00-question-gate.md')));
    assert.equal(r.handoff.risk_level, 'high');
    assert.equal(r.handoff.success_criteria.length, 3);
    assert.equal(validateHandoff(r.handoff), true, JSON.stringify(validateHandoff.errors));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('ask writes product profile checklist for product question gate', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ask-product-profile-'));
  try {
    const r = await askGate({
      task: 'scope a new dashboard',
      sessionId: 'unit-ask-product',
      harnessRoot: ROOT,
      projectRoot,
      profile: 'product',
    });

    const ask = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'ask.json'), 'utf8'));
    assert.equal(ask.profile, 'product');
    assert.ok(ask.profile_checklist.includes('target user identified'));
    assert.ok(ask.profile_checklist.includes('QA acceptance criteria defined'));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
