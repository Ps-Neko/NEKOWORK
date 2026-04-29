#!/usr/bin/env node
// HARNESS MCP 단일 게이트웨이.
// 4개 도구: state_read, state_write, notepad_append, handoff_write.
// .mcp.json 에서 단일 서버로 등록되어 외부 MCP (github, context7, exa, memory) 는 별도 namespace 로 prox-y 가능.
// Day 4 MVP: 4도구만. namespace 프록시는 Day 5 이후.

import fs from 'node:fs';
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

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
];

const server = new Server(
  { name: 'harness', version: '0.0.1' },
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
  switch (key) {
    case 'notepad':  return path.join(SESSION_DIR, 'notepad.md');
    case 'prd':      return path.join(SESSION_DIR, 'prd.json');
    case 'progress': return path.join(SESSION_DIR, 'progress.txt');
    case 'round':    return path.join(SESSION_DIR, 'round.json');
    default:
      if (key.includes('..')) throw new Error('상위 디렉터리 접근 금지');
      return path.join(SESSION_DIR, key);
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
