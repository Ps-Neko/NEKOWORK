// live runner 의 JSON 추출 / prompt 빌더 단위 테스트.
// Claude/Codex CLI 미설치 환경에서도 동작 (실 호출 없음).

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  extractJson as extractClaude,
  _buildSystem,
  _buildCliArgs as _buildClaudeCliArgs,
  _buildUserMessage,
  _parseCliJson,
  _normalizeCliUsage,
} from '../../scripts/agents/runners/claude.js';
import { extractJson as extractCodex, _buildPrompt, _normalizeHandoff } from '../../scripts/agents/runners/codex.js';
import {
  _buildCliArgs as _buildGeminiCliArgs,
  _buildPrompt as _buildGeminiPrompt,
  _parseGeminiOutput,
} from '../../scripts/agents/runners/gemini.js';

test('extractJson: ```json 펜스 블록', () => {
  const text = 'before\n```json\n{"verdict":"approve","issues":[]}\n```\nafter';
  assert.equal(extractClaude(text), '{"verdict":"approve","issues":[]}');
});

test('extractJson: raw { ... } 첫 매칭', () => {
  const text = 'noise { "a": 1, "b": "{nested}" } trailing';
  const json = extractClaude(text);
  assert.equal(json, '{ "a": 1, "b": "{nested}" }');
});

test('extractJson: 중첩 객체 깊이 처리', () => {
  const text = '{"outer":{"inner":{"deep":1}},"x":2}';
  const json = extractClaude(text);
  assert.equal(json, text);
  assert.deepEqual(JSON.parse(json), { outer: { inner: { deep: 1 } }, x: 2 });
});

test('extractJson: 문자열 안 } 무시', () => {
  const text = '{"msg":"oops}","n":1}';
  const json = extractClaude(text);
  assert.equal(JSON.parse(json).n, 1);
});

test('extractJson: escape 시 다음 문자 그대로', () => {
  const text = '{"q":"he said \\"hi\\" } not closed","ok":true}';
  const json = extractClaude(text);
  assert.equal(JSON.parse(json).ok, true);
});

test('extractJson: JSON 없음 → null', () => {
  assert.equal(extractClaude('no json here'), null);
  assert.equal(extractClaude(''), null);
  assert.equal(extractClaude(null), null);
});

test('claude buildSystem: agent 본문 / sandbox / disallowedTools 포함', () => {
  const s = _buildSystem({
    agent: 'code-reviewer', stage: 'self-review',
    sandbox: 'read-only', disallowedTools: ['Write', 'Edit'],
    promptBody: 'You are a careful reviewer.',
  });
  assert.match(s, /code-reviewer/);
  assert.match(s, /self-review/);
  assert.match(s, /read-only/);
  assert.match(s, /Write, Edit/);
  assert.match(s, /careful reviewer/);
  assert.match(s, /Non-interactive handoff mode/);
  assert.match(s, /do not call tools/);
});

test('claude workspace-write args allow isolated edits', () => {
  const args = _buildClaudeCliArgs({ executionMode: 'workspace-write' }, 'sonnet', 'system');
  assert.equal(args.includes('--tools'), false);
  assert.equal(args.includes('--allowedTools'), true);
  assert.equal(args.includes('acceptEdits'), true);
});

test('claude buildUserMessage: PRD / diff / priorHandoffs 포함', () => {
  const u = _buildUserMessage({
    task: 'JWT 추가',
    context: {
      prd: { acceptance: [{ id: 'AC-001' }] },
      diff: 'diff --git a/x b/x\n+console.log()',
      priorHandoffs: [{ stage: 'plan', decided: 'AC 3개', files: ['x'], verdict: 'approve' }],
      round: 2,
    },
  });
  assert.match(u, /JWT 추가/);
  assert.match(u, /AC-001/);
  assert.match(u, /console.log/);
  assert.match(u, /Round 2/);
  assert.match(u, /Decided: AC 3개/);
});

test('claude CLI wrapper: result JSON 과 usage 를 파싱', () => {
  const wrapper = _parseCliJson(JSON.stringify({
    type: 'result',
    result: '{"decided":"OK","files":["a.js"],"verdict":"approve"}',
    usage: {
      input_tokens: 1,
      output_tokens: 2,
      iterations: [{ input_tokens: 3, output_tokens: 4 }],
    },
  }));
  assert.equal(wrapper.result, '{"decided":"OK","files":["a.js"],"verdict":"approve"}');

  const usage = _normalizeCliUsage(wrapper.usage);
  assert.equal(usage.input_tokens, 3);
  assert.equal(usage.output_tokens, 4);
});

test('codex extractJson: 펜스 + raw 모두 동일', () => {
  const t = '{"verdict":"block","issues":[{"severity":"critical"}]}';
  assert.equal(extractCodex(t), t);
  assert.equal(extractCodex('```json\n' + t + '\n```'), t);
});

test('codex buildPrompt: stage 별 system 프롬프트 분기', () => {
  const review = _buildPrompt({ stage: 'codex-review', context: { diff: 'x' } });
  assert.match(review, /시니어 리뷰어/);
  const challenge = _buildPrompt({ stage: 'codex-challenge', context: { diff: 'x' } });
  assert.match(challenge, /적대적/);
});

test('codex buildPrompt: PRD 포함', () => {
  const p = _buildPrompt({
    stage: 'codex-review',
    context: { prd: { task: 'X' }, priorHandoffs: [{ stage: 'self-review', decided: 'OK', files: [], verdict: 'approve' }] },
  });
  assert.match(p, /## PRD/);
  assert.match(p, /Verdict: approve/);
});

test('큰 diff 는 30000자에서 잘림 (codex)', () => {
  const huge = 'x'.repeat(50000);
  const p = _buildPrompt({ stage: 'codex-review', context: { diff: huge } });
  // diff 영역만 측정 — 전체 prompt 길이는 30000 + 헤더로 컴팩트
  assert.ok(p.length < huge.length);
  assert.ok(p.length < 35000);
});

test('codex normalizeHandoff: PascalCase live 응답을 handoff schema 로 정규화', () => {
  const h = _normalizeHandoff({
    Decided: 'request_changes',
    Rejected: 'self-review approve',
    Risks: [
      { severity: 'critical', file: 'auth/login.js', issue: 'Plaintext password is written to logs.' },
      { severity: 'high', file: 'auth/login.js', issue: 'Unparameterized SQL query.' },
    ],
    Files: ['auth/login.js'],
    Remaining: 'Fix before shipping.',
  });
  assert.equal(h.decided, 'request_changes');
  assert.equal(h.rejected, 'self-review approve');
  assert.deepEqual(h.files, ['auth/login.js']);
  assert.equal(h.issues.length, 2);
  assert.equal(h.issues[0].severity, 'critical');
  assert.equal(h.issues[0].category, 'security');
  assert.equal(h.verdict, 'block');
});

test('gemini buildPrompt includes handoff mode and agent body', () => {
  const p = _buildGeminiPrompt({
    agent: 'research',
    stage: 'ideate',
    task: 'smoke',
    sandbox: 'read-only',
    promptBody: 'Return only JSON.',
    context: { prd: { task: 'x' } },
  });
  assert.match(p, /HARNESS agent "research"/);
  assert.match(p, /Non-interactive handoff mode/);
  assert.match(p, /Return only JSON/);
  assert.match(p, /## PRD/);
});

test('gemini buildCliArgs uses current headless flags', () => {
  const args = _buildGeminiCliArgs({ model: 'gemini-2.5-pro' });
  assert.equal(args.includes('--quiet'), false);
  assert.equal(args.includes('--prompt'), true);
  assert.equal(args.includes('--output-format'), true);
  assert.equal(args.includes('--approval-mode'), true);
  assert.equal(args.includes('plan'), true);
  assert.equal(args.includes('--model'), true);
});

test('gemini parseGeminiOutput unwraps response JSON', () => {
  const handoff = '{"decided":"OK","files":["a.md"],"verdict":"approve"}';
  const parsed = _parseGeminiOutput(JSON.stringify({
    response: '```json\n' + handoff + '\n```',
    stats: { models: {} },
  }));
  assert.equal(parsed.decided, 'OK');
  assert.deepEqual(parsed.files, ['a.md']);
  assert.equal(parsed.verdict, 'approve');
});
