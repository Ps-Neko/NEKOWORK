// Command-Injection rule for verify-pr.
//
// Flags shell command execution that interpolates / concatenates a variable
// directly into the command string — the classic OS-command-injection vector
// AI agents introduce when "shelling out":
//   - exec("ls " + userInput)
//   - execSync(`rm -rf ${path}`)
//   - spawn(`sh -c ${cmd}`, { shell: true })
//
// SAFE forms that must NOT fire (FP=0 against a diverse negative set):
//   - array-arg spawn/execFile: spawn('ls', ['-la', dir])   (no shell parsing)
//   - static-literal exec:      exec('ls -la')               (no interpolation)
//   - exec with a plain variable that is itself the whole command and was
//     validated elsewhere is out of scope (we only flag interpolation INTO a
//     command string, which is the unambiguous injection shape).
//
// Severity: high (critical when force flags / rm appear is left to other rules).

import { makeRegexScanner } from './_helpers.js';

// A command string argument that mixes a string literal with a concatenation
// (`"..." +`) or a template interpolation (`${...}` inside backticks). This is
// the dynamic-command shape. We require the FIRST argument to be such a string;
// a bare variable or an array literal does not match.
const CONCAT_STR = '(?:"[^"\\n]*"|\'[^\'\\n]*\')\\s*\\+'; // "lit" +  / 'lit' +
const TEMPLATE_INTERP = '`[^`\\n]*\\$\\{[^}]+\\}[^`\\n]*`'; // `...${x}...`

const PATTERNS = [
  {
    // child_process exec / execSync with a concatenated command string.
    //   exec("ping " + host)   execSync('tar ' + name)
    id: 'exec-concat',
    re: new RegExp(`\\b(?:exec|execSync)\\s*\\(\\s*${CONCAT_STR}`, 'g'),
    severity: 'high',
    title: 'Shell command built by string concatenation (exec)',
    description: 'exec/execSync runs a command string assembled with + concatenation of a variable — an OS-command-injection vector.',
    recommendation: 'Use execFile/spawn with an argument array (no shell), or strictly validate/escape the input.',
  },
  {
    // exec / execSync with a template-literal command containing ${...}.
    //   exec(`ping ${host}`)   execSync(`rm -rf ${dir}`)
    id: 'exec-template',
    re: new RegExp(`\\b(?:exec|execSync)\\s*\\(\\s*${TEMPLATE_INTERP}`, 'g'),
    severity: 'high',
    title: 'Shell command built by template interpolation (exec)',
    description: 'exec/execSync runs a template-literal command with ${...} interpolation of a variable — an OS-command-injection vector.',
    recommendation: 'Use execFile/spawn with an argument array (no shell), or strictly validate/escape the input.',
  },
  {
    // spawn / spawnSync / exec with shell:true AND a dynamic command. The
    // shell:true option re-enables shell metacharacter parsing, so an
    // interpolated/concatenated first arg is injectable. We require BOTH the
    // dynamic command string and shell: true within the same call to keep FP=0
    // (array-arg spawn without a concatenated command never matches).
    id: 'spawn-shell-true-concat',
    re: new RegExp(`\\b(?:spawn|spawnSync|exec|execSync)\\s*\\(\\s*(?:${CONCAT_STR}|${TEMPLATE_INTERP})[\\s\\S]{0,200}?shell\\s*:\\s*true`, 'g'),
    severity: 'critical',
    title: 'spawn with shell:true and a dynamic command',
    description: 'spawn/exec with shell:true parses shell metacharacters; the command is built from interpolated/concatenated input — a command-injection / RCE vector.',
    recommendation: 'Drop shell:true and pass an argument array, or strictly validate the input. Never combine shell:true with assembled command strings.',
  },
];

const SCANNER = makeRegexScanner({
  ruleName: 'command-injection',
  category: 'command-injection',
  patterns: PATTERNS,
});

export const scanFileContent = SCANNER.scanFileContent;
export const scanAddedLines = SCANNER.scanAddedLines;
export const scanDiff = SCANNER.scanDiff;
