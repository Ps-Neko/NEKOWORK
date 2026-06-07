// verify-pr orchestrator — the 1.0 hero entrypoint.
//
// Pipeline:
//   1. Collect diff (working tree | staged | --from-patch | --from-range)
//   2. Detect project baseline (test/lint/typecheck availability)
//   3. Run deterministic risk rules (10 scanners)
//   4. Derive verdict from rule findings + check availability
//   5. Write evidence (.nekowork/evidence/*) + .nekowork/decision.json + REPORT.md
//   6. Print summary, return decision
//
// Verdict matrix (Phase 0, per docs/SCOPE-1.0.md §7):
//   CRITICAL finding                              → BLOCK
//   HIGH finding                                  → NEEDS_HUMAN_REVIEW
//   source-only change + no test command          → INSUFFICIENT_EVIDENCE
//   any finding (medium/low) + no critical/high   → ALLOW_WITH_WARNINGS
//   otherwise                                     → ALLOW
//
// The deterministic pipeline pieces (file classification, verdict logic, the
// 10-rule scanner, decision build, report/comment rendering) live in
// lib/verify-helpers.js so the heavy @ps-neko/nekowork-harness verify-pr can
// import the SAME logic and never drift from this slim source of truth.

import fs from 'node:fs';
import path from 'node:path';
import {
  VERDICT,
  EXIT_CODE,
  RULE_COUNT,
  ALLOW_SCOPE_NOTE,
  inputSourceForMode,
  loadDiff,
  runRules,
  describeChecks,
  classifyChangedFiles,
  deriveRiskVerdict,
  buildVerifyPrDecision,
  renderPrComment,
  renderReport,
} from '../lib/verify-helpers.js';
import { detectProject } from '../lib/project-detector.js';

export { VERDICT, EXIT_CODE };

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
  const findings = runRules(parsedDiff, { projectRoot });
  const checksAvailable = describeChecks(project);
  // Classify changed files ONCE and thread the result through both the verdict
  // derivation and the decision build (it was previously computed twice).
  const classified = classifyChangedFiles(parsedDiff);
  const verdict = deriveRiskVerdict({ findings, classified, checksAvailable });
  const decision = buildVerifyPrDecision({ verdict, findings, parsedDiff, classified, project, checksAvailable });

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

  // Structured evidence summary — matches the documented `--json` shape. Always
  // defined (even with --no-write) so callers can rely on result.evidence.
  const evidence = {
    input_source: inputSource,
    written: Boolean(writtenPaths),
    artifacts: writtenPaths
      ? [
          { name: 'diff.summary.json', path: writtenPaths.diffSummary },
          { name: 'risk-findings.json', path: writtenPaths.riskFindings },
          { name: 'evidence-manifest.json', path: writtenPaths.evidenceManifest },
          { name: 'decision.json', path: writtenPaths.decision },
          { name: 'REPORT.md', path: writtenPaths.report },
        ]
      : [],
  };

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
    evidence,
    exitCode,
  };
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

  const manifestPath = path.join(evidenceDir, 'evidence-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    created_at: new Date().toISOString(),
    input_source: inputSource,
    artifacts: [
      { name: 'diff.summary.json', path: 'evidence/diff.summary.json' },
      { name: 'risk-findings.json', path: 'evidence/risk-findings.json' },
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
    else if (a === '--run-checks') process.stderr.write('warning: --run-checks is not supported in the slim @ps-neko/nekowork gate; use the @ps-neko/nekowork-harness runtime from a source checkout for this feature\n');
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
