import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_COUNT = 3;

export function normalizeAcceptanceCriteria(value, source = 'unknown') {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((row, index) => {
      if (typeof row === 'string') {
        return {
          id: `AC-${String(index + 1).padStart(3, '0')}`,
          desc: row.trim(),
          passes: false,
          source,
        };
      }
      if (!row || typeof row !== 'object') return null;
      const desc = String(row.desc || row.description || row.summary || '').trim();
      if (!desc) return null;
      return {
        id: String(row.id || `AC-${String(index + 1).padStart(3, '0')}`),
        desc,
        passes: typeof row.passes === 'boolean' ? row.passes : false,
        source: row.source || source,
      };
    })
    .filter(Boolean);
}

export function readAcceptanceCriteria(sessionDir) {
  const artifact = readJson(path.join(sessionDir, 'acceptance-criteria.json'));
  if (artifact?.criteria?.length) {
    return {
      criteria: normalizeAcceptanceCriteria(artifact.criteria, artifact.source || 'acceptance-criteria.json'),
      source: artifact.source || 'acceptance-criteria.json',
      generated: Boolean(artifact.generated),
    };
  }

  const prd = readJson(path.join(sessionDir, 'prd.json'));
  const fromPrd = normalizeAcceptanceCriteria(prd?.acceptance, 'prd.json');
  if (fromPrd.length) {
    return { criteria: fromPrd, source: 'prd.json', generated: false };
  }

  const ask = readJson(path.join(sessionDir, 'ask.json'));
  const fromAsk = normalizeAcceptanceCriteria(ask?.success_criteria, 'ask.json');
  if (fromAsk.length) {
    return { criteria: fromAsk, source: 'ask.json', generated: false };
  }

  const questionGate = readJson(path.join(sessionDir, 'handoffs', '00-question-gate.json'));
  const fromGate = normalizeAcceptanceCriteria(questionGate?.success_criteria, '00-question-gate.json');
  if (fromGate.length) {
    return { criteria: fromGate, source: '00-question-gate.json', generated: false };
  }

  return { criteria: [], source: null, generated: false };
}

export function ensureAcceptanceCriteria({ sessionDir, task, minimum = DEFAULT_COUNT }) {
  fs.mkdirSync(sessionDir, { recursive: true });
  const existing = readAcceptanceCriteria(sessionDir);
  const criteria = existing.criteria.length
    ? existing.criteria
    : buildDefaultAcceptanceCriteria(task, minimum);
  const source = existing.source || 'task-derived-minimum';
  const generated = existing.criteria.length ? existing.generated : true;

  const artifact = {
    source,
    generated,
    required: true,
    criteria,
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(sessionDir, 'acceptance-criteria.json'), JSON.stringify(artifact, null, 2));

  return artifact;
}

export function buildDefaultAcceptanceCriteria(task = '', minimum = DEFAULT_COUNT) {
  const cleanTask = String(task || 'requested change').trim() || 'requested change';
  const criteria = [
    `Requested outcome is implemented for: ${cleanTask}`,
    'Out-of-scope behavior is left unchanged or explicitly documented.',
    'Verification evidence is recorded before ship or apply.',
  ];
  return criteria.slice(0, Math.max(1, minimum)).map((desc, index) => ({
    id: `AC-${String(index + 1).padStart(3, '0')}`,
    desc,
    passes: false,
    source: 'task-derived-minimum',
  }));
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}
