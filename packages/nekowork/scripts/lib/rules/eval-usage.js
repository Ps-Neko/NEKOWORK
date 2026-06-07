// Eval-Usage rule for verify-pr.
//
// Flags dynamic code execution primitives that are a classic injection / RCE
// vector when fed anything that is not a compile-time constant:
//   - eval(<non-literal>)            // string-built code executed at runtime
//   - new Function(<...>)            // the Function constructor = eval by proxy
//
// Comment-stripping (default in makeRegexScanner) removes the word "eval" in
// comments and the disable-directive `// eslint-disable ... no-eval` lines, so
// documentation / lint pragmas do not trip the rule. A pure string-literal
// argument (`eval("1 + 1")`) is treated as low-signal and filtered, because the
// dangerous case is runtime-assembled / variable input.

import { makeRegexScanner } from './_helpers.js';

const PATTERNS = [
  {
    // eval( <arg> ) where the first non-space char of the argument is NOT a
    // pure string-literal quote followed by a closing paren. We match `eval(`
    // then look at what follows; the filter rejects the rare static-literal
    // form `eval("...")` / `eval('...')` / `eval(\`...\`)`.
    id: 'eval-call',
    re: /(?<![.\w$])eval\s*\(\s*([^)]*)/g,
    severity: 'high',
    title: 'eval() with dynamic input detected',
    description: 'eval() executes a string as code. With any runtime-assembled or external input this is a code-injection / RCE vector.',
    recommendation: 'Remove eval(). Use JSON.parse for data, a lookup table for dispatch, or a real parser.',
    filter: (m) => {
      const arg = (m[1] || '').trim();
      if (!arg) return false; // `eval()` with nothing is not interesting
      // Pure single string literal argument → static, low signal. A literal
      // immediately followed by `)` (no concatenation / template expr).
      if (/^(["'])(?:[^"'\\\n]|\\.)*\1\s*$/.test(arg)) return false;
      // Template literal with no ${} interpolation is also static.
      if (/^`[^`$]*`\s*$/.test(arg)) return false;
      return true;
    },
  },
  {
    // new Function('a','b','return a+b') — the Function constructor compiles a
    // string body into a function. Always flagged: the body is a string and the
    // common use is dynamic codegen.
    id: 'new-function-constructor',
    re: /\bnew\s+Function\s*\(/g,
    severity: 'high',
    title: 'Function constructor detected',
    description: 'new Function(...) compiles a string into executable code — an eval-equivalent injection vector.',
    recommendation: 'Replace dynamic code generation with a static function or a vetted template engine.',
  },
  {
    // Indirect eval via a global object: window.eval(, globalThis.eval(,
    // self.eval(, global.eval(. These run in the global scope and are a common
    // way to "hide" an eval from naive linters. The first argument is dynamic
    // input in the dangerous case; we flag the call site outright since the
    // global-eval form is almost never a static-literal use.
    id: 'indirect-global-eval',
    re: /\b(?:window|globalThis|self|global)\s*\.\s*eval\s*\(\s*([^)]*)/g,
    severity: 'high',
    title: 'Indirect global eval detected',
    description: 'window/globalThis/self/global .eval(...) executes a string as code in global scope — an injection / RCE vector.',
    recommendation: 'Remove the indirect eval. Use JSON.parse for data or a lookup table for dispatch.',
    filter: (m) => {
      const arg = (m[1] || '').trim();
      if (!arg) return false;
      if (/^(["'])(?:[^"'\\\n]|\\.)*\1\s*$/.test(arg)) return false;
      if (/^`[^`$]*`\s*$/.test(arg)) return false;
      return true;
    },
  },
  {
    // Node vm module: runInNewContext / runInThisContext / runInContext /
    // compileFunction all compile+run a code STRING, equivalent to eval.
    id: 'node-vm-run',
    re: /\bvm\s*\.\s*(?:runInNewContext|runInThisContext|runInContext|compileFunction)\s*\(/g,
    severity: 'high',
    title: 'Node vm dynamic code execution detected',
    description: 'vm.runInNewContext / runInThisContext / runInContext / compileFunction compile and run a code string — an eval-equivalent vector.',
    recommendation: 'Avoid running assembled code. If sandboxing is required, use a vetted, isolated runtime and never feed it untrusted input.',
  },
  {
    // setTimeout / setInterval with a STRING first argument is implicit eval.
    // A function-reference first arg (setTimeout(fn, 100)) is the safe, common
    // case and must NOT fire — the regex requires a string-literal opener after
    // the paren.
    id: 'timer-string-eval',
    re: /\b(?:setTimeout|setInterval)\s*\(\s*(["'`])/g,
    severity: 'high',
    title: 'setTimeout/setInterval with string argument',
    description: 'Passing a string as the first argument to setTimeout/setInterval evaluates it as code — an implicit eval / injection vector.',
    recommendation: 'Pass a function reference instead of a code string: setTimeout(() => { ... }, ms).',
  },
];

const SCANNER = makeRegexScanner({
  ruleName: 'eval-usage',
  category: 'code-injection',
  patterns: PATTERNS,
});

export const scanFileContent = SCANNER.scanFileContent;
export const scanAddedLines = SCANNER.scanAddedLines;
export const scanDiff = SCANNER.scanDiff;
