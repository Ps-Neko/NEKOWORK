// Auto-Apply / Commit / Push rule for verify-pr.
//
// Detects AI-introduced automation that bypasses human approval:
//   - git commit -m (automated commit)
//   - git push (automated push)
//   - git push --force / -f (forced push, destroys remote history)
//   - rm -rf with variable expansion (path injection wipes)
//   - rm -rf on system paths (/, /etc, /usr ...)
//   - auto-merge / automerge config flags
//
// Per docs/SCOPE-1.0.md §6: "정체성 직결 — 강하게 CRITICAL." NEKOWORK's
// whole product premise is that auto-commit/push must not happen. So this
// rule is unusually aggressive about CRITICAL severity.

import { makeRegexScanner } from './_helpers.js';

const PATTERNS = [
  {
    id: 'git-push-force',
    // `git push ... --force` or `-f` BUT excluding `--force-with-lease`.
    // The negative lookahead on `--force(?!-with-lease)` is the correct
    // anchor: \b would match between `e` and `-` of `-with-lease`.
    re: /^[^\n]*\bgit\s+push\b[^\n]*?(?:--force(?!-with-lease)|\s-f(?![\w-]))[^\n]*/gm,
    severity: 'critical',
    title: 'Forced git push detected',
    description: '`git push --force` (or `-f`) rewrites remote history and can destroy other contributors\' work.',
    recommendation: 'Use `--force-with-lease` if a forced push is truly required, or remove the forced push.',
  },
  {
    id: 'rm-rf-variable',
    // rm with recursive+force flags (combined `-rf`/`-fr` or separated `-r -f`/`-f -r`)
    // and variable expansion in the path.
    re: /\brm\s+(?=-[a-zA-Z]*(?:rf|fr)|-[a-zA-Z]*r[a-zA-Z]*\s+-[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*\s+-[a-zA-Z]*r)-[a-zA-Z][^\n]*\$\{?\w/g,
    severity: 'critical',
    title: 'rm -rf with variable path',
    description: 'Removing with a variable path is dangerous — if the variable is empty, the parent directory is wiped.',
    recommendation: 'Validate the variable is non-empty, or hard-code the path.',
  },
  {
    id: 'rm-rf-system',
    // rm -rf on a root-like path (not allowed: /tmp, /var/{log,cache,tmp},
    // /home/<u>, /root/<x>, /node_modules — common safe targets)
    re: /\brm\s+(?=-[a-zA-Z]*(?:rf|fr)|-[a-zA-Z]*r[a-zA-Z]*\s+-[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*\s+-[a-zA-Z]*r)-[a-zA-Z][^\n]*?\s+\/(?!tmp(?:\/|$|\s)|var\/(?:log|cache|tmp)\/|home\/\w|root\/\w|node_modules\/|opt\/render\/)\S*/g,
    severity: 'critical',
    title: 'rm -rf on system path',
    description: 'Removing system paths is destructive and rarely intentional in a build/automation script.',
    recommendation: 'Confirm the target is intentional. Prefer scoped temp directories.',
  },
  {
    id: 'subprocess-git-push',
    // exec/spawn calling git push
    re: /(?:execSync|exec|spawnSync|spawn|execFileSync|execFile)\s*\(\s*["']git["']\s*,\s*\[[^\]]*["']push["']/g,
    severity: 'critical',
    title: 'Subprocess git push detected',
    description: 'Code spawns `git push` directly. NEKOWORK requires explicit human approval for push operations.',
    recommendation: 'Remove the auto-push. Push should be a human-driven explicit action.',
  },
  {
    // Python: subprocess.run(['git','push',...]) / subprocess.call([...]) /
    // subprocess.Popen([...]) / check_call / check_output with a list arg
    // whose first two items are 'git' and 'push'.
    id: 'python-subprocess-git-push',
    re: /subprocess\.(?:run|call|Popen|check_call|check_output)\s*\(\s*\[\s*["']git["']\s*,\s*["']push["']/g,
    severity: 'critical',
    title: 'Python subprocess git push detected',
    description: 'Python spawns `git push` via subprocess. NEKOWORK requires explicit human approval for push operations.',
    recommendation: 'Remove the auto-push. Push should be a human-driven explicit action.',
  },
  {
    // Go: exec.Command("git", "push", ...)
    id: 'go-exec-git-push',
    re: /exec\.Command\(\s*"git"\s*,\s*"push"/g,
    severity: 'critical',
    title: 'Go exec.Command git push detected',
    description: 'Go spawns `git push` via exec.Command. NEKOWORK requires explicit human approval for push operations.',
    recommendation: 'Remove the auto-push. Push should be a human-driven explicit action.',
  },
  {
    // Ruby: system('git push') / system("git", "push") / `git push` (backticks)
    // or %x(git push). The backtick form is handled by the generic
    // git-push-line pattern; this adds CRITICAL specificity for the explicit
    // subprocess-invocation forms.
    id: 'ruby-system-git-push',
    re: /(?:\bsystem\(\s*["'`]git\s+push|\bsystem\(\s*["']git["']\s*,\s*["']push["']|%x\(\s*git\s+push)/g,
    severity: 'critical',
    title: 'Ruby system() git push detected',
    description: 'Ruby invokes `git push` via system()/%x. NEKOWORK requires explicit human approval for push operations.',
    recommendation: 'Remove the auto-push. Push should be a human-driven explicit action.',
  },
  {
    id: 'auto-merge-config',
    re: /\bauto[-_]?merge\s*[:=]\s*(?:true|"true"|'true'|1\b|enabled\b|yes\b|on\b)/gi,
    severity: 'critical',
    title: 'Auto-merge enabled in config',
    description: 'Auto-merge bypasses human review on PRs.',
    recommendation: 'Disable auto-merge unless review is delegated to a vetted bot with policy.',
  },
  {
    // `gh pr merge ... --auto` enables GitHub auto-merge, which lands the PR
    // automatically once required checks pass — bypassing the human approval
    // NEKOWORK's entire premise requires. CRITICAL. `--auto` may appear before
    // or after the PR ref, so the lookahead scans the rest of the line.
    id: 'gh-pr-merge-auto',
    re: /^[^\n]*\bgh\s+pr\s+merge\b(?=[^\n]*\s--auto\b)[^\n]*/gm,
    severity: 'critical',
    title: 'gh pr merge --auto detected',
    description: '`gh pr merge --auto` enables GitHub auto-merge — the PR merges automatically once checks pass, with no human approval step.',
    recommendation: 'Remove --auto. Merging must be a human-driven explicit action after review.',
  },
  {
    id: 'git-push-line',
    // Plain `git push` outside the more specific patterns. HIGH because
    // context (docs vs CI vs code) cannot be inferred from a single line.
    re: /^[^\n]*\bgit\s+push\b[^\n]*/gm,
    severity: 'high',
    title: 'git push found in change',
    description: '`git push` appears in the change. May be intentional release automation or accidental auto-push.',
    recommendation: 'Confirm the push is human-driven or runs only on explicit triggers.',
  },
  {
    id: 'git-commit-auto',
    // git commit -m "..."
    re: /\bgit\s+commit\b[^\n]*\s-m\s+(?:["']|[\w])/g,
    severity: 'high',
    title: 'Automated git commit detected',
    description: '`git commit -m` in a script or CI step indicates automated commit creation.',
    recommendation: 'NEKOWORK policy: commits should be human-driven. Confirm the automation is intended and scoped.',
  },
];

const SCANNER = makeRegexScanner({
  ruleName: 'auto-apply-commit-push',
  category: 'automation-safety',
  patterns: PATTERNS,
});

export const scanFileContent = SCANNER.scanFileContent;
export const scanAddedLines = SCANNER.scanAddedLines;
export const scanDiff = SCANNER.scanDiff;
