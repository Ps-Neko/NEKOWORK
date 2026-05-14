// 비용 트래커. 매 도구 호출 후 모델·토큰·USD 추정값을 ~/.harness/costs.jsonl 에 append.
// CLI 조회: nekowork costs --since=7d (또는 --since=1h, 30m, all).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PRICE_PER_MTOK = {
  // 단위: USD per 1M tokens. (대략값. 정확도는 공식 가격표 확인.)
  'claude-opus-4-7':            { in: 15, out: 75 },
  'claude-sonnet-4-6':          { in:  3, out: 15 },
  'claude-haiku-4-5-20251001':  { in:  1, out:  5 },
  opus:                          { in: 15, out: 75 },
  sonnet:                        { in:  3, out: 15 },
  haiku:                         { in:  1, out:  5 },
  'gpt-5-codex':                 { in:  3, out: 15 }, // 추정
  'gemini-2.5-pro':              { in:  1.25, out: 5 },
  mock:                          { in:  0, out:  0 },
};

function home() { return process.env.HARNESS_HOME || path.join(os.homedir(), '.harness'); }
function costsFile() { return path.join(home(), 'costs.jsonl'); }

export function record(entry) {
  const home_ = home();
  fs.mkdirSync(home_, { recursive: true });
  const model = entry.model || 'mock';
  const price = PRICE_PER_MTOK[model] || { in: 0, out: 0 };
  const inTok = Number(entry.input_tokens || 0);
  const outTok = Number(entry.output_tokens || 0);
  const usd = (inTok * price.in + outTok * price.out) / 1_000_000;
  const row = {
    ts: entry.ts || new Date().toISOString(),
    session: entry.session || 'default',
    stage: entry.stage,
    agent: entry.agent,
    provider: entry.provider,
    model,
    input_tokens: inTok,
    output_tokens: outTok,
    duration_ms: entry.duration_ms || 0,
    estimate_usd: round2(usd),
  };
  fs.appendFileSync(costsFile(), JSON.stringify(row) + '\n');
  return row;
}

export function list({ since = '7d' } = {}) {
  const f = costsFile();
  if (!fs.existsSync(f)) return [];
  const rows = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  if (since === 'all') return rows;
  const cutoff = parseSince(since);
  return rows.filter(r => new Date(r.ts).getTime() >= cutoff);
}

export function summarize(rows) {
  const total = rows.reduce((s, r) => s + (r.estimate_usd || 0), 0);
  const byModel = {};
  const byProvider = {};
  for (const r of rows) {
    byModel[r.model] = round2((byModel[r.model] || 0) + (r.estimate_usd || 0));
    byProvider[r.provider] = round2((byProvider[r.provider] || 0) + (r.estimate_usd || 0));
  }
  return {
    rows: rows.length,
    total_usd: round2(total),
    by_model: byModel,
    by_provider: byProvider,
  };
}

function parseSince(s) {
  // 1h, 30m, 7d, 24h ...
  const m = String(s).match(/^(\d+)\s*([smhd])$/);
  if (!m) return Date.now() - 7 * 86400_000;
  const n = Number(m[1]);
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]] || 86_400_000;
  return Date.now() - n * mult;
}

function round2(n) { return Math.round(n * 100) / 100; }
