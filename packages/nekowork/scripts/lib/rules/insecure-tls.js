// Insecure-TLS rule for verify-pr.
//
// Flags changes that disable TLS certificate verification — a silent
// downgrade that exposes traffic to man-in-the-middle attacks. AI agents
// reach for these to "fix" a self-signed-cert error instead of trusting the
// CA properly.
//   - rejectUnauthorized: false                 (Node https / tls / axios agent)
//   - NODE_TLS_REJECT_UNAUTHORIZED = '0'        (process-wide kill switch)
//   - verify=False                              (Python requests / httpx)
//   - ssl._create_unverified_context()          (Python stdlib bypass)
//   - InsecureSkipVerify: true                  (Go crypto/tls)

import { makeRegexScanner } from './_helpers.js';

const PATTERNS = [
  {
    id: 'reject-unauthorized-false',
    re: /rejectUnauthorized\s*:\s*false/g,
    severity: 'high',
    title: 'TLS verification disabled (rejectUnauthorized: false)',
    description: 'rejectUnauthorized: false turns off TLS certificate validation for the connection — enabling man-in-the-middle attacks.',
    recommendation: 'Trust the proper CA (ca: [...]) instead of disabling verification. Never ship rejectUnauthorized: false.',
  },
  {
    id: 'node-tls-reject-env',
    re: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*(["'`]?)0\1/g,
    severity: 'high',
    title: 'NODE_TLS_REJECT_UNAUTHORIZED=0 (global TLS bypass)',
    description: 'Setting NODE_TLS_REJECT_UNAUTHORIZED to 0 disables certificate validation for the entire Node process.',
    recommendation: 'Remove the override. Configure the trusted CA for the specific request instead.',
  },
  {
    id: 'python-verify-false',
    re: /\bverify\s*=\s*False\b/g,
    severity: 'high',
    title: 'TLS verification disabled (verify=False)',
    description: 'requests/httpx with verify=False skips certificate validation — vulnerable to MITM.',
    recommendation: 'Pass verify="/path/to/ca-bundle.pem" or trust the CA system-wide. Do not use verify=False.',
  },
  {
    id: 'python-unverified-context',
    re: /ssl\._create_unverified_context\s*\(/g,
    severity: 'high',
    title: 'Unverified SSL context (ssl._create_unverified_context)',
    description: 'ssl._create_unverified_context() builds a context that accepts any certificate.',
    recommendation: 'Use ssl.create_default_context() and supply the correct CA bundle.',
  },
  {
    id: 'go-insecure-skip-verify',
    re: /InsecureSkipVerify\s*:\s*true/g,
    severity: 'high',
    title: 'TLS verification disabled (InsecureSkipVerify: true)',
    description: 'Go tls.Config{ InsecureSkipVerify: true } disables certificate validation — vulnerable to MITM.',
    recommendation: 'Set RootCAs to the trusted pool instead of skipping verification.',
  },
  {
    // curl -k / --insecure skips certificate verification for the request.
    // Match `curl` then look ahead on the same line for the insecure flag, so
    // the flag can appear anywhere in the command.
    id: 'curl-insecure',
    re: /\bcurl\b(?=[^\n]*(?:\s-k(?![\w-])|\s--insecure\b))[^\n]*/g,
    severity: 'high',
    title: 'curl with TLS verification disabled (-k / --insecure)',
    description: 'curl -k / --insecure skips TLS certificate verification — the connection is vulnerable to man-in-the-middle.',
    recommendation: 'Remove -k/--insecure and trust the proper CA (--cacert) instead.',
  },
  {
    // wget --no-check-certificate disables cert validation.
    id: 'wget-no-check-certificate',
    re: /\bwget\b[^\n]*\s--no-check-certificate\b[^\n]*/g,
    severity: 'high',
    title: 'wget with TLS verification disabled (--no-check-certificate)',
    description: 'wget --no-check-certificate skips TLS certificate verification — vulnerable to man-in-the-middle.',
    recommendation: 'Remove --no-check-certificate and install/trust the correct CA certificate instead.',
  },
];

const SCANNER = makeRegexScanner({
  ruleName: 'insecure-tls',
  category: 'transport-security',
  patterns: PATTERNS,
});

export const scanFileContent = SCANNER.scanFileContent;
export const scanAddedLines = SCANNER.scanAddedLines;
export const scanDiff = SCANNER.scanDiff;
