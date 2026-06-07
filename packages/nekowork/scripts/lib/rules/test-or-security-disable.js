// Test-Or-Security-Disable rule for verify-pr.
//
// Detects AI silencing checks rather than fixing them: skipping tests,
// disabling lint, suppressing type errors, removing CI gates. Not always
// malicious — sometimes legitimate — so default severity is HIGH (needs
// human review), not CRITICAL. Critical only when the disable is
// project-wide (file-wide eslint-disable, ts-nocheck on file).

import { makeRegexScanner } from './_helpers.js';

const PATTERNS = [
  {
    id: 'js-test-skip',
    re: /\b(?:it|test|describe|context)\.skip\s*\(/g,
    severity: 'high',
    title: 'Test skipped (it.skip / describe.skip)',
    description: 'A test is being skipped. Skipping tests in a PR usually masks a failure rather than fixing it.',
    recommendation: 'Either fix the test or document why skipping is correct (issue link, owner, removal date).',
  },
  {
    id: 'js-x-prefix-skip',
    re: /\b(?:xit|xdescribe|xtest)\s*\(/g,
    severity: 'high',
    title: 'Test skipped via x-prefix (xit / xdescribe)',
    description: 'Jest/Jasmine x-prefix syntax silently skips the test.',
    recommendation: 'Either fix the test or use it.todo() with a tracking issue.',
  },
  {
    id: 'ts-nocheck-file',
    re: /\/\/\s*@ts-nocheck\b/g,
    raw: true,
    severity: 'critical',
    title: '@ts-nocheck disables type checking for the whole file',
    description: '@ts-nocheck silences TypeScript for the entire file.',
    recommendation: 'Fix the types or scope the suppression with @ts-expect-error on specific lines.',
  },
  {
    id: 'ts-ignore-line',
    re: /\/\/\s*@ts-ignore\b/g,
    raw: true,
    severity: 'medium',
    title: '@ts-ignore suppresses a type error',
    description: '@ts-ignore hides a TypeScript error without explaining why.',
    recommendation: 'Prefer @ts-expect-error which fails if the error goes away. Add a reason comment.',
  },
  {
    id: 'eslint-disable-file',
    // /* eslint-disable */ at file scope (no rule list = blanket)
    re: /\/\*\s*eslint-disable\s*\*\//g,
    raw: true,
    severity: 'critical',
    title: 'File-wide eslint-disable (no rule scope)',
    description: 'Blanket eslint-disable turns off all lint for the file.',
    recommendation: 'Disable specific rules only and document why.',
  },
  {
    id: 'eslint-disable-next',
    re: /\/\/\s*eslint-disable-next-line\b/g,
    raw: true,
    severity: 'medium',
    title: 'eslint-disable-next-line found',
    description: 'A single-line lint suppression. Acceptable in moderation; flag for review.',
    recommendation: 'Confirm the rule being suppressed and the reason.',
  },
  {
    id: 'python-pytest-skip',
    re: /@pytest\.mark\.skip\b/g,
    severity: 'high',
    title: 'pytest skip marker',
    description: 'A pytest is being skipped via decorator.',
    recommendation: 'Either fix the test or replace with skipif (reason) tied to a tracked condition.',
  },
  {
    id: 'python-unittest-skip',
    re: /@unittest\.skip\b/g,
    severity: 'high',
    title: 'unittest skip decorator',
    description: 'A unittest is being skipped.',
    recommendation: 'Either fix the test or replace with skipUnless tied to a real condition.',
  },
  {
    // Go: t.Skip( / t.Skipf( / t.SkipNow( inside a test.
    id: 'go-test-skip',
    re: /\bt\.Skip(?:f|Now)?\s*\(/g,
    severity: 'high',
    title: 'Go test skipped (t.Skip)',
    description: 'A Go test is being skipped via t.Skip. Skipping in a PR usually masks a failure rather than fixing it.',
    recommendation: 'Either fix the test or gate the skip on a documented runtime condition (e.g. testing.Short()).',
  },
  {
    // Go: //nolint (golangci-lint blanket or rule-scoped suppression).
    id: 'go-nolint',
    re: /\/\/\s*nolint\b/g,
    raw: true,
    severity: 'medium',
    title: 'golangci-lint suppression (//nolint)',
    description: '//nolint suppresses Go linters. Acceptable in moderation; flag for review.',
    recommendation: 'Scope to specific linters (//nolint:errcheck) and document why.',
  },
  {
    // Rust: #[allow(...)] suppresses a compiler/clippy lint.
    id: 'rust-allow',
    re: /#!?\[\s*allow\s*\(/g,
    raw: true,
    severity: 'medium',
    title: 'Rust lint allow attribute (#[allow(...)])',
    description: '#[allow(...)] suppresses a Rust/clippy lint. Crate-wide #![allow] is broader and riskier.',
    recommendation: 'Prefer fixing the lint. If suppressing, scope it tightly and add a reason.',
  },
  {
    // tslint:disable (legacy TS linter, blanket form is file-wide).
    id: 'tslint-disable',
    re: /\/\/\s*tslint:disable(?!-next-line|:)/g,
    raw: true,
    severity: 'high',
    title: 'tslint:disable (file-wide)',
    description: 'A blanket tslint:disable turns off TSLint for the rest of the file.',
    recommendation: 'Disable specific rules only (tslint:disable:rule-name) and document why.',
  },
  {
    // biome-ignore lint suppression.
    id: 'biome-ignore',
    re: /\/\/\s*biome-ignore\b/g,
    raw: true,
    severity: 'medium',
    title: 'biome-ignore suppression',
    description: 'biome-ignore suppresses a Biome lint diagnostic. Acceptable in moderation; flag for review.',
    recommendation: 'Confirm the rule being suppressed and add a justification after the colon.',
  },
  {
    // Python: # noqa (flake8/ruff) suppression. Bare `# noqa` disables all
    // checks on the line; `# noqa: E501` is rule-scoped.
    id: 'python-noqa',
    re: /#\s*noqa\b/g,
    raw: true,
    severity: 'medium',
    title: 'Python lint suppression (# noqa)',
    description: '# noqa suppresses flake8/ruff diagnostics on the line. Bare noqa disables every check.',
    recommendation: 'Scope to specific codes (# noqa: E501) and prefer fixing the issue.',
  },
  {
    // JUnit 5 @Disabled / JUnit 4 + TestNG @Ignore — skips a test entirely.
    // Matches the annotation form (optionally with a reason arg).
    id: 'junit-disabled-ignore',
    re: /@(?:Disabled|Ignore)\b/g,
    severity: 'high',
    title: 'JUnit/TestNG test disabled (@Disabled / @Ignore)',
    description: 'A Java test is disabled via @Disabled (JUnit 5) or @Ignore (JUnit 4 / TestNG). Skipping in a PR usually masks a failure rather than fixing it.',
    recommendation: 'Either fix the test or document why it is disabled (issue link, owner, removal date).',
  },
  {
    // mypy: # type: ignore suppresses a type error on the line. Bare form
    // disables all type checks on the line; `# type: ignore[code]` is scoped.
    id: 'mypy-type-ignore',
    re: /#\s*type:\s*ignore\b/g,
    raw: true,
    severity: 'medium',
    title: 'mypy type suppression (# type: ignore)',
    description: '# type: ignore hides a mypy type error on the line. Bare form disables all type checks there.',
    recommendation: 'Scope to specific codes (# type: ignore[arg-type]) and prefer fixing the type.',
  },
  {
    // gosec: #nosec suppresses a Go security scanner finding. Blanket #nosec
    // turns off all gosec rules on the line.
    id: 'gosec-nosec',
    re: /#\s*nosec\b/g,
    raw: true,
    severity: 'high',
    title: 'gosec suppression (#nosec)',
    description: '#nosec suppresses gosec security findings. Bare #nosec disables every security rule on the line.',
    recommendation: 'Scope to specific rules (#nosec G101) and document why the finding is a false positive.',
  },
  {
    // Java: @SuppressWarnings("...") silences compiler/lint warnings. Broad
    // when applied at type/method scope (e.g. "unchecked", "all").
    id: 'java-suppresswarnings',
    re: /@SuppressWarnings\s*\(/g,
    severity: 'medium',
    title: 'Java @SuppressWarnings',
    description: '@SuppressWarnings(...) silences compiler/lint warnings. "all" / type-scope suppression hides a broad class of issues.',
    recommendation: 'Scope the suppression to the narrowest element and the specific warning, and add a justification.',
  },
];

const SCANNER = makeRegexScanner({
  ruleName: 'test-or-security-disable',
  category: 'verification-safety',
  patterns: PATTERNS,
});

export const scanFileContent = SCANNER.scanFileContent;
export const scanAddedLines = SCANNER.scanAddedLines;
export const scanDiff = SCANNER.scanDiff;
