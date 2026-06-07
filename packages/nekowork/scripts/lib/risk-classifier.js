// Shared library module — consumed by the heavy @ps-neko/nekowork-harness package; kept in slim as the single source of truth.
import { riskLevel } from './severity.js';

function words(patterns) {
  return new RegExp(patterns.join('|'), 'i');
}

export const SENSITIVE_PATTERNS = [
  /\bauth\b/i,
  /\bcrypto\b/i,
  /\bpayment\b/i,
  /\bsession\b/i,
  /\bpermission\b/i,
  /\boauth\b/i,
  /\bjwt\b/i,
  /\bpassword\b/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bapikey\b/i,
  /\bapi[-_]key\b/i,
  /\bcert\b/i,
  /\btls\b/i,
  /\bssl\b/i,
  /\bmtls\b/i,
  /\bcsrf\b/i,
  /\bcors\b/i,
  /\bxss\b/i,
  /\bwebhook\b/i,
];

const RISK_TAGS = [
  {
    tag: 'security',
    level: 'high',
    challenge: true,
    humanGate: false,
    patterns: [
      ...SENSITIVE_PATTERNS,
      words(['\\uC778\\uC99D', '\\uBCF4\\uC548', '\\uD1A0\\uD070', '\\uBE44\\uBC00\\uBC88\\uD638']),
    ],
  },
  {
    tag: 'financial',
    level: 'high',
    challenge: true,
    humanGate: true,
    patterns: [
      /\b(stock|trading|trade|broker|order|buy|sell|portfolio|payment|billing|invoice|checkout|refund)\b/i,
      words(['\\uC8FC\\uC2DD', '\\uD2B8\\uB808\\uC774\\uB529', '\\uB9E4\\uC218', '\\uB9E4\\uB3C4', '\\uC8FC\\uBB38', '\\uACB0\\uC81C', '\\uD658\\uBD88']),
    ],
  },
  {
    tag: 'deploy',
    level: 'high',
    challenge: true,
    humanGate: true,
    patterns: [
      /\b(deploy|release|production|prod|ci\/cd|github actions|workflow|terraform|kubernetes|k8s|cloud)\b/i,
      words(['\\uBC30\\uD3EC', '\\uB9B4\\uB9AC\\uC2A4', '\\uC6B4\\uC601']),
    ],
  },
  {
    tag: 'data',
    level: 'high',
    challenge: true,
    humanGate: false,
    patterns: [
      /\b(database|migration|schema|delete|truncate|backup|restore|pii|personal data|destructive)\b/i,
      words(['\\uB370\\uC774\\uD130', '\\uB9C8\\uC774\\uADF8\\uB808\\uC774\\uC158', '\\uC0AD\\uC81C', '\\uAC1C\\uC778\\uC815\\uBCF4']),
    ],
  },
  {
    tag: 'product-ui',
    level: 'low',
    challenge: false,
    humanGate: false,
    patterns: [
      /\b(ui|ux|frontend|react|component|dashboard|mockup|wireframe|prototype|accessibility)\b/i,
      words(['\\uD654\\uBA74', '\\uBAA9\\uC5C5', '\\uB300\\uC2DC\\uBCF4\\uB4DC', '\\uD504\\uB860\\uD2B8']),
    ],
  },
];

const LEVEL_SCORE = { low: 0, medium: 1, high: 2, critical: 3 };
const SCORE_LEVEL = ['low', 'medium', 'high', 'critical'];

export function classifyRisk(input = {}) {
  const task = input.task || '';
  const files = input.files || [];
  const issues = input.issues || [];
  const haystack = [task, ...files].join('\n');
  const tags = [];
  let score = LEVEL_SCORE[riskLevel(files, task)] ?? 0;
  let requiresCodexChallenge = false;
  let requiresHumanGate = false;

  for (const spec of RISK_TAGS) {
    if (spec.patterns.some(re => re.test(haystack))) {
      tags.push(spec.tag);
      score = Math.max(score, LEVEL_SCORE[spec.level] ?? 0);
      requiresCodexChallenge = requiresCodexChallenge || spec.challenge;
      requiresHumanGate = requiresHumanGate || spec.humanGate;
    }
  }

  if (issues.some(i => i?.severity === 'critical')) {
    score = Math.max(score, LEVEL_SCORE.critical);
    requiresHumanGate = true;
  }
  if (issues.some(i => i?.verdict === 'block')) {
    requiresHumanGate = true;
  }

  const risk = SCORE_LEVEL[score] || 'low';
  if (risk === 'critical') requiresHumanGate = true;

  return {
    risk,
    tags: [...new Set(tags)],
    requiresCodexChallenge,
    requiresHumanGate,
    sensitive: requiresCodexChallenge || requiresHumanGate,
  };
}

export function isSensitiveWork(input = {}) {
  return classifyRisk(input).sensitive;
}

export function gateReasonFromFindings(handoffs = []) {
  for (const h of handoffs.filter(Boolean)) {
    if (h.verdict === 'block') return `${h.stage} returned block`;
    if ((h.issues || []).some(i => i.severity === 'critical')) return `${h.stage} reported critical issue`;
  }
  return null;
}

export function humanGatePolicy(input = {}) {
  const classification = classifyRisk(input);
  return {
    ...classification,
    reason: classification.requiresHumanGate
      ? `risk=${classification.risk}; tags=${classification.tags.join(',') || 'none'}`
      : null,
  };
}
