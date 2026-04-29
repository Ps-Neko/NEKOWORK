// Claude runner: Anthropic SDK 직접 호출.
// 환경 변수 필요: ANTHROPIC_API_KEY.
// 미보유 시 throw → 오케스트레이터가 mock 으로 fallback (메시지와 함께).
//
// 모델은 agent frontmatter 의 model 필드 (opus / sonnet / haiku) 를
// 실제 모델 ID 로 매핑.

const MODEL_MAP = {
  opus:   'claude-opus-4-7',
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
};

export async function runClaude(args) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 미설정. --live 모드는 API 키 필요. 또는 --provider=mock 사용.');
  }

  // SDK 동적 import (의존성 미설치 환경에서도 mock fallback 가능하도록).
  let Anthropic;
  try {
    ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
  } catch {
    throw new Error('@anthropic-ai/sdk 미설치. npm i @anthropic-ai/sdk 후 다시 시도.');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const modelId = MODEL_MAP[args.model] || args.model;

  const systemPrompt = buildSystem(args);
  const userPrompt = buildUserMessage(args);

  const resp = await client.messages.create({
    model: modelId,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  // 본문 텍스트 추출
  const text = resp.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim();

  // JSON 첫 블록 추출 (```json ... ``` 또는 raw JSON)
  const jsonText = extractJson(text);
  if (!jsonText) {
    throw new Error('Claude 응답에서 JSON 을 찾지 못함. raw:\n' + text.slice(0, 500));
  }

  let parsed;
  try { parsed = JSON.parse(jsonText); }
  catch (e) { throw new Error('Claude 응답 JSON 파싱 실패: ' + e.message); }

  return parsed;
}

function buildSystem(a) {
  const tools = a.disallowedTools?.length
    ? `\nDisallowed tools: ${a.disallowedTools.join(', ')}`
    : '';
  return `You are the HARNESS agent "${a.agent}" running stage "${a.stage}".${tools}
Sandbox: ${a.sandbox || 'workspace-write'}.
Output rules: respond with ONE JSON object conforming to schemas/handoff.schema.json.
No prose outside JSON. Korean for natural-language fields.

Agent body:
${a.promptBody}`;
}

function buildUserMessage(a) {
  const lines = [];
  lines.push('## Task');
  lines.push(a.task || '(없음)');
  lines.push('');
  if (a.context?.prd) {
    lines.push('## PRD');
    lines.push('```json');
    lines.push(JSON.stringify(a.context.prd, null, 2));
    lines.push('```');
  }
  if (a.context?.diff) {
    lines.push('## Git Diff');
    lines.push('```diff');
    lines.push(String(a.context.diff).slice(0, 20000));
    lines.push('```');
  }
  if (a.context?.priorHandoffs?.length) {
    lines.push('## 이전 단계 핸드오프 (요약)');
    for (const h of a.context.priorHandoffs) {
      lines.push(`### ${h.stage}`);
      lines.push(`Decided: ${h.decided}`);
      lines.push(`Files: ${(h.files || []).join(', ')}`);
      if (h.verdict) lines.push(`Verdict: ${h.verdict}`);
      lines.push('');
    }
  }
  if (a.context?.round && a.context.round > 1) {
    lines.push(`## Round ${a.context.round} — 이전 round 의 issues 를 고려하라.`);
  }
  return lines.join('\n');
}

function extractJson(text) {
  // ```json ... ``` 우선
  const m = text.match(/```json\s*([\s\S]*?)```/i);
  if (m) return m[1].trim();
  // raw object — 첫 { 부터 매칭되는 } 까지
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
