// Codex ↔ Claude 컨텍스트 격리 회귀 방어.
// 원칙 2 "Claude 가 구현, Codex 가 의심" 의 핵심 가치는 컨텍스트 미공유.
// codex buildPrompt 가 Claude 의 내부 사고/agent body 를 prompt 로 leak 하면 워크플로 가치 증발.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { _buildPrompt } from '../../scripts/agents/runners/codex.js';

test('codex buildPrompt: priorHandoffs 의 5필드 외 임의 필드는 prompt 에 누락', () => {
  // 격리 핵심: handoff 객체에 어떤 필드가 추가되어도 buildPrompt 는 whitelist (decided/files/verdict) 만 노출.
  // Claude agent body / chain-of-thought / system prompt 같은 격리 위반 데이터가 priorHandoffs 에 끼어 들어와도
  // codex prompt 로 leak 되지 않아야 함.
  const prompt = _buildPrompt({
    stage: 'codex-review',
    context: {
      diff: '+ const x = 1;',
      priorHandoffs: [{
        stage: 'self-review',
        decided: '간단 함수 추가',
        files: ['src/foo.js'],
        verdict: 'approve_with_fixes',
        // 격리 위반 시도 — 다음 필드의 *값* 이 prompt 에 포함되면 격리 위반.
        chainOfThought: 'CHAIN_OF_THOUGHT_LEAK_MARKER',
        anthropicSystemPrompt: 'ANTHROPIC_SYSTEM_LEAK_MARKER',
        agentBody: 'AGENT_BODY_LEAK_MARKER',
        internalReasoning: 'INTERNAL_REASONING_LEAK_MARKER',
      }],
    },
  });

  // 허용된 5필드는 prompt 에 노출
  assert.match(prompt, /Decided: 간단 함수 추가/);
  assert.match(prompt, /Files: src\/foo\.js/);
  assert.match(prompt, /Verdict: approve_with_fixes/);

  // 격리 위반 시도가 prompt 로 누락되는지 — 4 케이스 모두 검사
  assert.doesNotMatch(prompt, /CHAIN_OF_THOUGHT_LEAK_MARKER/);
  assert.doesNotMatch(prompt, /ANTHROPIC_SYSTEM_LEAK_MARKER/);
  assert.doesNotMatch(prompt, /AGENT_BODY_LEAK_MARKER/);
  assert.doesNotMatch(prompt, /INTERNAL_REASONING_LEAK_MARKER/);
});

test('codex buildPrompt: codex-review 페르소나는 "시니어 리뷰어"', () => {
  const prompt = _buildPrompt({ stage: 'codex-review', context: { diff: '+ x' } });
  assert.match(prompt, /시니어 리뷰어/);
});

test('codex buildPrompt: codex-challenge 페르소나는 "적대적 보안 리서처"', () => {
  const prompt = _buildPrompt({ stage: 'codex-challenge', context: { diff: '+ x' } });
  assert.match(prompt, /적대적 보안 리서처/);
});

test('codex buildPrompt: PRD 는 prompt 에 dump (의도된 노출)', () => {
  // PRD 는 격리 대상이 아니다 — codex 가 task 의도를 알아야 review 가능.
  const prompt = _buildPrompt({
    stage: 'codex-review',
    context: {
      diff: '+ x',
      prd: { task: 'token rotation 추가', acceptance: ['unit test 1', 'integration test 1'] },
    },
  });
  assert.match(prompt, /token rotation 추가/);
  assert.match(prompt, /acceptance/i);
});

test('codex buildPrompt: priorHandoffs 없으면 그 섹션 자체 누락', () => {
  const prompt = _buildPrompt({ stage: 'codex-review', context: { diff: '+ x' } });
  assert.doesNotMatch(prompt, /이전 단계 핸드오프/);
});

test('codex buildPrompt: 큰 diff 는 30000자에서 잘림 (DoS 방어)', () => {
  // 격리는 아니지만 buildPrompt 가 스스로 한도 강제 — 회귀 방어 차원에서 같이 검증.
  const huge = 'X'.repeat(50000);
  const prompt = _buildPrompt({ stage: 'codex-review', context: { diff: huge } });
  // 30000자 한도. prompt 에는 X 가 30000개까지만.
  const xCount = (prompt.match(/X/g) || []).length;
  assert.ok(xCount <= 30000, `X 개수가 30000 초과: ${xCount}`);
});
