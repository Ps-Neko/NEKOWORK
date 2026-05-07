const EVIDENCE_PROFILES = new Set(['quality', 'security']);
const QUALITY_PROFILES = new Set(['quality']);

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
  const policy = profilePolicy(profile);
  if (!policy.acceptanceCoverageWarning) return [];

  const evidenceText = handoffs
    .filter(Boolean)
    .map(h => [
      h.decided,
      h.rejected,
      h.risks,
      h.remaining,
      ...(h.issues || []).flatMap(i => [i.summary, i.claim, i.evidence, i.why, i.required_fix, i.suggested_fix]),
    ].filter(Boolean).join('\n'))
    .join('\n')
    .toLowerCase();

  return (criteria || [])
    .filter(ac => ac?.id || ac?.desc)
    .filter(ac => {
      const id = String(ac.id || '').toLowerCase();
      const desc = String(ac.desc || '').toLowerCase();
      return !((id && evidenceText.includes(id)) || (desc && evidenceText.includes(desc)));
    })
    .map(ac => `${ac.id || 'AC'} lacks explicit verification evidence`);
}

function shouldRequireEvidence(issue = {}) {
  return ['critical', 'high'].includes(issue.severity) || issue.gate_required === true;
}
