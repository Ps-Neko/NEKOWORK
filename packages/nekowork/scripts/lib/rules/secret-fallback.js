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
import {
  stripCommentsPreservingOffsets,
  lineNumberFromIndex,
} from './_helpers.js';

const PATTERNS = [
  {
    id: 'env-or-literal',
    // dot form  process.env.X || "lit"  and bracket form  process.env['X'] || "lit"
    re: /process\.env(?:\.(\w+)|\[(["'`])(\w+)\2\])\s*\|\|\s*(["'`])([^"'`\n]+)\4/g,
    pickEnv: m => m[1] || m[3],
    pickLiteral: m => m[5],
  },
  {
    id: 'nullish-fallback',
    re: /process\.env\.(\w+)\s*\?\?\s*(["'`])([^"'`\n]+)\2/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[3],
  },
  {
    // Parenthesized / concatenated / ternary fallback after || or ?? for the
    // DOT form. Catches the bypass shapes a plain `|| "lit"` regex misses:
    //   process.env.X || ('fall' + 'back')
    //   process.env.SECRET ?? ("a" + "b")
    //   process.env.API_KEY || (cond ? 'x' : 'y')
    // The RHS is captured up to the statement end; pickLiteral is null because
    // the value is an expression, so severity is decided by the env name +
    // expressionLooksLikeFallback() (which rejects fail-closed throw/exit).
    id: 'env-paren-expr-fallback',
    re: /process\.env\.(\w+)\s*(?:\|\||\?\?)\s*(\([^\n;]*\))/g,
    pickEnv: m => m[1],
    pickLiteral: () => null,
    pickRhs: m => m[2],
    requireSecretEnv: true,
  },
  {
    // Secret-like env name with ANY non-fail-closed fallback expression after
    // || or ??, regardless of the RHS literal shape:
    //   process.env.JWT_SECRET || someDefaultVar
    //   process.env.API_KEY || getKey()
    //   process.env.AUTH_TOKEN || config.fallback
    // Fail-closed RHS (throw / process.exit / assert) is excluded by
    // expressionLooksLikeFallback. The env name MUST look secret-like
    // (requireSecretEnv) so benign defaults like `process.env.PORT || 3000`
    // never reach this pattern. RHS stops at the statement boundary.
    id: 'env-secretname-expr-fallback',
    re: /process\.env\.([A-Z_][A-Z0-9_]*)\s*(?:\|\||\?\?)\s*([^\n;]+)/g,
    pickEnv: m => m[1],
    pickLiteral: () => null,
    pickRhs: m => m[2],
    requireSecretEnv: true,
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
    // dot form  obj.secretProp || "lit"  and bracket form  obj['SECRET_KEY'] || "lit".
    // The bracket key is gated to secret-keyword names so generic config defaults
    // (e.g. config['timeout'] || 5000) do not match.
    re: /\b([A-Za-z_]\w*\.(?:apiKey|secret|secretKey|token|password|key|jwt|auth)|[A-Za-z_]\w*\[(["'`])[\w-]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH|JWT|API|CREDENTIAL|apiKey|secretKey)[\w-]*\2\])\s*\|\|\s*(["'`])([^"'`\n]+)\3/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[4],
  },
  {
    // Flow-sensitive: `let t = process.env.X; if (!t) t = "literal";` spread
    // across 2-3 lines. The variable name is captured at the env read and
    // back-referenced in the if-reassignment, so we only match when the SAME
    // variable that holds the env value is reassigned to a hardcoded literal.
    // Crucially the if-body must be a literal assignment (`var = "..."`), NOT a
    // throw / return / log — that is what distinguishes this from fail-closed
    // code like `if (!key) { throw ... }`. Lookahead window is bounded to ~2
    // following lines (240 chars) to keep it local and avoid runaway matches.
    id: 'if-not-fallback',
    re: /\b(?:const|let|var)\s+(\w+)\s*=\s*process\.env\.(\w+)[^\n]*;?[\s\S]{0,160}?\bif\s*\(\s*!\s*\1\s*\)\s*\{?\s*\1\s*=\s*(["'`])([^"'`\n]+)\3/g,
    pickEnv: m => m[2],
    pickLiteral: m => m[4],
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
    // Skip fail-closed bodies: `process.env.X || (() => { throw "..." })()` is a
    // guard, not a hardcoded fallback. The string literal here is the error
    // message, not a leaked secret. Without this filter the message text would
    // be mis-read as a fallback value.
    filter: m => !FAIL_CLOSED_RE.test(m[0]),
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
  {
    // Bracket form of the env-or-empty-string anti-pattern:
    //   process.env['JWT_SECRET'] || ''
    // The dotted form is handled above; bracket access is common in TS strict
    // configs and from AI tools that normalize to string-key access. Same
    // secret-keyword gate to avoid FP on process.env['PORT'] || ''.
    id: 'env-bracket-or-empty-string',
    re: /process\.env\[(["'`])([A-Z_][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH|JWT|API|CREDENTIAL|STRIPE|OPENAI|ANTHROPIC|GEMINI|AWS|GCP|AZURE)[A-Z0-9_]*)\1\]\s*\|\|\s*(["'`])\3/g,
    pickEnv: m => m[2],
    pickLiteral: () => null,
  },
  {
    // Bracket form with a non-empty literal fallback:
    //   process.env['API_KEY'] || 'literal'   /   ?? 'literal'
    id: 'env-bracket-or-literal',
    re: /process\.env\[(["'`])(\w+)\1\]\s*(?:\|\||\?\?)\s*(["'`])([^"'`\n]+)\3/g,
    pickEnv: m => m[2],
    pickLiteral: m => m[4],
  },
  {
    // Deno.env.get('X') || 'lit'  /  ?? 'lit'
    id: 'deno-env-or-literal',
    re: /Deno\.env\.get\(\s*(["'`])(\w+)\1\s*\)\s*(?:\|\||\?\?)\s*(["'`])([^"'`\n]+)\3/g,
    pickEnv: m => m[2],
    pickLiteral: m => m[4],
  },
  {
    // Bun.env.X || 'lit'  and  Bun.env['X'] || 'lit'
    id: 'bun-env-or-literal',
    re: /Bun\.env(?:\.(\w+)|\[(["'`])(\w+)\2\])\s*(?:\|\||\?\?)\s*(["'`])([^"'`\n]+)\4/g,
    pickEnv: m => m[1] || m[3],
    pickLiteral: m => m[5],
  },
  {
    // import.meta.env.VITE_X || 'lit' (Vite / Astro / SvelteKit) and the
    // bracket variant. Vite exposes only VITE_-prefixed vars to the client,
    // so a hardcoded fallback there is a shipped-to-browser secret leak.
    id: 'import-meta-env-or-literal',
    re: /import\.meta\.env(?:\.(\w+)|\[(["'`])(\w+)\2\])\s*(?:\|\||\?\?)\s*(["'`])([^"'`\n]+)\4/g,
    pickEnv: m => m[1] || m[3],
    pickLiteral: m => m[5],
  },
  {
    // Python: os.environ.get('X', 'fallback')  /  os.getenv('X', 'fallback')
    // The default argument IS the fallback. Gated by looksSecretLike + the
    // secret-keyword env check downstream, so os.getenv('PORT', '3000') with a
    // numeric/known-benign default is filtered.
    id: 'python-getenv-default',
    re: /\bos\.(?:environ\.get|getenv)\(\s*(["'`])(\w+)\1\s*,\s*(["'`])([^"'`\n]+)\3\s*\)/g,
    pickEnv: m => m[2],
    pickLiteral: m => m[4],
  },
  {
    // Ruby: ENV.fetch('X', 'fallback')
    id: 'ruby-env-fetch-default',
    re: /\bENV\.fetch\(\s*(["'`])(\w+)\1\s*,\s*(["'`])([^"'`\n]+)\3\s*\)/g,
    pickEnv: m => m[2],
    pickLiteral: m => m[4],
  },
  {
    // Ruby: ENV['X'] || 'fallback'
    id: 'ruby-env-or-literal',
    re: /\bENV\[(["'`])(\w+)\1\]\s*\|\|\s*(["'`])([^"'`\n]+)\3/g,
    pickEnv: m => m[2],
    pickLiteral: m => m[4],
  },
  {
    // Go: os.Getenv("X") followed (within ~2 lines) by an if-empty default
    //   token := os.Getenv("AUTH_TOKEN")
    //   if token == "" { token = "literal" }
    // The variable is back-referenced so we only fire when the same var read
    // from the env is reassigned to a hardcoded literal — mirrors the JS
    // if-not-fallback flow heuristic.
    id: 'go-getenv-if-empty',
    re: /\b(\w+)\s*:?=\s*os\.Getenv\(\s*"(\w+)"\s*\)[\s\S]{0,160}?\bif\s+\1\s*==\s*""\s*\{\s*\1\s*=\s*"([^"\n]+)"/g,
    pickEnv: m => m[2],
    pickLiteral: m => m[3],
  },
  {
    // Java: System.getenv("X") ... orElse / coalesced default. Common shapes:
    //   String s = System.getenv("X"); if (s == null) s = "literal";
    //   Optional.ofNullable(System.getenv("X")).orElse("literal")
    id: 'java-getenv-orelse',
    re: /System\.getenv\(\s*"(\w+)"\s*\)[^\n;]{0,80}?\.orElse\(\s*"([^"\n]+)"\s*\)/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[2],
  },
  {
    // Java flow form: String t = System.getenv("X"); if (t == null) t = "lit";
    id: 'java-getenv-if-null',
    re: /\b(?:String|var)\s+(\w+)\s*=\s*System\.getenv\(\s*"(\w+)"\s*\)\s*;[\s\S]{0,160}?\bif\s*\(\s*\1\s*==\s*null\s*\)\s*\{?\s*\1\s*=\s*"([^"\n]+)"/g,
    pickEnv: m => m[2],
    pickLiteral: m => m[3],
  },
  {
    // Rust: std::env::var("X").unwrap_or("literal") / unwrap_or_else(|_| "lit"..)
    // Accept both std::env::var and an imported `env::var`.
    id: 'rust-env-var-unwrap-or',
    re: /(?:std::)?env::var\(\s*"(\w+)"\s*\)\s*\.unwrap_or(?:_else)?\(\s*(?:\|_\|\s*)?(?:String::from\(\s*)?"([^"\n]+)"/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[2],
  },
  {
    // C#: Environment.GetEnvironmentVariable("X") ?? "literal"
    id: 'csharp-getenv-coalesce',
    re: /Environment\.GetEnvironmentVariable\(\s*"(\w+)"\s*\)\s*\?\?\s*"([^"\n]+)"/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[2],
  },
  {
    // PHP: getenv('X') ?: 'literal'  (Elvis operator default)
    id: 'php-getenv-elvis',
    re: /\bgetenv\(\s*(["'])(\w+)\1\s*\)\s*\?:\s*(["'])([^"'\n]+)\3/g,
    pickEnv: m => m[2],
    pickLiteral: m => m[4],
  },
  {
    // Elixir: System.get_env("X", "literal")  (2-arg form: 2nd arg is default)
    id: 'elixir-get-env-default',
    re: /System\.get_env\(\s*"(\w+)"\s*,\s*"([^"\n]+)"\s*\)/g,
    pickEnv: m => m[1],
    pickLiteral: m => m[2],
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

// A fallback RHS that FAILS CLOSED is the correct, safe pattern and must NOT be
// flagged: `process.env.SECRET || (() => { throw ... })()`,
// `process.env.KEY ?? process.exit(1)`, `... || assert(...)`. We only flag when
// the RHS provides a usable VALUE rather than aborting.
const FAIL_CLOSED_RE = /\b(?:throw|process\.exit|assert(?:\.\w+)?|panic|abort|fatalError|raise)\b/;

/**
 * For the expression-RHS patterns (no captured string literal), decide whether
 * the RHS looks like a real fallback VALUE (flag) versus a fail-closed guard
 * (do not flag). Empty RHS is not a fallback.
 */
function expressionLooksLikeFallback(rhs) {
  if (rhs == null) return false;
  const trimmed = String(rhs).trim();
  if (!trimmed) return false;
  if (FAIL_CLOSED_RE.test(trimmed)) return false;
  return true;
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
      if (pat.filter && !pat.filter(m)) continue;
      const envName = pat.pickEnv(m);
      const literal = pat.pickLiteral(m);

      if (literal != null && !looksSecretLike(literal)) continue;

      // Expression-RHS patterns (pickRhs): only fire when the env name looks
      // secret-like AND the RHS is a real fallback value (not a fail-closed
      // throw/exit/assert). This is what catches concat / ternary /
      // parenthesized / variable fallbacks without FP on PORT || 3000.
      if (pat.pickRhs) {
        if (pat.requireSecretEnv && !envSuggestsSecret(envName)) continue;
        if (!expressionLooksLikeFallback(pat.pickRhs(m))) continue;
      } else if (pat.requireSecretEnv && !envSuggestsSecret(envName)) {
        continue;
      }

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
