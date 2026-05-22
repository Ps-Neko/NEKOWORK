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
];

const SCANNER = makeRegexScanner({
  ruleName: 'test-or-security-disable',
  category: 'verification-safety',
  patterns: PATTERNS,
});

export const scanFileContent = SCANNER.scanFileContent;
export const scanAddedLines = SCANNER.scanAddedLines;
export const scanDiff = SCANNER.scanDiff;
