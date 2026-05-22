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
      // 'sk-' followed by mostly short / repeating chars is likely a placeholder.
      const body = m[0].slice(3);
      if (/^(?:dev|test|fake|example|fallback|leaked|default)\b/i.test(body)) return false;
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
    id: 'generic-jwt',
    // JWT: eyJ + base64ish header.payload.sig. Require dots.
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: 'high',
    title: 'JWT-shaped token detected',
    description: 'A JWT-shaped token is in source. JWTs in source are usually examples but live JWTs leak identity claims.',
    recommendation: 'Verify the token is an example. Otherwise rotate and remove.',
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
