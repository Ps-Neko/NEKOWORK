// continuous-learning-v2 인스팅트 시스템.
// 매 review 사이클 후 발견된 패턴 (라우팅 결정 + 이슈 카테고리 + verdict 흐름) 을
// 신뢰도 점수와 함께 ~/.harness/instincts/<id>.json 으로 영속.
// 임계 도달 시 사용자에게 "스킬 후보화" 제안.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const PROMOTE_THRESHOLD = Number(process.env.HARNESS_INSTINCT_PROMOTE_THRESHOLD || 3);
const PRUNE_DAYS = Number(process.env.HARNESS_INSTINCT_PRUNE_DAYS || 30);

function home() { return process.env.HARNESS_HOME || path.join(os.homedir(), '.harness'); }
function dir() { return path.join(home(), 'instincts'); }

function patternId(p) {
  const norm = JSON.stringify({ kind: p.kind, key: p.key });
  return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 12);
}

/**
 * 인스팅트 1건 기록 또는 카운트 증가.
 * @param {object} p
 * @param {string} p.kind            - 'routing' | 'issue-pattern' | 'fix-flow' | 'sensitive-path'
 * @param {string} p.key             - 패턴 고유 키 (사람이 읽을 수 있는 짧은 문자열)
 * @param {string} [p.summary]       - 1줄 요약
 * @param {object} [p.evidence]      - 자유 형식 증거 (sessionId, files, severity 등)
 * @param {string} [p.scope]         - 'global' | 'project'
 * @returns {object} 갱신된 instinct
 */
export function record(p) {
  const home_ = dir();
  fs.mkdirSync(home_, { recursive: true });
  const id = patternId(p);
  const file = path.join(home_, `${id}.json`);

  let inst;
  if (fs.existsSync(file)) {
    inst = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    inst = {
      id,
      kind: p.kind,
      key: p.key,
      summary: p.summary || '',
      scope: p.scope || 'global',
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      count: 0,
      confidence: 0,
      evidence: [],
      promoted: false,
    };
  }
  inst.count += 1;
  inst.last_seen = new Date().toISOString();
  if (p.evidence) {
    inst.evidence.push({ ts: inst.last_seen, ...p.evidence });
    if (inst.evidence.length > 20) inst.evidence = inst.evidence.slice(-20);
  }
  if (p.summary && !inst.summary) inst.summary = p.summary;
  // 신뢰도: count 기반 단순 척도. 임계 PROMOTE_THRESHOLD 도달 = 1.0.
  inst.confidence = Math.min(1, inst.count / PROMOTE_THRESHOLD);
  fs.writeFileSync(file, JSON.stringify(inst, null, 2));
  return inst;
}

export function list({ kind, scope, minConfidence = 0, since = 'all' } = {}) {
  const d = dir();
  if (!fs.existsSync(d)) return [];
  const cutoff = parseSince(since);
  const rows = [];
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith('.json')) continue;
    try {
      const inst = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
      if (kind && inst.kind !== kind) continue;
      if (scope && inst.scope !== scope) continue;
      if (inst.confidence < minConfidence) continue;
      if (cutoff && new Date(inst.last_seen).getTime() < cutoff) continue;
      rows.push(inst);
    } catch { /* skip malformed */ }
  }
  return rows.sort((a, b) => b.confidence - a.confidence || b.count - a.count);
}

export function get(id) {
  const f = path.join(dir(), `${id}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

/**
 * 인스팅트 → 스킬 후보 마크. 실제 스킬 파일 생성은 안 함 (사용자 명시 필요).
 */
export function promote(id) {
  const inst = get(id);
  if (!inst) throw new Error(`instinct not found: ${id}`);
  if (inst.confidence < 1) {
    throw new Error(`confidence ${inst.confidence} < 1 (count ${inst.count}/${PROMOTE_THRESHOLD}). 더 누적 후 promote.`);
  }
  inst.promoted = true;
  inst.promoted_at = new Date().toISOString();
  fs.writeFileSync(path.join(dir(), `${id}.json`), JSON.stringify(inst, null, 2));
  return inst;
}

export function prune({ olderDays = PRUNE_DAYS, dryRun = false } = {}) {
  const d = dir();
  if (!fs.existsSync(d)) return { removed: [], kept: 0 };
  const cutoff = Date.now() - olderDays * 86_400_000;
  const removed = [], kept = [];
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith('.json')) continue;
    const fp = path.join(d, f);
    try {
      const inst = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const lastTs = new Date(inst.last_seen).getTime();
      if (!inst.promoted && lastTs < cutoff && inst.confidence < 1) {
        if (!dryRun) fs.unlinkSync(fp);
        removed.push({ id: inst.id, kind: inst.kind, key: inst.key, last_seen: inst.last_seen });
      } else {
        kept.push(inst.id);
      }
    } catch { /* skip */ }
  }
  return { removed, kept: kept.length, dry_run: !!dryRun };
}

function parseSince(s) {
  if (!s || s === 'all') return 0;
  const m = String(s).match(/^(\d+)\s*([smhd])$/);
  if (!m) return 0;
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]] || 86_400_000;
  return Date.now() - Number(m[1]) * mult;
}
