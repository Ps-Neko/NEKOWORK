// Shared verify-pr helpers — single source of truth for the deterministic
// verify-pr pipeline pieces. Both the slim @ps-neko/nekowork verify-pr
// orchestrator AND the heavy @ps-neko/nekowork-harness verify-pr orchestrator
// import from here, so the verdict logic, file classification, rule set, and
// report/comment rendering can never drift between the two packages.
//
// Shared library module — keep additive only; do not change the public surface
// in a way that breaks either consumer.

import fs from 'node:fs';
import path from 'node:path';
import { getGitDiff, loadDiffFile, rangeHeadRef } from './diff-parser.js';
import { scanDiff as scanSecretFallback } from './rules/secret-fallback.js';
import { scanDiff as scanAutoApply } from './rules/auto-apply-commit-push.js';
import { scanDiff as scanHardcodedCredential } from './rules/hardcoded-credential.js';
import { scanDiff as scanTestDisable } from './rules/test-or-security-disable.js';
import { scanDiff as scanPackageRisk } from './rules/package-lockfile-risk.js';
import { scanDiff as scanEvalUsage } from './rules/eval-usage.js';
import { scanDiff as scanInsecureTls } from './rules/insecure-tls.js';
import { scanDiff as scanCorsWildcard } from './rules/cors-wildcard.js';
import { scanDiff as scanSqlInjection } from './rules/sql-injection.js';
import { scanDiff as scanCommandInjection } from './rules/command-injection.js';
import { scanDiff as scanAstDataflow } from './rules/ast-dataflow.js';

export const SCHEMA_VERSION = 'verify-pr-v0';

// The deterministic rule units runRules() scans, in execution order. Surfaced in
// the evidence package's rule-version.json so a verdict is reproducible against a
// known ruleset. The `ast-dataflow` unit emits sub-ids per sink class
// (ast-eval-injection / ast-sql-injection / ast-command-injection); it is listed
// here as the single scanner unit it is. Keep in sync with runRules().
export const RULE_IDS = Object.freeze([
  'secret-fallback',
  'auto-apply-commit-push',
  'hardcoded-credential',
  'test-or-security-disable',
  'package-lockfile-risk',
  'eval-usage',
  'insecure-tls',
  'cors-wildcard',
  'sql-injection',
  'command-injection',
  'ast-dataflow',
]);

// Number of deterministic rules runRules() scans. Surfaced in the report so an
// ALLOW states exactly how much was checked. Keep in sync with runRules().
export const RULE_COUNT = RULE_IDS.length;

// Scope disclaimer for clean/low verdicts. An ALLOW must never read as "this
// code is safe" — it means the deterministic rules found nothing, NOT that the
// change passed an exhaustive audit. Concise, on purpose.
export const ALLOW_SCOPE_NOTE =
  `No findings from the ${RULE_COUNT} deterministic rules scanned (secrets, secret fallbacks, ` +
  'hardcoded credentials, auto-commit/push, insecure TLS, eval/dynamic-exec, CORS wildcard, ' +
  'risky deps/install hooks, test/security disables, SQL & command injection, and AST dataflow ' +
  '(variable-mediated SQL/command/eval injection)). ' +
  'This is NOT an exhaustive security audit — logic bugs, auth/authorization flaws, and any ' +
  'vector outside these rules are out of scope. A clean result means "nothing the rules catch", ' +
  'not "this code is safe".';

// Machine-readable scope of the gate, attached to EVERY decision. It lets a
// consumer programmatically tell that a clean verdict (ALLOW / ALLOW_WITH_WARNINGS)
// means "no findings from the deterministic rules", NOT "this change is safe" —
// the structured counterpart of the ALLOW_SCOPE_NOTE prose in REPORT.md.
//
// Why a field and not a rename: renaming the verdict tokens (e.g. ALLOW →
// PASS_RISK_SCAN) would break the PUBLISHED verify-pr-v0 wire contract that
// external CI already branches on. This additive field closes the "ALLOW reads
// as 'safe'" gap with zero breakage; the token rename is deferred to the v1
// schema (2.0). Additive only — both slim and heavy build decisions here.
export const VERDICT_SCOPE = Object.freeze({
  engine: 'deterministic-rules',
  rules_scanned: RULE_COUNT,
  note: 'A clean verdict means no findings from the deterministic rules — NOT that the change is safe or fully verified.',
  out_of_scope: Object.freeze(['logic-bugs', 'auth-flaws', 'cross-file-dataflow', 'dependency-cves']),
});

export const VERDICT = Object.freeze({
  ALLOW: 'ALLOW',
  ALLOW_WITH_WARNINGS: 'ALLOW_WITH_WARNINGS',
  NEEDS_HUMAN_REVIEW: 'NEEDS_HUMAN_REVIEW',
  BLOCK: 'BLOCK',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
});

export const EXIT_CODE = Object.freeze({
  [VERDICT.ALLOW]: 0,
  [VERDICT.ALLOW_WITH_WARNINGS]: 0,
  [VERDICT.NEEDS_HUMAN_REVIEW]: 1,
  [VERDICT.INSUFFICIENT_EVIDENCE]: 1,
  [VERDICT.BLOCK]: 2,
});

/** Map an internal diff mode to the canonical evidence-manifest input_source. */
export function inputSourceForMode(mode) {
  switch (mode) {
    case 'staged': return 'staged';
    case 'range': return 'range';
    case 'patch': return 'patch';
    case 'full': return 'full_scan';
    case 'working':
    default: return 'working_tree';
  }
}

// parsedDiff 에 mode + postRef(=AST 가 post-change 내용을 읽을 git ref) 를 새긴다.
// 단일 funnel 이라 양 패키지(슬림·헤비)가 자동으로 같은 정보를 받는다.
function tagDiff(parsed, mode, postRef) {
  if (parsed && typeof parsed === 'object') { parsed.mode = mode; parsed.postRef = postRef; }
  return parsed;
}

export function loadDiff({ mode, projectRoot, opts }) {
  const includePaths = opts.includePaths;
  if (mode === 'patch') {
    if (!opts.patchPath) throw new Error('mode=patch requires --from-patch <file>');
    // patch 는 디스크가 패치와 일치한다는 보장이 없어 AST 디스크 읽기를 건너뛰게 표시(regex 유지).
    return tagDiff(loadDiffFile(opts.patchPath), 'patch', null);
  }
  if (mode === 'range') {
    if (!opts.range) throw new Error('mode=range requires --range <ref>');
    return tagDiff(getGitDiff({ cwd: projectRoot, mode: 'range', range: opts.range, includePaths }), 'range', rangeHeadRef(opts.range));
  }
  if (mode === 'staged') {
    return tagDiff(getGitDiff({ cwd: projectRoot, mode: 'staged', includePaths }), 'staged', null);
  }
  if (mode === 'full') {
    return tagDiff(getGitDiff({ cwd: projectRoot, mode: 'full', includePaths }), 'full', null);
  }
  return tagDiff(getGitDiff({ cwd: projectRoot, mode: 'working', includePaths }), 'working', null);
}

/**
 * Run every deterministic risk rule against a parsed diff.
 *
 * @param {object} parsedDiff
 * @param {{ projectRoot?: string }} [opts]  projectRoot enables the AST dataflow
 *   rule, which needs full file content (read from disk). When omitted (e.g. the
 *   heavy package's call, or --from-patch with no working copy) the AST rule
 *   no-ops gracefully and the regex rules still run.
 */
export function runRules(parsedDiff, opts = {}) {
  const findings = [];
  findings.push(...scanSecretFallback(parsedDiff));
  findings.push(...scanAutoApply(parsedDiff));
  findings.push(...scanHardcodedCredential(parsedDiff));
  findings.push(...scanTestDisable(parsedDiff));
  findings.push(...scanPackageRisk(parsedDiff));
  findings.push(...scanEvalUsage(parsedDiff));
  findings.push(...scanInsecureTls(parsedDiff));
  findings.push(...scanCorsWildcard(parsedDiff));
  findings.push(...scanSqlInjection(parsedDiff));
  findings.push(...scanCommandInjection(parsedDiff));
  // AST dataflow runs last. It only fires with a projectRoot (whole-file read);
  // drop any AST finding that lands on the SAME file:line as an injection-class
  // regex finding (the regex rule already reported the single-line shape — the
  // AST rule's value is the cross-statement form the regex misses).
  const astFindings = scanAstDataflow(parsedDiff, { projectRoot: opts.projectRoot });
  const regexSinkLines = new Set(
    findings
      .filter(f => /injection|code-injection/.test(f.category || '') ||
        ['eval-usage', 'sql-injection', 'command-injection'].includes(f.rule))
      .map(f => `${f.file}:${f.line}`),
  );
  for (const f of astFindings) {
    if (regexSinkLines.has(`${f.file}:${f.line}`)) continue;
    findings.push(f);
  }
  return findings;
}

export function describeChecks(project) {
  return {
    test: Boolean(project.hasTests),
    lint: Boolean(project.hasLint),
    typecheck: Boolean(project.hasTypecheck),
    build: Boolean(project.hasBuild),
    audit: Boolean(project.hasAudit),
  };
}

export function classifyChangedFiles(parsedDiff) {
  const source = [];
  const tests = [];
  const docs = [];
  const config = [];
  const ci = [];
  const binary = [];
  for (const f of parsedDiff.files || []) {
    const p = f.path.toLowerCase();
    // Binary files have no reviewable text content, so they must not count as
    // 'source' — otherwise a binary-only change triggers INSUFFICIENT_EVIDENCE
    // ("source change with no test command") despite having nothing to verify.
    if (f.binary) binary.push(f.path);
    else if (/(^|\/)tests?\/|\.test\.|\.spec\./.test(p)) tests.push(f.path);
    else if (/\.(md|rst|txt)$/.test(p) || /^docs\//.test(p) || /readme/i.test(p)) docs.push(f.path);
    // CI must be checked BEFORE config: `.github/workflows/*.yml` is CI, not a
    // generic config file. The config regex would otherwise swallow it.
    else if (/^\.github\/|^\.gitlab-ci|^\.circleci|jenkinsfile/i.test(f.path)) ci.push(f.path);
    else if (/\.(json|toml|yaml|yml|ini|cfg)$/.test(p)) config.push(f.path);
    else source.push(f.path);
  }
  return { source, tests, docs, config, ci, binary };
}

/**
 * The deterministic verdict derived purely from rule findings + check
 * availability (the slim verdict-from-findings function). Heavy layers its
 * --run-checks extension on top: a failed check downgrades ALLOW* to
 * NEEDS_HUMAN_REVIEW, but a check failure never produces a standalone BLOCK.
 */
export function deriveRiskVerdict({ findings, classified, checksAvailable, behaviorVerified = true }) {
  const hasCritical = findings.some(f => f.severity === 'critical');
  const hasHigh = findings.some(f => f.severity === 'high');
  const hasMediumOrLow = findings.some(f => f.severity === 'medium' || f.severity === 'low');
  const hasSourceChanges = classified.source.length > 0;
  const docsOnly = classified.source.length === 0 && classified.tests.length === 0 &&
    (classified.docs.length > 0 || classified.config.length > 0);

  if (hasCritical) {
    return {
      verdict: VERDICT.BLOCK,
      reason: firstCriticalReason(findings),
      apply_allowed: false,
    };
  }
  if (hasHigh) {
    return {
      verdict: VERDICT.NEEDS_HUMAN_REVIEW,
      reason: 'HIGH severity finding requires human review',
      apply_allowed: false,
    };
  }
  // A SOURCE change can carry behavioral regressions that pattern scanning
  // cannot see, so the verdict may only read as ALLOW when behavior was actually
  // verified. That fails two ways: (1) the project has no test command at all, or
  // (2) behaviorVerified is false — the gate that produced this verdict does not
  // execute the project's checks. The published slim @ps-neko/nekowork gate
  // DETECTS patterns but never runs tests/lint/typecheck (execution lives in the
  // @ps-neko/nekowork-harness runtime), so it passes behaviorVerified:false.
  // Either way a clean scan is "no bad patterns found", never "verified safe".
  // The parameter defaults to true so heavy/legacy callers keep their behavior.
  if (hasSourceChanges && (!checksAvailable.test || !behaviorVerified)) {
    return {
      verdict: VERDICT.INSUFFICIENT_EVIDENCE,
      reason: !checksAvailable.test
        ? 'risk scan passed (no blocking findings), but this project has no test command — full verification needs one. This is "not enough evidence", not a failure.'
        : 'risk scan passed (no blocking findings), but behavior was not verified — this gate detects patterns, it does not run your tests. Run the suite via CI or the @ps-neko/nekowork-harness runtime (or pass --ci-exit-soft to keep CI non-blocking). This is "not enough evidence", not a failure.',
      apply_allowed: false,
    };
  }
  if (hasMediumOrLow) {
    return {
      verdict: VERDICT.ALLOW_WITH_WARNINGS,
      reason: 'lower-severity findings present',
      apply_allowed: true,
    };
  }
  if (docsOnly) {
    return {
      verdict: VERDICT.ALLOW,
      reason: 'docs/config only, no findings',
      apply_allowed: true,
    };
  }
  return {
    verdict: VERDICT.ALLOW,
    reason: 'no findings',
    apply_allowed: true,
  };
}

export function firstCriticalReason(findings) {
  const critical = findings.find(f => f.severity === 'critical');
  if (!critical) return 'CRITICAL finding present';
  return `${critical.title} (${critical.file}:${critical.line})`;
}

/**
 * Build the decision object. `classified` is the result of
 * classifyChangedFiles() (computed once and threaded through). `extra` is merged
 * verbatim so the heavy package can attach its `checks` block without forking
 * this function.
 */
export function buildVerifyPrDecision({ verdict, findings, parsedDiff, classified, project, checksAvailable, extra = {} }) {
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    verdict: verdict.verdict,
    reason: verdict.reason,
    apply_allowed: verdict.apply_allowed,
    merge_allowed: verdict.verdict === VERDICT.ALLOW || verdict.verdict === VERDICT.ALLOW_WITH_WARNINGS,
    risk_level: deriveRiskLevel(findings),
    finding_counts: countBySeverity(findings),
    changed_files: {
      total: parsedDiff.totalFiles,
      additions: parsedDiff.totalAdditions,
      deletions: parsedDiff.totalDeletions,
      ...classified,
    },
    project: {
      type: project.projectType,
      package_manager: project.packageManager,
      checks_available: checksAvailable,
    },
    // Additive: machine-readable gate scope so a clean verdict is never read as
    // "safe". See VERDICT_SCOPE. Token rename (ALLOW → PASS_RISK_SCAN) deferred
    // to the v1 schema to avoid breaking the published verify-pr-v0 contract.
    scope: VERDICT_SCOPE,
    findings,
    ...extra,
  };
}

export function deriveRiskLevel(findings) {
  if (findings.some(f => f.severity === 'critical')) return 'CRITICAL';
  if (findings.some(f => f.severity === 'high')) return 'HIGH';
  if (findings.some(f => f.severity === 'medium')) return 'MEDIUM';
  if (findings.length > 0) return 'LOW';
  // Zero findings is distinct from "low-severity findings present" — report
  // NONE so an ALLOW with nothing flagged never reads as "low risk".
  return 'NONE';
}

export function countBySeverity(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    if (counts[f.severity] != null) counts[f.severity]++;
  }
  return counts;
}

/**
 * Render the GitHub PR comment markdown. When a decision carries a `checks`
 * block (heavy --run-checks), a Checks row is appended.
 */
export function renderPrComment(decision, findings) {
  const emoji = {
    [VERDICT.ALLOW]: '✅',
    [VERDICT.ALLOW_WITH_WARNINGS]: '⚠️',
    [VERDICT.NEEDS_HUMAN_REVIEW]: '👀',
    [VERDICT.INSUFFICIENT_EVIDENCE]: '🔍',
    [VERDICT.BLOCK]: '🛑',
  };
  const lines = [];
  lines.push(`### ${emoji[decision.verdict] || ''} NEKOWORK verify-pr: \`${decision.verdict}\``);
  lines.push('');
  lines.push(`**Reason:** ${decision.reason}`);
  lines.push('');
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Merge allowed | ${decision.merge_allowed ? 'yes' : '**no**'} |`);
  lines.push(`| Apply allowed | ${decision.apply_allowed ? 'yes' : '**no**'} |`);
  lines.push(`| Risk level | ${decision.risk_level} |`);
  lines.push(`| Findings | critical=${decision.finding_counts.critical} high=${decision.finding_counts.high} medium=${decision.finding_counts.medium} low=${decision.finding_counts.low} |`);
  lines.push(`| Changed files | ${decision.changed_files.total} (+${decision.changed_files.additions} -${decision.changed_files.deletions}) |`);
  const cks = decision.checks;
  if (cks && cks.requested) {
    const summary = cks.results.length
      ? cks.results.map(c => `${c.name}=${c.status}`).join(' ')
      : (cks.skippedReason ? 'skipped' : 'none');
    lines.push(`| Checks | ${summary} |`);
  }
  lines.push('');
  const blocking = findings.filter(f => f.blocks_apply);
  if (blocking.length) {
    lines.push('#### Blocking findings');
    lines.push('');
    for (const f of blocking.slice(0, 10)) {
      lines.push(`- **${f.severity.toUpperCase()}** [${f.rule}] ${f.title} — \`${f.file}:${f.line}\``);
      if (f.recommendation) lines.push(`  - ${f.recommendation}`);
    }
    if (blocking.length > 10) lines.push(`- _(+${blocking.length - 10} more — see \`.nekowork/evidence/risk-findings.json\`)_`);
    lines.push('');
  }
  const nonBlocking = findings.filter(f => !f.blocks_apply);
  if (nonBlocking.length) {
    lines.push('<details><summary>Other findings</summary>');
    lines.push('');
    for (const f of nonBlocking.slice(0, 20)) {
      lines.push(`- ${f.severity.toUpperCase()} [${f.rule}] ${f.title} — \`${f.file}:${f.line}\``);
    }
    if (nonBlocking.length > 20) lines.push(`- _(+${nonBlocking.length - 20} more)_`);
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }
  lines.push('---');
  lines.push('Generated by `nekowork verify-pr`. Full report: `REPORT.md` · Evidence: `.nekowork/evidence/`.');
  return lines.join('\n');
}

/**
 * Render REPORT.md. The scope disclaimer is emitted on ALLOW / ALLOW_WITH_WARNINGS.
 * When a decision carries a `checks` block (heavy --run-checks) the "Checks Run"
 * section is rendered with per-check status + failure tails; otherwise the
 * "Checks Available" section lists configured commands.
 */
export function renderReport(decision, findings) {
  const lines = [];
  lines.push('# NEKOWORK Verification Report');
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(`**${decision.verdict}**`);
  lines.push('');
  if (decision.verdict === VERDICT.ALLOW || decision.verdict === VERDICT.ALLOW_WITH_WARNINGS) {
    lines.push('## Scope');
    lines.push('');
    lines.push(ALLOW_SCOPE_NOTE);
    lines.push('');
  }
  lines.push('## Reason');
  lines.push('');
  lines.push(decision.reason);
  lines.push('');
  lines.push('## Decision');
  lines.push('');
  lines.push(`- merge_allowed: ${decision.merge_allowed}`);
  lines.push(`- apply_allowed: ${decision.apply_allowed}`);
  lines.push(`- risk_level: ${decision.risk_level}`);
  lines.push('');
  lines.push('## Changed Files');
  lines.push('');
  lines.push(`- total: ${decision.changed_files.total}`);
  lines.push(`- additions: ${decision.changed_files.additions}`);
  lines.push(`- deletions: ${decision.changed_files.deletions}`);
  if (decision.changed_files.source?.length) {
    lines.push(`- source: ${decision.changed_files.source.join(', ')}`);
  }
  if (decision.changed_files.tests?.length) {
    lines.push(`- tests: ${decision.changed_files.tests.join(', ')}`);
  }
  if (decision.changed_files.docs?.length) {
    lines.push(`- docs: ${decision.changed_files.docs.join(', ')}`);
  }
  lines.push('');
  if (findings.length === 0) {
    lines.push('## Findings');
    lines.push('');
    lines.push('No findings.');
  } else {
    lines.push('## Blocking Findings');
    lines.push('');
    const blocking = findings.filter(f => f.blocks_apply);
    if (!blocking.length) {
      lines.push('_(none)_');
    } else {
      for (const f of blocking) {
        lines.push(`- **${f.severity.toUpperCase()}** [${f.rule}] ${f.title} — \`${f.file}:${f.line}\``);
        if (f.recommendation) lines.push(`  - ${f.recommendation}`);
      }
    }
    lines.push('');
    const nonBlocking = findings.filter(f => !f.blocks_apply);
    if (nonBlocking.length) {
      lines.push('## Other Findings');
      lines.push('');
      for (const f of nonBlocking) {
        lines.push(`- ${f.severity.toUpperCase()} [${f.rule}] ${f.title} — \`${f.file}:${f.line}\``);
      }
      lines.push('');
    }
  }
  lines.push('## Evidence');
  lines.push('');
  lines.push('- `.nekowork/evidence/risk-findings.json`');
  lines.push('- `.nekowork/evidence/diff.summary.json`');
  lines.push('- `.nekowork/evidence/diff.patch` — raw diff text the rules scanned');
  lines.push('- `.nekowork/evidence/diff.sha256` — sha256 of `diff.patch` (same diff → same verdict)');
  lines.push('- `.nekowork/evidence/rule-version.json` — engine + ruleset version');
  lines.push('- `.nekowork/evidence/evidence-manifest.json`');
  lines.push('- `.nekowork/decision.json`');
  lines.push('');
  const checks = decision.checks;
  if (checks && checks.requested && checks.results.length) {
    lines.push('## Checks Run');
    lines.push('');
    for (const c of checks.results) {
      lines.push(`- ${c.name}: ${c.status}${c.exitCode != null ? ` (exit ${c.exitCode})` : ''}`);
      if ((c.status === 'fail' || c.status === 'timeout') && c.outputTail) {
        lines.push('');
        lines.push('````text');
        lines.push(c.outputTail);
        lines.push('````');
      }
    }
    lines.push('');
  } else if (checks && checks.requested && checks.skippedReason) {
    lines.push('## Checks Run');
    lines.push('');
    lines.push(`Skipped: ${checks.skippedReason}`);
    lines.push('');
  } else {
    lines.push('## Checks Available');
    lines.push('');
    for (const [name, ok] of Object.entries(decision.project.checks_available)) {
      lines.push(`- ${name}: ${ok ? 'configured' : 'not configured'}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
