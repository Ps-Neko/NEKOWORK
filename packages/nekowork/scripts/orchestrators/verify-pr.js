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
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  VERDICT,
  EXIT_CODE,
  RULE_COUNT,
  RULE_IDS,
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
import { runChecks } from '../lib/check-runner.js';

// Resolve the slim package version once (read from this package's package.json,
// two levels up from scripts/orchestrators/). Recorded in rule-version.json so a
// verdict is reproducible against a known engine + ruleset version.
function readEngineVersion() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

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
 * @param {number}  [opts.checksTimeout] per-check timeout in ms (default 300000)
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

  // --run-checks: actually execute the project's test/lint/typecheck commands —
  // UNLESS the diff itself tampered with the execution surface (modified a
  // build/test script or has a critical finding), since running it would execute
  // attacker-modified scripts. The slim gate ALWAYS reports its execution result
  // to the verdict, so a source change earns a clean ALLOW only when checks ran
  // and passed; without --run-checks it stays unverified (NEEDS_HUMAN_REVIEW).
  const checks = { requested: Boolean(opts.runChecks), skippedReason: null, results: [] };
  if (opts.runChecks) {
    const changedPaths = (parsedDiff.files || []).map((f) => f.path);
    if (checksBlockedByRisk(findings, changedPaths)) {
      checks.skippedReason = 'diff edits a build/run manifest (e.g. package.json scripts) or has a risk finding — the command body may be attacker-controlled, so checks were NOT executed. Run them manually in a trusted sandbox if you trust this change.';
    } else {
      checks.results = await runChecks(project.commands, { cwd: projectRoot, timeoutMs: opts.checksTimeout });
    }
  }
  const checkExecution = summarizeCheckExecution(checks);

  const verdict = deriveRiskVerdict({ findings, classified, checksAvailable, checkExecution });
  const decision = buildVerifyPrDecision({ verdict, findings, parsedDiff, classified, project, checksAvailable, extra: { checks } });

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
          { name: 'diff.patch', path: writtenPaths.diffPatch },
          { name: 'diff.sha256', path: writtenPaths.diffSha256 },
          { name: 'rule-version.json', path: writtenPaths.ruleVersion },
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

  // diff.patch — the RAW unified diff text the rules actually scanned (post
  // self-output exclusion). Binding the exact patch bytes to the verdict makes
  // "same diff → same verdict" externally provable. If a mode genuinely had no
  // raw text (should not happen for the supported modes), record an explicit
  // note rather than a wrong/empty patch that would look like "no changes".
  const diffPatchPath = path.join(evidenceDir, 'diff.patch');
  const rawDiff = typeof parsedDiff.rawDiff === 'string' ? parsedDiff.rawDiff : null;
  const diffPatchContent = rawDiff != null
    ? rawDiff
    : '# (raw diff text unavailable for this input mode — see diff.summary.json for the parsed shape)\n';
  fs.writeFileSync(diffPatchPath, diffPatchContent);

  // diff.sha256 — sha256 hex of diff.patch's exact bytes. One line, no newline,
  // so an external check can `sha256sum diff.patch` and compare directly.
  const diffSha256Path = path.join(evidenceDir, 'diff.sha256');
  const diffSha256 = crypto.createHash('sha256').update(diffPatchContent, 'utf8').digest('hex');
  fs.writeFileSync(diffSha256Path, diffSha256);

  // rule-version.json — engine + ruleset version so a verdict is reproducible
  // against a known set of rules. generated_at is the only non-deterministic field.
  const ruleVersionPath = path.join(evidenceDir, 'rule-version.json');
  fs.writeFileSync(ruleVersionPath, JSON.stringify({
    engine_version: readEngineVersion(),
    rule_count: RULE_COUNT,
    rules: [...RULE_IDS],
    generated_at: new Date().toISOString(),
  }, null, 2));

  const findingsPath = path.join(evidenceDir, 'risk-findings.json');
  fs.writeFileSync(findingsPath, JSON.stringify(findings, null, 2));

  const manifestPath = path.join(evidenceDir, 'evidence-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    created_at: new Date().toISOString(),
    input_source: inputSource,
    diff_sha256: diffSha256,
    artifacts: [
      { name: 'diff.summary.json', path: 'evidence/diff.summary.json' },
      { name: 'diff.patch', path: 'evidence/diff.patch' },
      { name: 'diff.sha256', path: 'evidence/diff.sha256' },
      { name: 'rule-version.json', path: 'evidence/rule-version.json' },
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
    diffPatch: diffPatchPath,
    diffSha256: diffSha256Path,
    ruleVersion: ruleVersionPath,
    riskFindings: findingsPath,
    evidenceManifest: manifestPath,
    decision: decisionPath,
    report: reportPath,
  };
}

// Build/run manifests whose contents define the commands --run-checks executes
// (or the code those commands compile/run). Editing any of these in the diff
// means the executed command body may be attacker-controlled, e.g. rewriting
// package.json `scripts.test` to an exfiltration command. `npm test` would then
// run it — remote code execution. Matched against the basename of every changed
// path; the guard fails CLOSED on any such edit.
const RUN_SURFACE_MANIFEST = /(^|\/)(package\.json|Cargo\.toml|pyproject\.toml|requirements\.txt|setup\.py|setup\.cfg|tox\.ini|go\.mod|build\.gradle(\.kts)?|pom\.xml|Gemfile|composer\.json|Makefile)$/i;

/**
 * Decide whether --run-checks must SKIP executing project commands because the
 * diff tampered with the execution surface. Running an attacker-modified
 * `npm test` (or any command whose body the diff rewrote) is arbitrary code
 * execution, so we refuse. Two independent triggers:
 *   1. the diff edits a build/run manifest (RUN_SURFACE_MANIFEST) — the command
 *      body itself may be attacker-controlled, which the finding rules do NOT
 *      catch (they scan for known-bad patterns, not "the test script changed");
 *   2. a finding marks the diff as risky — a critical finding, a test/security
 *      disable, or an install-hook / shell-script package change.
 * The finding's `pattern` field (set by the package-lockfile-risk scanner)
 * distinguishes install/script changes from plain dependency bumps.
 *
 * @param {Array}  findings
 * @param {string[]} [changedFiles]  repo-relative paths of every changed file
 */
export function checksBlockedByRisk(findings, changedFiles = []) {
  if (Array.isArray(changedFiles) && changedFiles.some((p) => RUN_SURFACE_MANIFEST.test(String(p)))) {
    return true;
  }
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

/**
 * Collapse a checks block into the verdict-relevant summary deriveRiskVerdict
 * consumes. Only actually-executed checks (pass/fail/timeout) count as "ran";
 * skipped (no command) and unavailable (binary missing) ones do not. A source
 * change is a clean pass only when at least one check ran and none failed.
 */
function summarizeCheckExecution(checks) {
  const executed = (checks.results || []).filter(
    (c) => c.status === 'pass' || c.status === 'fail' || c.status === 'timeout',
  );
  const failed = executed.filter((c) => c.status === 'fail' || c.status === 'timeout').map((c) => c.name);
  const ran = executed.length > 0;
  return {
    requested: Boolean(checks.requested),
    ran,
    allPassed: ran && failed.length === 0,
    failed,
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
    const token = rest[i];
    // Accept both "--flag value" and "--flag=value". Split on the FIRST '=' only,
    // so a value that itself contains '=' (e.g. --range=a=b...c) survives intact.
    const eq = token.indexOf('=');
    const flag = eq === -1 ? token : token.slice(0, eq);
    const inlineVal = eq === -1 ? undefined : token.slice(eq + 1);
    // Value-taking flags: prefer the inline "=value"; otherwise consume the next
    // token. nextArg() throws a bounds error when neither is available.
    const value = (f) => (inlineVal !== undefined ? inlineVal : nextArg(rest, ++i, f));

    if (flag === '--from-working-tree') opts.mode = 'working';
    else if (flag === '--from-staged' || flag === '--staged') opts.mode = 'staged';
    else if (flag === '--full-scan' || flag === '--full') opts.mode = 'full';
    else if (flag === '--from-patch') { opts.mode = 'patch'; opts.patchPath = value('--from-patch'); }
    else if (flag === '--range') { opts.mode = 'range'; opts.range = value('--range'); }
    else if (flag === '--project-root') { opts.projectRoot = value('--project-root'); }
    else if (flag === '--json') opts.json = true;
    else if (flag === '--no-write') opts.write = false;
    else if (flag === '--comment-file') { opts.commentFile = value('--comment-file'); }
    else if (flag === '--ci-exit-soft') opts.ciExitSoft = true;
    else if (flag === '--run-checks') opts.runChecks = true;
    else if (flag === '--checks-timeout') { opts.checksTimeout = Number(value('--checks-timeout')); }
    else if (flag === '--include') { (opts.includePaths = opts.includePaths || []).push(value('--include')); }
    // An unrecognized token is a hard error — never silently ignored. A typo like
    // `--rang origin/main...HEAD` would otherwise fall through to the working-tree
    // default and scan the WRONG diff while the caller believed it scanned a range.
    else throw new Error(`unknown verify-pr option: ${token}`);
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
  const checks = decision.checks;
  if (checks && checks.requested) {
    if (checks.skippedReason) {
      console.log(`  checks         : skipped (${checks.skippedReason})`);
    } else if (checks.results.length) {
      console.log(`  checks         : ${checks.results.map((c) => `${c.name}=${c.status}`).join(' ')}`);
    } else {
      console.log('  checks         : none configured');
    }
  }
  if (decision.verdict === VERDICT.INSUFFICIENT_EVIDENCE) {
    console.log('');
    console.log('  i  not a failure — the risk scan passed with no blocking findings.');
    console.log('     verify-pr just has no test command to fully verify this change.');
    console.log('     -> add a test script for full verification, or pass --ci-exit-soft to avoid blocking CI.');
  }
  // A NEEDS_HUMAN_REVIEW with no high/critical finding is a verification gap, not
  // a flagged risk — point the user at the fix (run the checks) rather than
  // leaving them to wonder what was "found".
  if (decision.verdict === VERDICT.NEEDS_HUMAN_REVIEW &&
      decision.finding_counts.high === 0 && decision.finding_counts.critical === 0) {
    console.log('');
    const cks = decision.checks;
    if (cks && cks.skippedReason) {
      console.log('  i  checks were SKIPPED — the diff edits the run surface, so the');
      console.log('     (possibly attacker-controlled) commands were not executed.');
      console.log('     -> review manually in a trusted sandbox.');
    } else if (cks && cks.requested && cks.results.some((c) => c.status === 'fail' || c.status === 'timeout')) {
      console.log('  i  a verification check failed — see "Checks Run" in REPORT.md.');
    } else {
      console.log('  i  no blocking findings — but this source change was NOT verified.');
      console.log('     -> re-run with --run-checks to execute test/lint/typecheck,');
      console.log('        or pass --ci-exit-soft to avoid blocking CI.');
    }
  }
  if (writtenPaths) {
    console.log(`  report         : ${path.relative(process.cwd(), writtenPaths.report).replace(/\\/g, '/')}`);
    console.log(`  decision       : ${path.relative(process.cwd(), writtenPaths.decision).replace(/\\/g, '/')}`);
  }
}
