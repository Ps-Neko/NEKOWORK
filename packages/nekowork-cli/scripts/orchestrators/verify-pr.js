// verify-pr orchestrator — the 1.0 hero entrypoint.
//
// Pipeline:
//   1. Collect diff (working tree | staged | --from-patch | --from-range)
//   2. Detect project baseline (test/lint/typecheck availability)
//   3. Run deterministic risk rules: secret-fallback, auto-apply-commit-push,
//      hardcoded-credential, test-or-security-disable, package-lockfile-risk
//   4. Derive verdict from rule findings + (optional --run-checks) results
//   5. Write evidence (.nekowork/evidence/*) + .nekowork/decision.json + REPORT.md
//   6. Print summary, return decision
//
// Verdict matrix (Phase 0, per docs/SCOPE-1.0.md §7):
//   CRITICAL finding                              → BLOCK
//   HIGH finding                                  → NEEDS_HUMAN_REVIEW
//   --run-checks failure (test/lint/typecheck)    → NEEDS_HUMAN_REVIEW (never standalone BLOCK)
//   source change + no test command               → INSUFFICIENT_EVIDENCE
//   medium/low finding, no critical/high          → ALLOW_WITH_WARNINGS
//   otherwise                                     → ALLOW

import fs from 'node:fs';
import path from 'node:path';
import {
  parseDiff,
  getGitDiff,
  loadDiffFile,
} from '@ps-neko/nekowork/scripts/lib/diff-parser.js';
import { detectProject } from '@ps-neko/nekowork/scripts/lib/project-detector.js';
import { scanDiff as scanSecretFallback } from '@ps-neko/nekowork/scripts/lib/rules/secret-fallback.js';
import { scanDiff as scanAutoApply } from '@ps-neko/nekowork/scripts/lib/rules/auto-apply-commit-push.js';
import { scanDiff as scanHardcodedCredential } from '@ps-neko/nekowork/scripts/lib/rules/hardcoded-credential.js';
import { scanDiff as scanTestDisable } from '@ps-neko/nekowork/scripts/lib/rules/test-or-security-disable.js';
import { scanDiff as scanPackageRisk } from '@ps-neko/nekowork/scripts/lib/rules/package-lockfile-risk.js';
import { runChecks } from '../lib/check-runner.js';

const SCHEMA_VERSION = 'verify-pr-v0';

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

/**
 * @param {object} opts
 * @param {string} [opts.projectRoot]   default process.cwd()
 * @param {'working' | 'staged' | 'patch' | 'range' | 'full'} [opts.mode='working']
 * @param {string} [opts.patchPath]     required when mode='patch'
 * @param {string} [opts.range]         required when mode='range'
 * @param {boolean} [opts.write=true]   write evidence + REPORT.md to disk
 * @param {boolean} [opts.json]         caller will print JSON (suppress summary)
 */
export async function verifyPrCycle(opts = {}) {
  const projectRoot = opts.projectRoot || process.cwd();
  const mode = opts.mode || 'working';
  const write = opts.write !== false;

  const parsedDiff = loadDiff({ mode, projectRoot, opts });
  const project = detectProject(projectRoot);
  const findings = runRules(parsedDiff);
  const checksAvailable = describeChecks(project);

  let checks = { requested: Boolean(opts.runChecks), skippedReason: null, results: [] };
  if (opts.runChecks) {
    if (checksBlockedByRisk(findings)) {
      checks.skippedReason = 'diff modifies build/test scripts or has a critical finding — checks not run; run them manually in a trusted sandbox if you trust this change';
    } else {
      checks.results = await runChecks(project.commands, {
        cwd: projectRoot,
        timeoutMs: opts.checksTimeout,
      });
    }
  }

  const verdict = deriveVerdict({ findings, parsedDiff, checksAvailable, checks });
  const decision = buildDecision({ verdict, findings, parsedDiff, project, checksAvailable, checks });

  let writtenPaths = null;
  if (write) {
    writtenPaths = writeEvidence({ projectRoot, parsedDiff, findings, decision });
  }

  if (opts.commentFile) {
    const commentMarkdown = renderPrComment(decision, findings);
    fs.mkdirSync(path.dirname(path.resolve(opts.commentFile)), { recursive: true });
    fs.writeFileSync(opts.commentFile, commentMarkdown);
  }

  let exitCode = EXIT_CODE[verdict.verdict];
  if (opts.ciExitSoft && (verdict.verdict === VERDICT.NEEDS_HUMAN_REVIEW || verdict.verdict === VERDICT.INSUFFICIENT_EVIDENCE)) {
    exitCode = 0;
  }

  return {
    decision,
    findings,
    parsedDiff,
    project,
    writtenPaths,
    exitCode,
  };
}

function renderPrComment(decision, findings) {
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
  const cks = decision.checks || { requested: false, results: [] };
  if (cks.requested) {
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

function loadDiff({ mode, projectRoot, opts }) {
  const includePaths = opts.includePaths;
  if (mode === 'patch') {
    if (!opts.patchPath) throw new Error('mode=patch requires --from-patch <file>');
    return loadDiffFile(opts.patchPath);
  }
  if (mode === 'range') {
    if (!opts.range) throw new Error('mode=range requires --range <ref>');
    return getGitDiff({ cwd: projectRoot, mode: 'range', range: opts.range, includePaths });
  }
  if (mode === 'staged') {
    return getGitDiff({ cwd: projectRoot, mode: 'staged', includePaths });
  }
  if (mode === 'full') {
    return getGitDiff({ cwd: projectRoot, mode: 'full', includePaths });
  }
  return getGitDiff({ cwd: projectRoot, mode: 'working', includePaths });
}

function runRules(parsedDiff) {
  const findings = [];
  findings.push(...scanSecretFallback(parsedDiff));
  findings.push(...scanAutoApply(parsedDiff));
  findings.push(...scanHardcodedCredential(parsedDiff));
  findings.push(...scanTestDisable(parsedDiff));
  findings.push(...scanPackageRisk(parsedDiff));
  return findings;
}

function describeChecks(project) {
  return {
    test: Boolean(project.hasTests),
    lint: Boolean(project.hasLint),
    typecheck: Boolean(project.hasTypecheck),
    build: Boolean(project.hasBuild),
    audit: Boolean(project.hasAudit),
  };
}

function classifyChangedFiles(parsedDiff) {
  const source = [];
  const tests = [];
  const docs = [];
  const config = [];
  const ci = [];
  for (const f of parsedDiff.files || []) {
    const p = f.path.toLowerCase();
    if (/(^|\/)tests?\/|\.test\.|\.spec\./.test(p)) tests.push(f.path);
    else if (/\.(md|rst|txt)$/.test(p) || /^docs\//.test(p) || /readme/i.test(p)) docs.push(f.path);
    else if (/\.(json|toml|yaml|yml|ini|cfg)$/.test(p)) config.push(f.path);
    else if (/^\.github\/|^\.gitlab-ci|^\.circleci|jenkinsfile/i.test(f.path)) ci.push(f.path);
    else source.push(f.path);
  }
  return { source, tests, docs, config, ci };
}

/**
 * Decide whether --run-checks must SKIP executing project commands because the
 * diff itself tampered with the execution surface (install/test scripts) or has
 * a critical finding. The finding's `pattern` field (set by makeRegexScanner)
 * distinguishes install/script changes from plain dependency changes.
 */
export function checksBlockedByRisk(findings) {
  if (!Array.isArray(findings)) return false;
  return findings.some((f) => {
    if (f.severity === 'critical') return true;
    if (f.rule === 'test-or-security-disable') return true;
    if (f.rule === 'package-lockfile-risk') {
      const p = String(f.pattern || '');
      return p.startsWith('install-hook-') || p.startsWith('script-');
    }
    return false;
  });
}

function deriveVerdict({ findings, parsedDiff, checksAvailable, checks }) {
  const hasCritical = findings.some(f => f.severity === 'critical');
  const hasHigh = findings.some(f => f.severity === 'high');
  const hasMediumOrLow = findings.some(f => f.severity === 'medium' || f.severity === 'low');
  const classified = classifyChangedFiles(parsedDiff);
  const sourceOnly = classified.source.length > 0;
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
  const ranChecks = checks && Array.isArray(checks.results) && checks.results.length > 0;
  if (ranChecks) {
    const failed = checks.results.filter(c => c.status === 'fail' || c.status === 'timeout');
    if (failed.length) {
      return {
        verdict: VERDICT.NEEDS_HUMAN_REVIEW,
        reason: `verification command failed: ${failed.map(c => c.name).join(', ')}`,
        apply_allowed: false,
      };
    }
  }

  if (sourceOnly && !checksAvailable.test) {
    return {
      verdict: VERDICT.INSUFFICIENT_EVIDENCE,
      reason: 'risk scan passed (no blocking findings), but this project has no test command — full verification needs one. This is "not enough evidence", not a failure.',
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

function firstCriticalReason(findings) {
  const critical = findings.find(f => f.severity === 'critical');
  if (!critical) return 'CRITICAL finding present';
  return `${critical.title} (${critical.file}:${critical.line})`;
}

function buildDecision({ verdict, findings, parsedDiff, project, checksAvailable, checks }) {
  const classified = classifyChangedFiles(parsedDiff);
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
    findings,
    checks: checks || { requested: false, skippedReason: null, results: [] },
  };
}

function deriveRiskLevel(findings) {
  if (findings.some(f => f.severity === 'critical')) return 'CRITICAL';
  if (findings.some(f => f.severity === 'high')) return 'HIGH';
  if (findings.some(f => f.severity === 'medium')) return 'MEDIUM';
  if (findings.length > 0) return 'LOW';
  return 'LOW';
}

function countBySeverity(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    if (counts[f.severity] != null) counts[f.severity]++;
  }
  return counts;
}

function writeEvidence({ projectRoot, parsedDiff, findings, decision }) {
  const evidenceDir = path.join(projectRoot, '.nekowork', 'evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });

  const diffPath = path.join(evidenceDir, 'diff.summary.json');
  fs.writeFileSync(diffPath, JSON.stringify({
    totalFiles: parsedDiff.totalFiles,
    totalAdditions: parsedDiff.totalAdditions,
    totalDeletions: parsedDiff.totalDeletions,
    files: (parsedDiff.files || []).map(f => ({
      path: f.path,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    })),
  }, null, 2));

  const findingsPath = path.join(evidenceDir, 'risk-findings.json');
  fs.writeFileSync(findingsPath, JSON.stringify(findings, null, 2));

  const checksPath = path.join(evidenceDir, 'checks.json');
  fs.writeFileSync(checksPath, JSON.stringify(decision.checks || { requested: false, skippedReason: null, results: [] }, null, 2));

  const manifestPath = path.join(evidenceDir, 'evidence-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    created_at: new Date().toISOString(),
    input_source: 'working_tree',
    artifacts: [
      { name: 'diff.summary.json', path: 'evidence/diff.summary.json' },
      { name: 'risk-findings.json', path: 'evidence/risk-findings.json' },
      { name: 'checks.json', path: 'evidence/checks.json' },
    ],
  }, null, 2));

  const decisionPath = path.join(projectRoot, '.nekowork', 'decision.json');
  fs.writeFileSync(decisionPath, JSON.stringify(decision, null, 2));

  const reportPath = path.join(projectRoot, 'REPORT.md');
  fs.writeFileSync(reportPath, renderReport(decision, findings));

  return {
    evidenceDir,
    diffSummary: diffPath,
    riskFindings: findingsPath,
    checks: checksPath,
    evidenceManifest: manifestPath,
    decision: decisionPath,
    report: reportPath,
  };
}

function renderReport(decision, findings) {
  const lines = [];
  lines.push('# NEKOWORK Verification Report');
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(`**${decision.verdict}**`);
  lines.push('');
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
  lines.push('- `.nekowork/evidence/evidence-manifest.json`');
  lines.push('- `.nekowork/decision.json`');
  lines.push('');
  const checks = decision.checks || { requested: false, skippedReason: null, results: [] };
  if (checks.requested && checks.results.length) {
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
  } else if (checks.requested && checks.skippedReason) {
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

export function parseVerifyPrArgs(rest = []) {
  const opts = { mode: 'working', json: false, write: true };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--from-working-tree') opts.mode = 'working';
    else if (a === '--from-staged' || a === '--staged') opts.mode = 'staged';
    else if (a === '--full-scan' || a === '--full') opts.mode = 'full';
    else if (a === '--from-patch') { opts.mode = 'patch'; opts.patchPath = rest[++i]; }
    else if (a === '--range') { opts.mode = 'range'; opts.range = rest[++i]; }
    else if (a === '--project-root') opts.projectRoot = rest[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--no-write') opts.write = false;
    else if (a === '--comment-file') opts.commentFile = rest[++i];
    else if (a === '--ci-exit-soft') opts.ciExitSoft = true;
    else if (a === '--run-checks') opts.runChecks = true;
    else if (a === '--checks-timeout') opts.checksTimeout = Number(rest[++i]);
    else if (a === '--include') { (opts.includePaths = opts.includePaths || []).push(rest[++i]); }
  }
  return opts;
}

export function printVerifyPrSummary(result) {
  const { decision, findings, writtenPaths } = result;
  console.log('=== verify-pr ===');
  console.log(`  verdict        : ${decision.verdict}`);
  console.log(`  reason         : ${decision.reason}`);
  console.log(`  risk_level     : ${decision.risk_level}`);
  console.log(`  merge_allowed  : ${decision.merge_allowed}`);
  console.log(`  apply_allowed  : ${decision.apply_allowed}`);
  console.log(`  changed_files  : ${decision.changed_files.total} (+${decision.changed_files.additions} -${decision.changed_files.deletions})`);
  console.log(`  findings       : critical=${decision.finding_counts.critical} high=${decision.finding_counts.high} medium=${decision.finding_counts.medium} low=${decision.finding_counts.low}`);
  if (decision.checks?.requested) {
    if (decision.checks.results.length) {
      console.log(`  checks         : ${decision.checks.results.map(c => c.name + '=' + c.status).join(' ')}`);
    } else if (decision.checks.skippedReason) {
      console.log(`  checks         : skipped`);
    }
  }
  if (findings.length) {
    console.log('  top findings:');
    for (const f of findings.slice(0, 5)) {
      console.log(`    - [${f.severity.toUpperCase()}] ${f.title} (${f.file}:${f.line})`);
    }
  }
  if (decision.verdict === VERDICT.INSUFFICIENT_EVIDENCE) {
    console.log('');
    console.log('  i  not a failure — the risk scan passed with no blocking findings.');
    console.log('     verify-pr just has no test command to fully verify this change.');
    console.log('     -> add a test script for full verification, or pass --ci-exit-soft to avoid blocking CI.');
  }
  if (writtenPaths) {
    console.log(`  report         : ${path.relative(process.cwd(), writtenPaths.report).replace(/\\/g, '/')}`);
    console.log(`  decision       : ${path.relative(process.cwd(), writtenPaths.decision).replace(/\\/g, '/')}`);
  }
}
