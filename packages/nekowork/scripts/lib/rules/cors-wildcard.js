// CORS-Wildcard rule for verify-pr.
//
// Flags permissive CORS that exposes an API to any origin:
//   - res.setHeader('Access-Control-Allow-Origin', '*')   (raw header)
//   - cors({ origin: '*', credentials: true })            (express cors mw)
//   - Access-Control-Allow-Origin: '*'                    (object/config form)
//
// Severity: MEDIUM for a bare wildcard (broad but a common public-API choice);
// HIGH when the wildcard is combined with credentials, which browsers forbid
// for good reason — wildcard + credentials leaks authenticated responses to
// any site. Benign explicit-origin config (origin: 'https://app.example.com')
// is NOT flagged.

import { makeRegexScanner } from './_helpers.js';

// Credentials are enabled somewhere in the same scanned block.
const CREDENTIALS_RE = /(?:credentials\s*:\s*true|Access-Control-Allow-Credentials["'`]?\s*[:,]\s*(?:true|["'`]true["'`]))/i;

function wildcardSeverity(_m, content) {
  return CREDENTIALS_RE.test(content) ? 'high' : 'medium';
}

const PATTERNS = [
  {
    // res.setHeader('Access-Control-Allow-Origin', '*') and .header(...) /
    // .set(...) variants.
    id: 'acao-set-header-wildcard',
    re: /\.(?:setHeader|set|header)\s*\(\s*(["'`])Access-Control-Allow-Origin\1\s*,\s*(["'`])\*\2/g,
    pickSeverity: wildcardSeverity,
    title: 'CORS wildcard origin in response header',
    description: 'Access-Control-Allow-Origin: * allows any website to read responses from this endpoint.',
    recommendation: 'Reflect an explicit allow-list of origins instead of "*", especially if the endpoint is authenticated.',
  },
  {
    // Object / config literal:  'Access-Control-Allow-Origin': '*'  or
    // "Access-Control-Allow-Origin": "*"
    id: 'acao-config-wildcard',
    re: /(["'`])Access-Control-Allow-Origin\1\s*:\s*(["'`])\*\2/g,
    pickSeverity: wildcardSeverity,
    title: 'CORS wildcard origin in config',
    description: 'Access-Control-Allow-Origin set to "*" in a headers config allows any origin.',
    recommendation: 'Use an explicit origin allow-list. Wildcard + credentials is especially dangerous.',
  },
  {
    // cors({ origin: '*' ... })  — express cors middleware. Bounded lookahead so
    // we only match origin:'*' within a cors(...) options object.
    id: 'cors-mw-wildcard-origin',
    re: /\bcors\s*\(\s*\{[^}]*\borigin\s*:\s*(["'`])\*\1/g,
    pickSeverity: wildcardSeverity,
    title: 'CORS middleware configured with wildcard origin',
    description: 'cors({ origin: "*" }) accepts requests from any origin. Combined with credentials it leaks authenticated data.',
    recommendation: 'Pass an explicit origin (string | array | function) to the cors middleware.',
  },
  {
    // Django django-cors-headers: CORS_ALLOW_ALL_ORIGINS = True opens the API
    // to every origin. (Legacy alias CORS_ORIGIN_ALLOW_ALL = True too.)
    id: 'django-cors-allow-all',
    re: /\bCORS_(?:ALLOW_ALL_ORIGINS|ORIGIN_ALLOW_ALL)\s*=\s*True\b/g,
    pickSeverity: wildcardSeverity,
    title: 'Django CORS allows all origins',
    description: 'CORS_ALLOW_ALL_ORIGINS = True (django-cors-headers) accepts requests from any origin.',
    recommendation: 'Set CORS_ALLOWED_ORIGINS to an explicit allow-list instead of allowing all origins.',
  },
  {
    // FastAPI / Starlette CORSMiddleware: allow_origins=["*"] (or ('*',)).
    id: 'fastapi-allow-origins-wildcard',
    re: /allow_origins\s*=\s*[[(]\s*(["'])\*\1\s*[,]?\s*[\])]/g,
    pickSeverity: (m, content) =>
      /allow_credentials\s*=\s*True/i.test(content) ? 'high' : wildcardSeverity(m, content),
    title: 'FastAPI CORS configured with wildcard origin',
    description: 'CORSMiddleware allow_origins=["*"] accepts requests from any origin. With allow_credentials=True this leaks authenticated responses.',
    recommendation: 'Pass an explicit list of allowed origins to allow_origins instead of ["*"].',
  },
];

const SCANNER = makeRegexScanner({
  ruleName: 'cors-wildcard',
  category: 'access-control',
  patterns: PATTERNS,
});

export const scanFileContent = SCANNER.scanFileContent;
export const scanAddedLines = SCANNER.scanAddedLines;
export const scanDiff = SCANNER.scanDiff;
