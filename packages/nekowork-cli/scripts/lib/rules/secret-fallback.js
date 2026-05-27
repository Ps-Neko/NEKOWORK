// Secret Fallback killer rule for verify-pr.
//
// Detects the pattern AI coding agents most commonly introduce: a secret env
// var with a hardcoded fallback. The 1.0 killer because (a) AI produces this
// frequently, (b) regex catches it with usable precision, (c) the blast
// radius is high (leaked secret in repo history).
//
// Out of scope for the regex MVP (deferred to AST or 1.x):
//   - flow-sensitive `let key = process.env.X; if (!key) key = "literal"`
//   - inter-file dataflow
//   - encrypted / wrapped config loaders
//
// Output finding schema matches docs/SCOPE-1.0.md §6 expectations:
//   { id, rule, severity, category, file, line, title, description,
//     recommendation, blocks_apply, match }
import { addedLines as collectAddedLines } from '../diff-parser.js';

const PATTERNS = [
  {
    id: 'env-or-literal',
    re: /process\.env\.(\w+)\s*\|\|\s*(["'`])([^"'`\n]+)\2/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[3],
  },
  {
    id: 'nullish-fallback',
    re: /process\.env\.(\w+)\s*\?\?\s*(["'`])([^"'`\n]+)\2/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[3],
  },
  {
    id: 'ternary',
    re: /process\.env\.(\w+)\s*\?\s*process\.env\.\w+\s*:\s*(["'`])([^"'`\n]+)\2/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[3],
  },
  {
    id: 'destructure-default',
    re: /\{\s*([A-Z_][A-Z0-9_]*)\s*=\s*(["'`])([^"'`]+)\2[^}]*\}\s*=\s*process\.env/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[3],
  },
  {
    id: 'config-or-literal',
    re: /\b([A-Za-z_]\w*\.(?:apiKey|secret|secretKey|token|password|key|jwt|auth))\s*\|\|\s*(["'`])([^"'`\n]+)\2/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[3],
  },
  {
    id: 'config-fallback-property',
    re: /\b[A-Za-z_]\w*\.(?:apiKey|secret|secretKey|token|password|key|jwt|auth)\s*\|\|\s*[A-Za-z_]\w*\.fallback\.\w+/g,
    pickEnv: () => '<config>',
    pickLiteral: () => null,
    severity: 'high',
  },
  {
    id: 'multi-line-or-literal',
    // env || ... || "literal" possibly spanning lines. Limit body to 240 chars
    // to keep the regex bounded.
    re: /process\.env\.(\w+)\s*\|\|[\s\S]{1,240}?(["'`])([^"'`\n]+)\2/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[3],
  },
  {
    // `process.env.JWT_SECRET || ""` and friends. Empty-string fallback is the
    // most common AI-generated anti-pattern in real OSS (see docs/BENCHMARK.md
    // §First real OSS scrape) — it makes a missing secret silently become "",
    // enabling auth bypass / empty-JWT-signing rather than a loud failure.
    //
    // Scope is constrained at the regex level: env name must contain a secret
    // keyword (KEY/TOKEN/SECRET/PASS(WORD)/AUTH/JWT/API/CREDENTIAL or a known
    // provider prefix). This avoids FP on benign `NODE_ENV || ""` / `PORT || ""`.
    id: 'env-or-empty-string',
    re: /process\.env\.([A-Z_][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH|JWT|API|CREDENTIAL|STRIPE|OPENAI|ANTHROPIC|GEMINI|AWS|GCP|AZURE)[A-Z0-9_]*)\s*\|\|\s*(["'`])\2/g,
    pickEnv: m => m[1],
    pickLiteral: () => null,
  },
];

const SECRET_KEYWORDS_RE = /(KEY|TOKEN|SECRET|PASS(?:WORD|WD)?|AUTH|JWT|API|CREDENTIAL|STRIPE|OPENAI|ANTHROPIC|GEMINI|AWS|GCP|AZURE)/i;

const LITERAL_STOPLIST = new Set([
  'true', 'false', 'TRUE', 'FALSE',
  'localhost', '127.0.0.1', '0.0.0.0', '::1',
  'development', 'production', 'test', 'staging', 'dev', 'prod',
  'info', 'debug', 'warn', 'error',
  '',
  '/', '.', './', '../',
]);

function looksSecretLike(literal) {
  if (literal == null) return true;
  if (LITERAL_STOPLIST.has(literal)) return false;
  if (/^\s*$/.test(literal)) return false;
  if (/^-?\d+(?:\.\d+)?$/.test(literal)) return false;
  if (/^https?:\/\//i.test(literal)) return false;
  if (literal.length < 4) return false;
  return true;
}

function envSuggestsSecret(name) {
  if (!name) return false;
  return SECRET_KEYWORDS_RE.test(name);
}

/**
 * Strip comments while preserving line count and char offsets, so line
 * indices computed against the stripped text still map to the original.
 */
function stripCommentsPreservingOffsets(text) {
  let result = text.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, ' '),
  );
  result = result.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  return result;
}

function lineNumberFromIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

/**
 * Scan a single file's content. Used for fixture testing and standalone
 * code scanning.
 *
 * @param {string} filePath
 * @param {string} content
 * @param {object} [opts]
 * @param {number} [opts.lineOffset=0]  add this to every reported line
 *                                       number (useful when the content
 *                                       starts at a non-1 line in the original).
 */
export function scanFileContent(filePath, content, opts = {}) {
  const lineOffset = opts.lineOffset || 0;
  if (typeof content !== 'string' || !content) return [];
  const clean = stripCommentsPreservingOffsets(content);
  const findings = [];
  const seenLines = new Set();

  for (const pat of PATTERNS) {
    pat.re.lastIndex = 0;
    let m;
    while ((m = pat.re.exec(clean)) !== null) {
      const envName = pat.pickEnv(m);
      const literal = pat.pickLiteral(m);

      if (literal != null && !looksSecretLike(literal)) continue;

      const isSecretContext = envSuggestsSecret(envName) ||
        (literal != null && envSuggestsSecret(literal));
      const severity = pat.severity || (isSecretContext ? 'critical' : 'high');

      const line = lineNumberFromIndex(clean, m.index) + lineOffset;
      if (seenLines.has(`${pat.id}:${line}`)) continue;
      seenLines.add(`${pat.id}:${line}`);

      findings.push({
        id: `RULE_SECRET_FALLBACK_${pat.id.toUpperCase().replace(/-/g, '_')}_${findings.length + 1}`,
        rule: 'secret-fallback',
        pattern: pat.id,
        severity,
        category: 'secrets',
        file: filePath,
        line,
        title: severity === 'critical'
          ? 'Hardcoded secret fallback detected'
          : 'Suspicious fallback value detected',
        description: `Pattern: ${pat.id}. Environment or config variable falls back to a hardcoded value when missing.`,
        recommendation: 'Remove the hardcoded fallback. Fail closed when the secret is absent (throw or exit).',
        blocks_apply: severity === 'critical',
        match: m[0].slice(0, 160).replace(/\s+/g, ' '),
      });
    }
  }

  return dedupePreferCritical(findings);
}

/**
 * Multiple patterns may match overlapping ranges on the same line. If both
 * critical and high fire on the same file:line, keep the critical.
 */
function dedupePreferCritical(findings) {
  const byLine = new Map();
  for (const f of findings) {
    const key = `${f.file}:${f.line}`;
    const prev = byLine.get(key);
    if (!prev) { byLine.set(key, f); continue; }
    if (f.severity === 'critical' && prev.severity !== 'critical') {
      byLine.set(key, f);
    }
  }
  return [...byLine.values()].sort((a, b) => a.line - b.line);
}

/**
 * Scan a parsed diff. Reconstructs each file's added content with original
 * line offsets so multi-line patterns work and finding lines match the
 * post-merge file.
 *
 * @param {ReturnType<typeof import('../diff-parser.js').parseDiff>} parsedDiff
 */
export function scanDiff(parsedDiff) {
  if (!parsedDiff || !Array.isArray(parsedDiff.files)) return [];
  const added = collectAddedLines(parsedDiff);
  return scanAddedLines(added);
}

/**
 * Scan a flat array of `{ path, line, content }` added lines.
 * Groups by file, then reconstructs contiguous text blocks while remembering
 * the original line numbers, so multi-line patterns can match across
 * adjacent added lines.
 */
export function scanAddedLines(addedLines) {
  if (!Array.isArray(addedLines)) return [];
  const byFile = new Map();
  for (const entry of addedLines) {
    if (!byFile.has(entry.path)) byFile.set(entry.path, []);
    byFile.get(entry.path).push(entry);
  }

  const findings = [];
  for (const [filePath, entries] of byFile.entries()) {
    entries.sort((a, b) => a.line - b.line);
    let block = [];
    let blockStart = null;
    const flushBlock = () => {
      if (!block.length) return;
      const content = block.join('\n');
      const local = scanFileContent(filePath, content, { lineOffset: blockStart - 1 });
      findings.push(...local);
      block = [];
      blockStart = null;
    };
    let prev = null;
    for (const entry of entries) {
      if (prev != null && entry.line !== prev + 1) flushBlock();
      if (block.length === 0) blockStart = entry.line;
      block.push(entry.content);
      prev = entry.line;
    }
    flushBlock();
  }

  return dedupePreferCritical(findings);
}
