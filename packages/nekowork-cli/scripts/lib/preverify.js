import fs from 'node:fs';
import path from 'node:path';

const PREVERIFY_VERSION = 'preverify-v0';

const RULES = [
  {
    id: 'secret-env-fallback',
    tag: 'secret',
    severity: 'critical',
    category: 'security',
    gateRequired: true,
    requiresCodexChallenge: true,
    summary: 'secret-like environment fallback added',
    requiredFix: 'Remove long-lived secret fallback or prove it cannot bypass delegated/local auth.',
    match: ({ added }) => added.some(line => /process\.env\.[A-Z0-9_]*(API[_-]?KEY|SECRET|TOKEN|PASSWORD|PRIVATE[_-]?KEY)[A-Z0-9_]*/i.test(line) && /(\|\||\?\?|:)/.test(line)),
  },
  {
    id: 'static-secret-literal',
    tag: 'secret',
    severity: 'high',
    category: 'security',
    gateRequired: true,
    requiresCodexChallenge: true,
    summary: 'secret-like literal or key name added',
    requiredFix: 'Remove the static secret material or document a safe non-secret placeholder.',
    match: ({ added }) => added.some(line => /(api[_-]?key|secret|token|password|private[_-]?key)\s*[:=]\s*['"][^'"]{8,}/i.test(line)),
  },
  {
    id: 'auth-boundary-file',
    tag: 'auth',
    severity: 'high',
    category: 'security',
    gateRequired: true,
    requiresCodexChallenge: true,
    summary: 'authentication or permission boundary file changed',
    requiredFix: 'Confirm auth boundary tests and reviewer approval before ship/apply.',
    match: ({ files }) => files.some(file => /(^|[\\/])(auth|oauth|jwt|session|sessions|permission|permissions|rbac|acl|login|logout)([\\/._-]|$)/i.test(file)),
  },
  {
    id: 'deploy-boundary-file',
    tag: 'deploy',
    severity: 'high',
    category: 'security',
    gateRequired: true,
    requiresCodexChallenge: true,
    summary: 'deployment or CI boundary file changed',
    requiredFix: 'Confirm CI/deploy blast radius and rollback evidence before ship/apply.',
    match: ({ files }) => files.some(file => /(^|[\\/])(\.github[\\/]workflows|deploy|deployment|terraform|k8s|kubernetes|helm|Dockerfile|docker-compose)/i.test(file)),
  },
  {
    id: 'payment-boundary-file',
    tag: 'payment',
    severity: 'high',
    category: 'correctness',
    gateRequired: true,
    requiresCodexChallenge: true,
    summary: 'payment or billing boundary file changed',
    requiredFix: 'Confirm money-flow tests and manual approval before ship/apply.',
    match: ({ files, added }) => files.some(file => /(payment|billing|checkout|invoice|stripe|refund)/i.test(file)) ||
      added.some(line => /\b(stripe|payment|billing|checkout|invoice|refund)\b/i.test(line)),
  },
  {
    id: 'env-config-boundary',
    tag: 'config',
    severity: 'medium',
    category: 'security',
    gateRequired: false,
    requiresCodexChallenge: true,
    summary: 'environment or secret configuration boundary changed',
    requiredFix: 'Confirm no secrets are committed and defaults are safe.',
    match: ({ files }) => files.some(file => /(^|[\\/])(\.env|\.env\.example|secrets?\.|config[\\/].*\.(js|ts|json|yaml|yml)|.*config\.(js|ts|json|yaml|yml))$/i.test(file)),
  },
  {
    id: 'destructive-data-op',
    tag: 'data',
    severity: 'high',
    category: 'correctness',
    gateRequired: true,
    requiresCodexChallenge: true,
    summary: 'destructive data operation added',
    requiredFix: 'Add migration/rollback evidence and explicit human approval.',
    match: ({ added }) => added.some(line => /\b(drop\s+table|truncate\s+table|delete\s+from|drop\s+database)\b/i.test(line)),
  },
];

const LEVEL_SCORE = { low: 0, medium: 1, high: 2, critical: 3 };

export function runPreverify({ task = '', files = [], diff = '' } = {}) {
  const normalizedFiles = [...new Set((files || []).filter(Boolean).map(String))];
  const added = addedLines(diff);
  const context = { task, files: normalizedFiles, diff: String(diff || ''), added };
  const findings = [];

  for (const rule of RULES) {
    if (!rule.match(context)) continue;
    findings.push({
      rule_id: rule.id,
      severity: rule.severity,
      category: rule.category,
      tag: rule.tag,
      summary: rule.summary,
      evidence: evidenceFor(rule, context),
      required_fix: rule.requiredFix,
      gate_required: rule.gateRequired,
      confidence: 1,
    });
  }

  const riskLevel = riskFromFindings(findings);
  const gateRequired = findings.some(f => f.gate_required);
  return {
    version: PREVERIFY_VERSION,
    task,
    files: normalizedFiles,
    diff_present: Boolean(String(diff || '').trim()),
    finding_count: findings.length,
    verdict: findings.some(f => f.severity === 'critical') ? 'block' : findings.length ? 'approve_with_fixes' : 'approve',
    risk_level: riskLevel,
    risk_tags: [...new Set(findings.map(f => f.tag))].sort(),
    gate_required: gateRequired,
    requires_codex_challenge: findings.some((finding) => {
      const rule = RULES.find(row => row.id === finding.rule_id);
      return rule?.requiresCodexChallenge;
    }),
    reason: gateRequired ? `preverify requires human gate (${[...new Set(findings.filter(f => f.gate_required).map(f => f.tag))].join(',')})` : null,
    findings,
  };
}

export function preverifyIssues(preverify) {
  return (preverify?.findings || []).map(finding => ({
    severity: finding.severity,
    category: finding.category,
    summary: finding.summary,
    evidence: finding.evidence,
    required_fix: finding.required_fix,
    confidence: finding.confidence,
    gate_required: finding.gate_required,
  }));
}

export function writePreverifySummary(sessionDir, preverify) {
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, 'preverify-summary.json'), JSON.stringify(preverify, null, 2));
}

function addedLines(diff) {
  return String(diff || '')
    .split(/\r?\n/)
    .filter(line => line.startsWith('+') && !line.startsWith('+++'))
    .map(line => line.slice(1).trim())
    .filter(Boolean);
}

function evidenceFor(rule, context) {
  if (rule.id.endsWith('-file')) {
    return context.files.filter(file => rule.match({ ...context, files: [file], added: [] })).slice(0, 5).join(', ');
  }
  const sample = context.added.find(line => rule.match({ ...context, added: [line], files: [] })) || context.files[0] || '';
  return redact(sample).slice(0, 220);
}

function riskFromFindings(findings) {
  let score = 0;
  for (const finding of findings) score = Math.max(score, LEVEL_SCORE[finding.severity] ?? 0);
  return ['low', 'medium', 'high', 'critical'][score] || 'low';
}

function redact(text) {
  return String(text || '')
    .replace(/(['"])[^'"]*(api[_-]?key|secret|token|password|private[_-]?key)[^'"]*\1/ig, '$1[redacted-secret-like-value]$1')
    .replace(/(process\.env\.[A-Z0-9_]*(API[_-]?KEY|SECRET|TOKEN|PASSWORD|PRIVATE[_-]?KEY)[A-Z0-9_]*)/ig, '$1');
}
