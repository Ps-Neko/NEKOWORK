// Package-Lockfile-Risk rule for verify-pr.
//
// Detects supply-chain-relevant additions in package.json / scripts:
//   - postinstall / preinstall / prepare scripts (run automatically on install)
//   - npm script that pipes curl into a shell, sudo, or arbitrary network exec
//   - dependency declared via git URL / http URL / tarball (instead of registry)
//
// Per docs/SCOPE-1.0.md §6: "dependency 추가 자체는 BLOCK 아님."  So a plain
// version bump or a new dep from the npm registry is not flagged here. The
// rule fires on the install-time-execution surface.

import { makeRegexScanner } from './_helpers.js';

const PATTERNS = [
  {
    id: 'install-hook-postinstall',
    re: /"postinstall"\s*:\s*"[^"]+"/g,
    severity: 'high',
    title: 'postinstall script added',
    description: 'postinstall runs automatically when the package or its dependents install. AI-added postinstall hooks have been used to execute arbitrary code on install.',
    recommendation: 'Confirm the hook is intentional and audit what it runs. Strongly prefer no install-time execution.',
  },
  {
    id: 'install-hook-preinstall',
    re: /"preinstall"\s*:\s*"[^"]+"/g,
    severity: 'high',
    title: 'preinstall script added',
    description: 'preinstall runs before package installation. Same install-time-execution risk as postinstall.',
    recommendation: 'Audit the script. Prefer build-time generation over install-time execution.',
  },
  {
    // Plain "install" lifecycle hook. npm runs it on install (after a node-gyp
    // rebuild fallback). The (?<!...) lookbehind keeps it from matching the
    // tail of "preinstall"/"postinstall", and the leading delimiter class
    // (start | { | , | whitespace) ensures we matched a real JSON key.
    id: 'install-hook-install',
    re: /(?<![A-Za-z])"install"\s*:\s*"[^"]+"/g,
    severity: 'high',
    title: 'install lifecycle script added',
    description: 'The "install" npm lifecycle hook runs automatically on install — same install-time-execution risk as pre/postinstall.',
    recommendation: 'Confirm the hook is intentional and audit what it runs. Prefer no install-time execution.',
  },
  {
    // "prepublish" / "prepublishOnly" run when the package is published — a
    // supply-chain vector (malicious code executes on the maintainer's machine
    // at publish time and never appears in the published tarball's runtime).
    id: 'install-hook-prepublish',
    re: /"prepublish(?:Only)?"\s*:\s*"[^"]+"/g,
    severity: 'high',
    title: 'prepublish/prepublishOnly script added',
    description: 'prepublish and prepublishOnly run at publish time. They are a supply-chain vector: code executes on the publisher\'s machine.',
    recommendation: 'Audit the script. Prefer an explicit, reviewed release pipeline over publish-time hooks.',
  },
  {
    id: 'install-hook-prepare-shell',
    // "prepare" with shell command content (chained, sudo, curl, etc.).
    re: /"prepare"\s*:\s*"[^"]*(?:&&|;|\|\s*sh|\bsudo\b|\bcurl\b|\bwget\b)[^"]*"/g,
    severity: 'high',
    title: 'prepare script runs shell commands',
    description: '`prepare` runs on install AND on publish, and the script chains shell commands.',
    recommendation: 'Move complex shell into a separate script file, or remove install-time chains.',
  },
  {
    id: 'script-curl-bash',
    // curl ... | sh or | bash (in any script value or shell line)
    re: /\bcurl\b[^"\n]*?\|\s*(?:sh|bash|zsh|sudo\s+bash)\b/g,
    severity: 'critical',
    title: 'curl | bash pattern detected',
    description: 'Piping curl output into a shell executes arbitrary remote code at install/build time.',
    recommendation: 'Download the script, audit it, then run it from a pinned file. Never pipe network content directly to a shell.',
  },
  {
    id: 'script-wget-bash',
    re: /\bwget\b[^"\n]*?\|\s*(?:sh|bash|zsh|sudo\s+bash)\b/g,
    severity: 'critical',
    title: 'wget | bash pattern detected',
    description: 'Piping wget output into a shell executes arbitrary remote code.',
    recommendation: 'Audit the remote content before executing; pin a version.',
  },
  {
    id: 'script-with-sudo',
    re: /"[^"]*\bsudo\s+[^"]+"/g,
    severity: 'high',
    title: 'npm script uses sudo',
    description: 'A package.json script invokes sudo. Elevation in an install/build script is rarely necessary and is a sandbox escape risk.',
    recommendation: 'Remove the sudo or move privileged steps out of the install path.',
  },
  {
    id: 'dependency-git-url',
    // "name": "git+https://..." or "github:..."
    re: /"[^"]+"\s*:\s*"(?:git\+[a-z]+:\/\/|github:|gitlab:|bitbucket:)[^"]+"/gi,
    severity: 'high',
    title: 'dependency declared from git URL',
    description: 'Dependency is fetched from a git URL rather than the npm registry. Git-URL deps bypass registry checksums.',
    recommendation: 'Use a registry-published version, or vendor and pin the dependency.',
  },
  {
    id: 'dependency-tarball-url',
    re: /"[^"]+"\s*:\s*"https?:\/\/[^"]+\.(?:tgz|tar\.gz)"/gi,
    severity: 'high',
    title: 'dependency declared from tarball URL',
    description: 'Dependency points at a remote tarball URL instead of the npm registry.',
    recommendation: 'Use a registry-published version with an integrity hash.',
  },
];

const SCANNER = makeRegexScanner({
  ruleName: 'package-lockfile-risk',
  category: 'supply-chain',
  patterns: PATTERNS,
});

export const scanFileContent = SCANNER.scanFileContent;
export const scanAddedLines = SCANNER.scanAddedLines;
export const scanDiff = SCANNER.scanDiff;
