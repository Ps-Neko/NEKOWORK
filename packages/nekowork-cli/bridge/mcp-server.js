#!/usr/bin/env node
// HARNESS MCP 단일 게이트웨이.
// 4개 도구: state_read, state_write, notepad_append, handoff_write.
// .mcp.json 에서 단일 서버로 등록되어 외부 MCP (github, context7, exa, memory) 는 별도 namespace 로 proxy 가능.
// 현재 4 도구만. namespace 프록시는 향후 확장.

import fs from 'node:fs';
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { classifyCategory, classifySeverity, severityCounts, deriveVerdict, riskLevel } from '@ps-neko/nekowork/scripts/lib/severity.js';
import { decide as routeDecide } from '../scripts/lib/router.js';
import { record as costRecord, list as costList, summarize as costSummarize } from '../scripts/lib/costs.js';

const ROOT = process.env.HARNESS_ROOT || process.cwd();
const SESSION_ID = process.env.HARNESS_SESSION_ID || 'default';
const SESSION_DIR = path.join(ROOT, '.harness', 'state', 'sessions', SESSION_ID);

function ensureSession() {
  fs.mkdirSync(path.join(SESSION_DIR, 'handoffs'), { recursive: true });
  fs.mkdirSync(path.join(SESSION_DIR, 'facts'), { recursive: true });
}

function audit(event, details) {
  const auditDir = path.join(ROOT, '.harness', 'audit');
  fs.mkdirSync(auditDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const f = path.join(auditDir, `${today}.jsonl`);
  fs.appendFileSync(f, JSON.stringify({
    ts: new Date().toISOString(),
    session: SESSION_ID,
    event,
    ...details,
  }) + '\n');
}

const TOOLS = [
  {
    name: 'state_read',
    description: '세션 상태 파일 읽기. notepad / prd / progress / round / 임의 키 지원.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'notepad | prd | progress | round | <상대경로>' },
      },
      required: ['key'],
    },
  },
  {
    name: 'state_write',
    description: '세션 상태 파일 쓰기 (덮어씀). prd / round / 임의 JSON 키.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { description: '문자열 또는 JSON 직렬화 가능 객체' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'notepad_append',
    description: '세션 notepad.md 에 라인 추가 (append).',
    inputSchema: {
      type: 'object',
      properties: {
        line: { type: 'string' },
      },
      required: ['line'],
    },
  },
  {
    name: 'handoff_write',
    description: '단계별 핸드오프 작성. handoffs/<NN>-<stage>.md. 5필드 강제.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { enum: ['ideate', 'plan', 'implement', 'self-review', 'codex-review', 'codex-challenge', 'ship'] },
        agent: { type: 'string' },
        round: { type: 'integer', minimum: 1, default: 1 },
        decided: { type: 'string' },
        rejected: { type: 'string' },
        risks: { type: 'string' },
        files: { type: 'array', items: { type: 'string' } },
        remaining: { type: 'string' },
        issues: { type: 'array' },
        verdict: { enum: ['block', 'approve_with_fixes', 'approve'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['stage', 'agent', 'decided', 'files'],
    },
  },
  {
    name: 'severity_classify',
    description: '이슈 한 건 또는 이슈 배열의 severity / category 자동 분류. 명시값이 있으면 그대로, 없으면 휴리스틱.',
    inputSchema: {
      type: 'object',
      properties: {
        issues: { type: 'array', description: 'issue 객체 배열' },
        files: { type: 'array', items: { type: 'string' } },
        task: { type: 'string' },
      },
      required: ['issues'],
    },
  },
  {
    name: 'route_decide',
    description: '단계 + task + files + eco_mode 입력 → 라우팅 결정 (agent/model/provider) 출력. routing.jsonl 에 트레이스 가능.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string' },
        task: { type: 'string' },
        files: { type: 'array', items: { type: 'string' } },
        eco_mode: { type: 'boolean' },
        risk_level: { enum: ['low', 'medium', 'high', 'critical'] },
        trace: { type: 'boolean', description: '결정을 routing.jsonl 에 기록' },
      },
      required: ['stage'],
    },
  },
  {
    name: 'cost_record',
    description: '도구 호출 1건의 비용을 ~/.harness/costs.jsonl 에 기록. agent / stage / model / tokens / duration / 추정 USD.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string' },
        stage: { type: 'string' },
        provider: { type: 'string' },
        model: { type: 'string' },
        input_tokens: { type: 'integer' },
        output_tokens: { type: 'integer' },
        duration_ms: { type: 'integer' },
      },
      required: ['agent', 'stage', 'model'],
    },
  },
];

const server = new Server(
  { name: 'harness', version: '0.0.2' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  ensureSession();
  const { name, arguments: args } = req.params;

  try {
    if (name === 'state_read') {
      const file = mapKeyToPath(args.key);
      if (!fs.existsSync(file)) {
        audit('state_read.miss', { key: args.key, file });
        return { content: [{ type: 'text', text: '' }], isError: false };
      }
      const data = fs.readFileSync(file, 'utf8');
      audit('state_read', { key: args.key, file, bytes: data.length });
      return { content: [{ type: 'text', text: data }] };
    }

    if (name === 'state_write') {
      const file = mapKeyToPath(args.key);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const text = typeof args.value === 'string' ? args.value : JSON.stringify(args.value, null, 2);
      fs.writeFileSync(file, text);
      audit('state_write', { key: args.key, file, bytes: text.length });
      return { content: [{ type: 'text', text: `OK ${file} (${text.length}B)` }] };
    }

    if (name === 'notepad_append') {
      const file = path.join(SESSION_DIR, 'notepad.md');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const line = String(args.line).replace(/\r?\n$/, '') + '\n';
      fs.appendFileSync(file, line);
      audit('notepad_append', { file, bytes: line.length });
      return { content: [{ type: 'text', text: 'OK' }] };
    }

    if (name === 'severity_classify') {
      const enriched = (args.issues || []).map((i) => ({
        ...i,
        category: classifyCategory(i),
        severity: classifySeverity(i),
      }));
      const counts = severityCounts(enriched);
      const verdict = deriveVerdict(enriched);
      const risk = riskLevel(args.files || [], args.task || '');
      audit('severity_classify', { count: enriched.length, verdict, risk });
      return { content: [{ type: 'text', text: JSON.stringify({ issues: enriched, counts, verdict, risk_level: risk }, null, 2) }] };
    }

    if (name === 'route_decide') {
      const decision = routeDecide({
        stage: args.stage,
        task: args.task,
        files: args.files,
        ecoMode: args.eco_mode,
        riskLevel: args.risk_level,
        harnessRoot: ROOT,
      });
      if (args.trace) {
        const { trace } = await import('../scripts/lib/router.js');
        trace(SESSION_DIR, decision, { stage: args.stage, task: args.task });
      }
      audit('route_decide', { stage: args.stage, agent: decision.agent, model: decision.model });
      return { content: [{ type: 'text', text: JSON.stringify(decision, null, 2) }] };
    }

    if (name === 'cost_record') {
      const row = costRecord({
        ts: new Date().toISOString(),
        session: SESSION_ID,
        stage: args.stage,
        agent: args.agent,
        provider: args.provider,
        model: args.model,
        input_tokens: args.input_tokens,
        output_tokens: args.output_tokens,
        duration_ms: args.duration_ms,
      });
      audit('cost_record', { model: row.model, usd: row.estimate_usd });
      return { content: [{ type: 'text', text: JSON.stringify(row, null, 2) }] };
    }

    if (name === 'handoff_write') {
      const stageOrder = ['ideate', 'plan', 'implement', 'self-review', 'codex-review', 'codex-challenge', 'ship'];
      const idx = stageOrder.indexOf(args.stage);
      if (idx < 0) throw new Error(`unknown stage: ${args.stage}`);
      const nn = String(idx + 1).padStart(2, '0');
      const file = path.join(SESSION_DIR, 'handoffs', `${nn}-${args.stage}.md`);

      const md = renderHandoff(args);
      fs.writeFileSync(file, md);

      // JSON 부속도 같이 저장
      const jsonFile = file.replace(/\.md$/, '.json');
      fs.writeFileSync(jsonFile, JSON.stringify({
        stage: args.stage,
        agent: args.agent,
        round: args.round || 1,
        timestamp: new Date().toISOString(),
        ...args,
      }, null, 2));

      audit('handoff_write', { stage: args.stage, agent: args.agent, file, verdict: args.verdict });
      return { content: [{ type: 'text', text: `OK ${file} + ${path.basename(jsonFile)}` }] };
    }

    throw new Error(`unknown tool: ${name}`);
  } catch (e) {
    audit('error', { tool: name, message: e.message });
    return {
      content: [{ type: 'text', text: `ERROR: ${e.message}` }],
      isError: true,
    };
  }
});

function mapKeyToPath(key) {
  const sep = path.sep;
  switch (key) {
    case 'notepad':  return path.join(SESSION_DIR, 'notepad.md');
    case 'prd':      return path.join(SESSION_DIR, 'prd.json');
    case 'progress': return path.join(SESSION_DIR, 'progress.txt');
    case 'round':    return path.join(SESSION_DIR, 'round.json');
    default: {
      if (key.includes('..')) throw new Error('상위 디렉터리 접근 금지');
      const joined = path.join(SESSION_DIR, key);
      // Resolve both sides and require the result stays within SESSION_DIR.
      // path.join with an absolute second arg escapes the base — resolve catches both
      // '..' traversal and absolute-path injection.
      const resolved = path.resolve(joined);
      const base = path.resolve(SESSION_DIR) + sep;
      if (!resolved.startsWith(base) && resolved !== path.resolve(SESSION_DIR)) {
        throw new Error('세션 디렉터리 범위 벗어남: 접근 금지');
      }
      return joined;
    }
  }
}

function renderHandoff(a) {
  const lines = [];
  lines.push(`# Handoff: ${String(a.stage)}  (round ${a.round || 1}, agent: ${a.agent})`);
  lines.push('');
  lines.push(`**Decided**: ${a.decided}`);
  if (a.rejected)  lines.push(`**Rejected**: ${a.rejected}`);
  if (a.risks)     lines.push(`**Risks**: ${a.risks}`);
  lines.push(`**Files**: ${(a.files || []).join(', ')}`);
  if (a.remaining) lines.push(`**Remaining**: ${a.remaining}`);
  if (a.verdict)   lines.push(`**Verdict**: ${a.verdict}${a.confidence != null ? ` (confidence ${a.confidence})` : ''}`);
  if (a.issues && a.issues.length) {
    lines.push('');
    lines.push('## Issues');
    for (const i of a.issues) {
      lines.push(`- [${i.severity || '?'}/${i.category || '?'}] ${i.file || ''}${i.line ? ':' + i.line : ''} — ${i.summary || ''}`);
    }
  }
  return lines.join('\n') + '\n';
}

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[harness mcp] gateway up. session=${SESSION_ID} root=${ROOT}\n`);
