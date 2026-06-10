// verify-pr orchestrator (heavy @ps-neko/nekowork-harness) — the 1.0 hero
// entrypoint, plus the heavy-only --run-checks extension.
//
// All deterministic pipeline pieces (file classification, the 10-rule scanner,
// verdict-from-findings logic, decision build, report/comment rendering) are
// imported from the SLIM @ps-neko/nekowork package's lib/verify-helpers.js so
// heavy can never drift from slim. The ONLY heavy-specific behavior kept local:
//   - --run-checks: actually run the project's test/lint/typecheck commands and
//     downgrade an otherwise-clean verdict to NEEDS_HUMAN_REVIEW on failure
//     (a check failure never produces a standalone BLOCK).
//   - checksBlockedByRisk: refuse to execute commands when the diff itself
//     tampered with the execution surface or carries a critical finding.
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
  VERDICT,
  EXIT_CODE,
  inputSourceForMode,
  loadDiff,
  runRules,
  describeChecks,
  classifyChangedFiles,
  deriveRiskVerdict,
  buildVerifyPrDecision,
  renderPrComment,
  renderReport,
} from '@ps-neko/nekowork/scripts/lib/verify-helpers.js';
import { detectProject } from '@ps-neko/nekowork/scripts/lib/project-detector.js';
import { runChecks } from '../lib/check-runner.js';

export { VERDICT, EXIT_CODE };

/**
 * @param {object} opts
 * @param {string} [opts.projectRoot]   default process.cwd()
 * @param {'working' | 'staged' | 'patch' | 'range' | 'full'} [opts.mode='working']
 * @param {string} [opts.patchPath]     required when mode='patch'
 * @param {string} [opts.range]         required when mode='range'
 * @param {boolean} [opts.write=true]   write evidence + REPORT.md to disk
 * @param {boolean} [opts.json]         caller will print JSON (suppress summary)
 * @param {boolean} [opts.runChecks]    run project test/lint/typecheck commands
 */
export async function verifyPrCycle(opts = {}) {
  const projectRoot = opts.projectRoot || process.cwd();
  const mode = opts.mode || 'working';
  const write = opts.write !== false;

  const parsedDiff = loadDiff({ mode, projectRoot, opts });
  const project = detectProject(projectRoot);
  const findings = runRules(parsedDiff, { projectRoot });
  const checksAvailable = describeChecks(project);
  // Classify changed files ONCE and thread it through the verdict + decision.
  const classified = classifyChangedFiles(parsedDiff);

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

  // Base verdict from the shared (slim) deterministic logic, then layer the
  // heavy-only --run-checks downgrade on top.
  const verdict = applyChecksToVerdict(
    deriveRiskVerdict({ findings, classified, checksAvailable }),
    checks,
  );
  const decision = buildVerifyPrDecision({
    verdict,
    findings,
    parsedDiff,
    classified,
    project,
    checksAvailable,
    extra: { checks: checks || { requested: false, skippedReason: null, results: [] } },
  });

  const inputSource = inputSourceForMode(mode);

  let writtenPaths = null;
  if (write) {
    writtenPaths = writeEvidence({ projectRoot, parsedDiff, findings, decision, inputSource });
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

/**
 * Layer the heavy --run-checks result onto the shared deterministic verdict.
 * A failed check downgrades an otherwise-clean/ALLOW* verdict to
 * NEEDS_HUMAN_REVIEW, but it never converts a non-critical verdict into a BLOCK
 * and never overrides an existing BLOCK / NEEDS_HUMAN_REVIEW.
 */
function applyChecksToVerdict(verdict, checks) {
  if (verdict.verdict === VERDICT.BLOCK || verdict.verdict === VERDICT.NEEDS_HUMAN_REVIEW) {
    return verdict;
  }
  const ranChecks = checks && Array.isArray(checks.results) && checks.results.length > 0;
  if (!ranChecks) return verdict;
  const failed = checks.results.filter(c => c.status === 'fail' || c.status === 'timeout');
  if (!failed.length) return verdict;
  return {
    verdict: VERDICT.NEEDS_HUMAN_REVIEW,
    reason: `verification command failed: ${failed.map(c => c.name).join(', ')}`,
    apply_allowed: false,
  };
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

function writeEvidence({ projectRoot, parsedDiff, findings, decision, inputSource = 'working_tree' }) {
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
    input_source: inputSource,
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

function nextArg(rest, i, flag) {
  if (i >= rest.length || rest[i] === undefined) {
    throw new Error(`${flag} requires a value but none was provided`);
  }
  return rest[i];
}

export function parseVerifyPrArgs(rest = []) {
  const opts = { mode: 'working', json: false, write: true };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--from-working-tree') opts.mode = 'working';
    else if (a === '--from-staged' || a === '--staged') opts.mode = 'staged';
    else if (a === '--full-scan' || a === '--full') opts.mode = 'full';
    else if (a === '--from-patch') { opts.mode = 'patch'; opts.patchPath = nextArg(rest, ++i, '--from-patch'); }
    else if (a === '--range') { opts.mode = 'range'; opts.range = nextArg(rest, ++i, '--range'); }
    else if (a === '--project-root') { opts.projectRoot = nextArg(rest, ++i, '--project-root'); }
    else if (a === '--json') opts.json = true;
    else if (a === '--no-write') opts.write = false;
    else if (a === '--comment-file') { opts.commentFile = nextArg(rest, ++i, '--comment-file'); }
    else if (a === '--ci-exit-soft') opts.ciExitSoft = true;
    else if (a === '--run-checks') opts.runChecks = true;
    else if (a === '--checks-timeout') { opts.checksTimeout = Number(nextArg(rest, ++i, '--checks-timeout')); }
    else if (a === '--include') { (opts.includePaths = opts.includePaths || []).push(nextArg(rest, ++i, '--include')); }
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
    // The hint must match WHY the verdict fired (the two branches of
    // deriveRiskVerdict): telling a user whose test command WAS detected to
    // "add a test script" contradicts the reason line on the same screen.
    if (decision.project?.checks_available?.test) {
      console.log('     a test command was detected, but it was not executed for this verdict.');
      console.log('     -> run it via --run-checks or CI, or pass --ci-exit-soft to avoid blocking CI.');
    } else {
      console.log('     verify-pr just has no test command to fully verify this change.');
      console.log('     -> add a test script for full verification, or pass --ci-exit-soft to avoid blocking CI.');
    }
  }
  if (writtenPaths) {
    console.log(`  report         : ${path.relative(process.cwd(), writtenPaths.report).replace(/\\/g, '/')}`);
    console.log(`  decision       : ${path.relative(process.cwd(), writtenPaths.decision).replace(/\\/g, '/')}`);
  }
}
