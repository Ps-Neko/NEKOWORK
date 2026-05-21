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

test('ask attaches upstream_artifacts onto the question-gate handoff itself', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ask-handoff-upstream-'));
  try {
    fs.writeFileSync(path.join(projectRoot, 'context.md'), 'attached body');
    const r = await askGate({
      task: 'do thing',
      sessionId: 'unit-ask-handoff-upstream',
      harnessRoot: ROOT,
      projectRoot,
    });
    const handoffJson = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'handoffs', '00-question-gate.json'), 'utf8'));
    assert.ok(handoffJson.upstream_artifacts, 'handoff JSON must include upstream_artifacts');
    assert.equal(handoffJson.upstream_artifacts.context.path, 'context.md');
    assert.equal(validateHandoff(handoffJson), true, JSON.stringify(validateHandoff.errors));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('ask records explicit --context-file artifact in ask.json', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ask-context-explicit-'));
  try {
    const contextPath = path.join(projectRoot, 'context.md');
    const contextBody = '# Domain\n\nThe shop sells widgets. A widget has SKU and price.\n';
    fs.writeFileSync(contextPath, contextBody);

    const r = await askGate({
      task: 'add widget price filter',
      sessionId: 'unit-ask-context-explicit',
      harnessRoot: ROOT,
      projectRoot,
      contextFile: contextPath,
    });

    const ask = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'ask.json'), 'utf8'));
    assert.ok(ask.upstream_artifacts, 'ask.json must include upstream_artifacts');
    const ctx = ask.upstream_artifacts.context;
    assert.ok(ctx, 'upstream_artifacts.context must be present when contextFile is supplied');
    assert.equal(ctx.path, path.relative(projectRoot, contextPath).replace(/\\/g, '/'));
    assert.equal(ctx.size, Buffer.byteLength(contextBody, 'utf8'));
    assert.match(ctx.sha1, /^[0-9a-f]{40}$/);
    assert.ok(typeof ctx.excerpt === 'string' && ctx.excerpt.length > 0);
    assert.equal(ctx.truncated, false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('ask auto-picks projectRoot/context.md without --context-file', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ask-context-auto-'));
  try {
    fs.writeFileSync(path.join(projectRoot, 'context.md'), 'auto pick context body');

    const r = await askGate({
      task: 'tweak the header',
      sessionId: 'unit-ask-context-auto',
      harnessRoot: ROOT,
      projectRoot,
    });

    const ask = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'ask.json'), 'utf8'));
    assert.ok(ask.upstream_artifacts?.context, 'context.md in projectRoot must be picked up automatically');
    assert.equal(ask.upstream_artifacts.context.path, 'context.md');
    assert.equal(ask.upstream_artifacts.context.source, 'auto');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('ask without context.md leaves upstream_artifacts empty', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ask-context-none-'));
  try {
    const r = await askGate({
      task: 'no context here',
      sessionId: 'unit-ask-context-none',
      harnessRoot: ROOT,
      projectRoot,
    });

    const ask = JSON.parse(fs.readFileSync(path.join(r.sessionDir, 'ask.json'), 'utf8'));
    assert.ok(ask.upstream_artifacts, 'upstream_artifacts field must always exist');
    assert.equal(ask.upstream_artifacts.context, null);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('ask with missing explicit --context-file throws', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ask-context-missing-'));
  try {
    await assert.rejects(
      askGate({
        task: 'bogus',
        sessionId: 'unit-ask-context-missing',
        harnessRoot: ROOT,
        projectRoot,
        contextFile: path.join(projectRoot, 'does-not-exist.md'),
      }),
      /context file not found/i,
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
