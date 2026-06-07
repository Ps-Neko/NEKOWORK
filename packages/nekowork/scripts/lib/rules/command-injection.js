// Command-Injection rule for verify-pr.
//
// Flags shell command execution that interpolates / concatenates a variable
// directly into the command string — the classic OS-command-injection vector
// AI agents introduce when "shelling out":
//   - exec("ls " + userInput)
//   - execSync(`rm -rf ${path}`)
//   - spawn(`sh -c ${cmd}`, { shell: true })
//   - subprocess.run(f"git checkout {branch}", shell=True)   (Python)
//   - os.system("rm -rf " + path)                            (Python)
//   - exec.Command("sh", "-c", "tar " + name)                (Go)
//
// SAFE forms that must NOT fire (FP=0 against a diverse negative set):
//   - array-arg spawn/execFile: spawn('ls', ['-la', dir])   (no shell parsing)
//   - static-literal exec:      exec('ls -la')               (no interpolation)
//   - exec with a plain variable that is itself the whole command and was
//     validated elsewhere is out of scope (we only flag interpolation INTO a
//     command string, which is the unambiguous injection shape).
//   - subprocess.run(["ls", "-la"])  / subprocess.run("ls", shell=False) (Py)
//   - os.system("ls -la")            (static literal, Python)
//   - exec.Command("ls", "-la")      (arg array, Go)
//
// Multi-language coverage mirrors insecure-tls.js: each language gets its own
// regex pattern; the JS engine never sees the Python/Go forms and vice versa.
//
// Severity: high (critical when force flags / rm appear is left to other rules).

import { makeRegexScanner } from './_helpers.js';

// A command string argument that mixes a string literal with a concatenation
// (`"..." +`) or a template interpolation (`${...}` inside backticks). This is
// the dynamic-command shape. We require the FIRST argument to be such a string;
// a bare variable or an array literal does not match.
const CONCAT_STR = '(?:"[^"\\n]*"|\'[^\'\\n]*\')\\s*\\+'; // "lit" +  / 'lit' +
const TEMPLATE_INTERP = '`[^`\\n]*\\$\\{[^}]+\\}[^`\\n]*`'; // `...${x}...`

// Python dynamic-command shapes. A command argument is dynamic when it is:
//   - an f-string:        f"... {x} ..."  /  f'... {x} ...'
//   - a concatenation:    "..." + x       (string literal followed by `+`)
//   - a %-format:         "..." % x       (string literal followed by `%`)
//   - a bare variable:    cmd             (identifier, not a quote) — only for
//                         the shell=True / os.system / os.popen sinks where a
//                         non-literal first arg is the injectable shape.
// A pure string literal (`"ls -la"`) or a list literal (`["ls", "-la"]`) is
// the safe shape and must NOT match.
const PY_FSTRING = 'f(?:"[^"\\n]*\\{[^}]+\\}[^"\\n]*"|\'[^\'\\n]*\\{[^}]+\\}[^\'\\n]*\')';
const PY_CONCAT = '(?:"[^"\\n]*"|\'[^\'\\n]*\')\\s*[+%]'; // "lit" + x  /  "lit" % x
// A non-literal, non-list first argument: an identifier (variable) optionally
// with attribute/subscript access. Excludes a leading quote (string literal)
// and a leading `[` (list args).
const PY_VAR = '[A-Za-z_][\\w.\\[\\]\'"]*';
const PY_DYNAMIC = `(?:${PY_FSTRING}|${PY_CONCAT})`;

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
  {
    // Python: subprocess.run / call / Popen with shell=True AND a dynamic
    // command (f-string / concat / %-format / bare variable). shell=True hands
    // the command string to /bin/sh, so an assembled command is injectable.
    // A list-literal first arg (`subprocess.run(["ls","-la"])`) or shell=False
    // never matches — the regex requires a non-list dynamic command followed by
    // shell=True within the same call.
    //   subprocess.run(f"git checkout {branch}", shell=True)
    //   subprocess.Popen("rm -rf " + path, shell=True)
    //   subprocess.call(cmd, shell=True)
    id: 'py-subprocess-shell-true',
    re: new RegExp(`\\bsubprocess\\.(?:run|call|Popen|check_output|check_call)\\s*\\(\\s*(?:${PY_DYNAMIC}|${PY_VAR})[\\s\\S]{0,200}?shell\\s*=\\s*True`, 'g'),
    severity: 'critical',
    title: 'Python subprocess with shell=True and a dynamic command',
    description: 'subprocess.run/call/Popen with shell=True runs the command string through the shell; the command is built from an f-string / concatenation / variable — an OS-command-injection vector.',
    recommendation: 'Drop shell=True and pass an argument list (subprocess.run(["git", "checkout", branch])), or strictly validate the input.',
  },
  {
    // Python: os.system with a dynamic command (f-string / concat / %-format).
    // A static literal (os.system("ls -la")) is the safe shape and is excluded
    // by requiring an f-string or a literal-then-(+/%) concatenation.
    //   os.system(f"rm -rf {path}")   os.system("tar " + name)
    id: 'py-os-system',
    re: new RegExp(`\\bos\\.system\\s*\\(\\s*(?:${PY_DYNAMIC})`, 'g'),
    severity: 'critical',
    title: 'Python os.system with a dynamic command',
    description: 'os.system runs the string through the shell; the command is assembled from an f-string / concatenation / %-format of a variable — an OS-command-injection vector.',
    recommendation: 'Use subprocess.run with an argument list and shell=False, or strictly validate the input. Never feed os.system an assembled command.',
  },
  {
    // Python: os.popen with a dynamic command (f-string / concat / %-format /
    // bare variable). os.popen always goes through the shell, so any non-literal
    // command is injectable. A static literal first arg does not match.
    //   os.popen(f"ls {dir}")   os.popen("grep " + pat)   os.popen(cmd)
    id: 'py-os-popen',
    re: new RegExp(`\\bos\\.popen\\s*\\(\\s*(?:${PY_DYNAMIC}|${PY_VAR}\\s*[,)])`, 'g'),
    severity: 'high',
    title: 'Python os.popen with a dynamic command',
    description: 'os.popen runs the command through the shell; the command is built from an f-string / concatenation / variable — an OS-command-injection vector.',
    recommendation: 'Use subprocess.run with an argument list (shell=False). Do not pass an assembled command to os.popen.',
  },
  {
    // Go: exec.Command("sh", "-c", <dynamic>) / ("bash", "-c", <dynamic>).
    // Passing a shell with `-c` and a concatenated / Sprintf'd / variable third
    // argument re-introduces shell parsing — the Go command-injection shape.
    // exec.Command("ls", "-la") (a real binary + literal args) does NOT match
    // because the first arg must be a shell (sh/bash) followed by -c.
    //   exec.Command("sh", "-c", "tar " + name)
    //   exec.Command("bash", "-c", fmt.Sprintf("rm %s", path))
    //   exec.Command("sh", "-c", cmd)
    id: 'go-exec-shell-c',
    re: /\bexec\.Command\s*\(\s*"(?:sh|bash|\/bin\/sh|\/bin\/bash)"\s*,\s*"-c"\s*,\s*(?:"[^"\n]*"\s*\+|fmt\.Sprintf\s*\(|[A-Za-z_]\w*\s*[,)])/g,
    severity: 'critical',
    title: 'Go exec.Command with sh -c and a dynamic command',
    description: 'exec.Command("sh", "-c", <dynamic>) runs the third argument through the shell; it is built from concatenation / fmt.Sprintf / a variable — an OS-command-injection vector.',
    recommendation: 'Invoke the target binary directly with separate argument strings (exec.Command("git", "checkout", branch)) instead of routing through sh -c.',
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
