// Hardcoded Credential rule for verify-pr.
//
// Detects high-confidence provider credential signatures committed verbatim
// to source. These signatures are designed to be globally unique enough to
// trigger provider-side leak scanners, so detecting them locally is both
// easy and very high signal.
//
// Out of scope: generic high-entropy strings (heuristic, too noisy without
// AST + variable-name context). Add in 1.x if needed.

import { makeRegexScanner } from './_helpers.js';

// Words that mark a secret-shaped string as an obvious placeholder, not a real
// credential. Matched against the body after the provider prefix. Kept broad
// because the cost of a missed placeholder (FP) is higher than a missed real
// key here (other patterns / scanners also fire on real keys).
const PLACEHOLDER_WORDS = /^(?:dev|test|fake|example|fallback|leaked|default|placeholder|sample|dummy|mock|todo|replace|your|xxx+|change[-_]?me|none|null|undefined|abc(?:def)?|123)\b/i;

/**
 * A secret-shaped token with near-zero entropy is a placeholder, not a real
 * key. We approximate entropy cheaply: a body made of a single repeated char
 * (xxxxxxxx, 00000000, aaaa...) or with very few distinct characters relative
 * to its length is treated as low-signal.
 */
function isLowEntropy(body) {
  const clean = body.replace(/[-_]/g, '');
  if (clean.length < 8) return false;
  const distinct = new Set(clean.toLowerCase()).size;
  // e.g. "xxxxxxxxxxxx" → 1 distinct, "abababab" → 2. Real provider keys have
  // many distinct chars; a ratio below ~0.2 (or <=2 distinct) is a placeholder.
  if (distinct <= 2) return true;
  if (distinct / clean.length < 0.2) return true;
  return false;
}

const PATTERNS = [
  {
    id: 'aws-access-key-id',
    re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g,
    severity: 'critical',
    title: 'AWS Access Key ID detected',
    description: 'AKIA / ASIA prefix matches an AWS Access Key ID committed in source.',
    recommendation: 'Rotate the AWS access key immediately and remove from source. Use IAM roles or env vars.',
  },
  {
    id: 'stripe-secret-key',
    re: /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/g,
    severity: 'critical',
    title: 'Stripe secret key detected',
    description: 'Stripe sk_live or sk_test key pattern committed to source.',
    recommendation: 'Rotate the Stripe key in the dashboard and remove from source.',
  },
  {
    id: 'stripe-publishable-key',
    re: /\bpk_live_[A-Za-z0-9]{20,}\b/g,
    severity: 'high',
    title: 'Stripe live publishable key detected',
    description: 'Public key, but live keys identify accounts. Test keys are usually fine to commit; live keys are not.',
    recommendation: 'Move to env var or config file in .gitignore.',
  },
  {
    id: 'openai-api-key',
    re: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
    severity: 'critical',
    title: 'OpenAI / Anthropic API key detected',
    description: 'sk- prefixed key pattern matches OpenAI / Anthropic API key format.',
    recommendation: 'Rotate the key with the provider and remove from source.',
    filter: (m) => {
      // 'sk-' followed by an obvious placeholder word or a near-zero-entropy
      // body is not a real key.
      const body = m[0].slice(3);
      if (PLACEHOLDER_WORDS.test(body)) return false;
      if (isLowEntropy(body)) return false;
      return true;
    },
  },
  {
    id: 'github-personal-access-token',
    re: /\b(?:ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]{20,}\b/g,
    severity: 'critical',
    title: 'GitHub Personal Access Token detected',
    description: 'GitHub PAT or fine-grained token format committed in source.',
    recommendation: 'Revoke the token at github.com/settings/tokens and remove from source.',
  },
  {
    id: 'slack-token',
    re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
    severity: 'critical',
    title: 'Slack token detected',
    description: 'xoxb / xoxp / xoxa / xoxr / xoxs token pattern committed in source.',
    recommendation: 'Revoke the Slack token and remove from source.',
  },
  {
    id: 'private-key-pem',
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g,
    severity: 'critical',
    title: 'PEM private key detected',
    description: 'A PEM-encoded private key is being added to the source tree.',
    recommendation: 'Remove the key from source and rotate. Use a secret manager.',
  },
  {
    id: 'google-api-key',
    re: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    severity: 'critical',
    title: 'Google API key detected',
    description: 'AIza prefix matches Google API key format.',
    recommendation: 'Rotate the key in Google Cloud Console and remove from source.',
  },
  {
    id: 'sendgrid-api-key',
    re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g,
    severity: 'critical',
    title: 'SendGrid API key detected',
    description: 'SG. prefixed key matches the SendGrid API key signature.',
    recommendation: 'Revoke the SendGrid key and remove from source.',
  },
  {
    id: 'twilio-api-key-sid',
    re: /\bSK[0-9a-f]{32}\b/g,
    severity: 'critical',
    title: 'Twilio API Key SID detected',
    description: 'SK + 32 hex matches a Twilio API Key SID.',
    recommendation: 'Revoke the Twilio API key and remove from source.',
  },
  {
    id: 'npm-access-token',
    re: /\bnpm_[A-Za-z0-9]{36}\b/g,
    severity: 'critical',
    title: 'npm access token detected',
    description: 'npm_ prefixed token matches an npm automation/access token.',
    recommendation: 'Revoke the token at npmjs.com and remove from source.',
  },
  {
    id: 'pypi-upload-token',
    re: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{20,}\b/g,
    severity: 'critical',
    title: 'PyPI upload token detected',
    description: 'pypi-AgEIcHlwaS5vcmc prefix matches a PyPI API upload token.',
    recommendation: 'Revoke the token at pypi.org and remove from source.',
  },
  {
    id: 'dockerhub-pat',
    re: /\bdckr_pat_[A-Za-z0-9_-]{20,}\b/g,
    severity: 'critical',
    title: 'Docker Hub personal access token detected',
    description: 'dckr_pat_ prefix matches a Docker Hub personal access token.',
    recommendation: 'Revoke the token in Docker Hub settings and remove from source.',
  },
  {
    id: 'mailgun-api-key',
    // `key-` + 32 hex is too generic on its own (any `key-<hash>` slug / cache
    // key / generic identifier matches), so context-gate it like Datadog:
    // require a mailgun-suggestive field name (mailgun…, or mg…key) before the
    // assignment. The marker may be a longer identifier (mailgunKey,
    // MAILGUN_API_KEY) — `\w*` absorbs the trailing field chars up to the
    // assignment. The credential value is captured in group 1.
    re: /(?:mailgun(?:\w*|\.\w+)|mg[_-]?(?:api[_-]?)?key)["'`]?\s*[:=]\s*["'`]?(key-[0-9a-f]{32})\b/gi,
    severity: 'critical',
    title: 'Mailgun API key detected',
    description: 'key- + 32 hex assigned to a Mailgun key field matches the Mailgun API key signature.',
    recommendation: 'Rotate the Mailgun key and remove from source.',
  },
  {
    id: 'generic-jwt',
    // JWT: eyJ + base64ish header.payload.sig. Require dots.
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: 'high',
    title: 'JWT-shaped token detected',
    description: 'A JWT-shaped token is in source. JWTs in source are usually examples but live JWTs leak identity claims.',
    recommendation: 'Verify the token is an example. Otherwise rotate and remove.',
  },
  {
    // Supabase service_role JWT: a JWT whose decoded payload contains the
    // service_role claim. service_role bypasses RLS, so leaking it is critical
    // (far worse than a generic JWT). We match a JWT shape and elevate via
    // pickSeverity when the payload base64-decodes to `"role":"service_role"`.
    id: 'supabase-service-role-jwt',
    re: /\beyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{20,})\.[A-Za-z0-9_-]{10,}\b/g,
    severity: 'critical',
    title: 'Supabase service_role JWT detected',
    description: 'A JWT whose payload contains role=service_role. The service_role key bypasses Row Level Security entirely.',
    recommendation: 'Rotate the Supabase service_role key immediately. Never ship it client-side or commit it.',
    filter: (m) => {
      try {
        const payload = m[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = Buffer.from(payload, 'base64').toString('utf8');
        return /service_role/.test(json);
      } catch {
        return false;
      }
    },
  },
  {
    // Trivial base64 obfuscation: Buffer.from('<b64>', 'base64') whose decoded
    // bytes match a known provider signature (AWS AKIA / OpenAI sk- /
    // GitHub ghp_ / Stripe sk_live_). Catches the laziest "hide the key" move.
    id: 'base64-encoded-credential',
    re: /Buffer\.from\(\s*(["'`])([A-Za-z0-9+/=]{16,})\1\s*,\s*(["'`])base64\3\s*\)/g,
    severity: 'critical',
    title: 'Base64-encoded credential detected',
    description: 'A base64 literal decodes to a known provider credential signature (AWS / OpenAI / GitHub / Stripe). Encoding does not protect the secret.',
    recommendation: 'Remove the encoded secret, rotate the credential, and load it from a secret manager.',
    filter: (m) => {
      try {
        const decoded = Buffer.from(m[2], 'base64').toString('utf8');
        return /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/.test(decoded) ||
          /\bsk-[A-Za-z0-9_-]{20,}\b/.test(decoded) ||
          /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/.test(decoded) ||
          /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/.test(decoded);
      } catch {
        return false;
      }
    },
  },
  {
    id: 'datadog-api-key',
    // Datadog API key = 32 hex. Gate to an explicit datadog/dd context to keep
    // FP low (bare 32-hex is too generic on its own).
    re: /\b(?:datadog|dd)[_-]?(?:api[_-]?key)["'`]?\s*[:=]\s*["'`]([0-9a-f]{32})["'`]/gi,
    severity: 'critical',
    title: 'Datadog API key detected',
    description: 'A 32-hex value assigned to a Datadog api key field.',
    recommendation: 'Rotate the Datadog API key and remove from source.',
  },
];

const SCANNER = makeRegexScanner({
  ruleName: 'hardcoded-credential',
  category: 'secrets',
  patterns: PATTERNS,
});

export const scanFileContent = SCANNER.scanFileContent;
export const scanAddedLines = SCANNER.scanAddedLines;
export const scanDiff = SCANNER.scanDiff;
