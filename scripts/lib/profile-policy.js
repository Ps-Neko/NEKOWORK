const EVIDENCE_PROFILES = new Set(['quality', 'security']);
const QUALITY_PROFILES = new Set(['quality']);
const PRODUCT_PROFILES = new Set(['product']);

export function normalizeProfileName(profile) {
  const value = String(profile || '').trim().toLowerCase();
  return value || null;
}

export function profilePolicy(profile) {
  const name = normalizeProfileName(profile);
  return {
    profile: name,
    evidenceWarningRequired: EVIDENCE_PROFILES.has(name),
    acceptanceCoverageWarning: QUALITY_PROFILES.has(name),
    strictQualitySupported: EVIDENCE_PROFILES.has(name) || QUALITY_PROFILES.has(name),
    productChecklistRequired: PRODUCT_PROFILES.has(name),
    checklist: buildQualityChecklist(name),
  };
}

export function buildQualityChecklist(profile) {
  const name = normalizeProfileName(profile);
  if (name === 'quality') {
    return [
      'brainstorm before work',
      'test-first plan',
      'systematic debugging path',
      'acceptance criteria coverage evidence',
      'evidence-based review findings',
      'verification before completion',
      'quality gate before ship/apply',
    ];
  }
  if (name === 'security') {
    return [
      'security boundary identified',
      'sensitive files reviewed',
      'evidence-based critical/high findings',
      'Codex challenge for sensitive work',
      'Human Gate on critical findings',
    ];
  }
  if (name === 'product') {
    return [
      'target user identified',
      'MVP scope defined',
      'non-goals protected',
      'launch/readiness risk identified',
      'QA acceptance criteria defined',
      'UX confusion risk checked',
    ];
  }
  return [];
}

export function evidenceFieldWarnings(handoffs = [], profile) {
  const policy = profilePolicy(profile);
  if (!policy.evidenceWarningRequired) return [];

  const warnings = [];
  for (const handoff of handoffs.filter(Boolean)) {
    for (const issue of handoff.issues || []) {
      if (!shouldRequireEvidence(issue)) continue;
      const missing = [];
      if (!issue.claim) missing.push('claim');
      if (!issue.evidence) missing.push('evidence');
      if (!issue.required_fix && !issue.suggested_fix) missing.push('required_fix');
      if (typeof issue.confidence !== 'number') missing.push('confidence');
      if (typeof issue.gate_required !== 'boolean') missing.push('gate_required');
      if (missing.length) {
        warnings.push(`${handoff.stage || 'handoff'} issue "${issue.summary || issue.claim || 'unnamed'}" missing ${missing.join(', ')}`);
      }
    }
  }
  return warnings;
}

export function acceptanceCoverageWarnings(criteria = [], handoffs = [], profile) {
  return acceptanceCoverage(criteria, handoffs, profile)
    .filter(row => row.status === 'missing')
    .map(row => `${row.id || 'AC'} lacks explicit verification evidence`);
}

export function acceptanceCoverage(criteria = [], handoffs = [], profile) {
  const policy = profilePolicy(profile);
  if (!policy.acceptanceCoverageWarning) return [];

  const evidence = collectEvidence(handoffs);

  return (criteria || [])
    .filter(ac => ac?.id || ac?.desc)
    .map(ac => {
      const id = String(ac.id || '').trim();
      const desc = String(ac.desc || '').trim();
      const match = findCoverageMatch({ id, desc }, evidence);
      return {
        id: id || 'AC',
        desc: desc || '',
        status: match ? 'covered' : 'missing',
        evidence: match?.evidence || 'No explicit verification evidence found in Codex review/challenge handoffs.',
        source: match?.source || 'quality-warning',
      };
    });
}

function shouldRequireEvidence(issue = {}) {
  return ['critical', 'high'].includes(issue.severity) || issue.gate_required === true;
}

function collectEvidence(handoffs = []) {
  const rows = [];
  for (const handoff of handoffs.filter(Boolean)) {
    const source = handoff.stage || 'handoff';
    for (const value of [handoff.decided, handoff.rejected, handoff.risks, handoff.remaining]) {
      if (value) rows.push({ source, evidence: String(value) });
    }
    for (const issue of handoff.issues || []) {
      for (const value of [issue.summary, issue.claim, issue.evidence, issue.why, issue.required_fix, issue.suggested_fix]) {
        if (value) rows.push({ source, evidence: String(value) });
      }
    }
  }
  return rows;
}

function findCoverageMatch(ac, evidenceRows) {
  const id = ac.id.toLowerCase();
  const desc = ac.desc.toLowerCase();
  return evidenceRows.find(row => {
    const evidence = row.evidence.toLowerCase();
    return (id && evidence.includes(id)) || (desc && evidence.includes(desc));
  }) || null;
}
