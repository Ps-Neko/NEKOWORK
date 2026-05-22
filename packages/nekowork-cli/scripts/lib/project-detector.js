// Project baseline detector for verify-pr.
//
// Inspects a working directory to decide which verification commands can run
// against the change. The result feeds the verification plan: a "no test
// script" answer becomes INSUFFICIENT_EVIDENCE for source changes, not PASS.
//
// Out of scope: dependency graph resolution, repo-wide static analysis.

import fs from 'node:fs';
import path from 'node:path';

const SECURITY_FILE_HINTS = [
  '.env',
  '.env.example',
  '.env.template',
  'SECURITY.md',
  '.github/workflows',
];

const CI_FILES = [
  '.github/workflows',
  '.gitlab-ci.yml',
  '.circleci/config.yml',
  'azure-pipelines.yml',
  'Jenkinsfile',
  '.travis.yml',
];

const LANGUAGE_MARKERS = [
  { type: 'node', file: 'package.json' },
  { type: 'rust', file: 'Cargo.toml' },
  { type: 'python', file: 'pyproject.toml' },
  { type: 'python', file: 'requirements.txt' },
  { type: 'go', file: 'go.mod' },
  { type: 'java', file: 'pom.xml' },
  { type: 'java', file: 'build.gradle' },
  { type: 'java', file: 'build.gradle.kts' },
  { type: 'ruby', file: 'Gemfile' },
  { type: 'php', file: 'composer.json' },
];

const LOCKFILE_TO_PM = {
  'package-lock.json': 'npm',
  'npm-shrinkwrap.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'bun.lockb': 'bun',
};

/**
 * Detect what verifications make sense for `root`.
 *
 * @param {string} root  project root directory
 * @returns {{
 *   root: string,
 *   projectType: 'node' | 'rust' | 'python' | 'go' | 'java' | 'ruby' | 'php' | 'unknown',
 *   languages: string[],
 *   packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | null,
 *   hasGit: boolean,
 *   hasTests: boolean,
 *   hasLint: boolean,
 *   hasTypecheck: boolean,
 *   hasBuild: boolean,
 *   hasAudit: boolean,
 *   hasCi: boolean,
 *   ciFiles: string[],
 *   securityFiles: string[],
 *   commands: { test: string | null, lint: string | null, typecheck: string | null, build: string | null, audit: string | null },
 *   baselineAt: string
 * }}
 */
export function detectProject(root = process.cwd()) {
  const out = {
    root,
    projectType: 'unknown',
    languages: [],
    packageManager: null,
    hasGit: exists(path.join(root, '.git')),
    hasTests: false,
    hasLint: false,
    hasTypecheck: false,
    hasBuild: false,
    hasAudit: false,
    hasCi: false,
    ciFiles: [],
    securityFiles: [],
    commands: { test: null, lint: null, typecheck: null, build: null, audit: null },
    baselineAt: new Date().toISOString(),
  };

  const langs = new Set();
  for (const marker of LANGUAGE_MARKERS) {
    if (exists(path.join(root, marker.file))) langs.add(marker.type);
  }
  out.languages = [...langs];
  out.projectType = pickPrimaryLanguage(out.languages);

  if (out.languages.includes('node')) {
    Object.assign(out, detectNode(root));
  }
  if (out.languages.includes('rust')) {
    mergeCommands(out, detectRust(root));
  }
  if (out.languages.includes('python')) {
    mergeCommands(out, detectPython(root));
  }
  if (out.languages.includes('go')) {
    mergeCommands(out, detectGo(root));
  }

  for (const file of CI_FILES) {
    const p = path.join(root, file);
    if (exists(p)) {
      out.hasCi = true;
      out.ciFiles.push(file);
    }
  }

  for (const file of SECURITY_FILE_HINTS) {
    const p = path.join(root, file);
    if (exists(p)) out.securityFiles.push(file);
  }

  return out;
}

function pickPrimaryLanguage(languages) {
  if (!languages.length) return 'unknown';
  const priority = ['node', 'rust', 'python', 'go', 'java', 'ruby', 'php'];
  for (const lang of priority) if (languages.includes(lang)) return lang;
  return languages[0];
}

function detectNode(root) {
  const pkgPath = path.join(root, 'package.json');
  const out = {
    packageManager: detectPackageManager(root),
    hasTests: false,
    hasLint: false,
    hasTypecheck: false,
    hasBuild: false,
    hasAudit: false,
    commands: { test: null, lint: null, typecheck: null, build: null, audit: null },
  };
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return out;
  }
  const scripts = pkg.scripts || {};
  const pm = out.packageManager || 'npm';
  if (scripts.test) {
    out.hasTests = true;
    out.commands.test = `${pm} test`;
  }
  if (scripts.lint) {
    out.hasLint = true;
    out.commands.lint = `${pm} run lint`;
  }
  if (scripts.typecheck) {
    out.hasTypecheck = true;
    out.commands.typecheck = `${pm} run typecheck`;
  } else if (exists(path.join(root, 'tsconfig.json'))) {
    out.hasTypecheck = true;
    out.commands.typecheck = 'npx tsc --noEmit';
  }
  if (scripts.build) {
    out.hasBuild = true;
    out.commands.build = `${pm} run build`;
  }
  if (pm === 'npm' || pm === 'yarn' || pm === 'pnpm') {
    out.hasAudit = true;
    out.commands.audit = `${pm} audit --audit-level=moderate`;
  }
  return out;
}

function detectRust(root) {
  return {
    hasTests: true,
    hasLint: true,
    hasBuild: true,
    commands: {
      test: 'cargo test',
      lint: 'cargo clippy --all-targets -- -D warnings',
      build: 'cargo build --release',
    },
  };
}

function detectPython(root) {
  const out = { hasTests: false, hasLint: false, hasTypecheck: false, commands: {} };
  if (exists(path.join(root, 'pytest.ini')) || exists(path.join(root, 'tox.ini')) || existsAny(root, ['tests', 'test'])) {
    out.hasTests = true;
    out.commands.test = 'pytest';
  }
  if (exists(path.join(root, '.ruff.toml')) || exists(path.join(root, 'ruff.toml'))) {
    out.hasLint = true;
    out.commands.lint = 'ruff check .';
  }
  if (exists(path.join(root, 'mypy.ini')) || exists(path.join(root, '.mypy.ini'))) {
    out.hasTypecheck = true;
    out.commands.typecheck = 'mypy .';
  }
  return out;
}

function detectGo(_root) {
  return {
    hasTests: true,
    hasLint: false,
    hasBuild: true,
    commands: {
      test: 'go test ./...',
      build: 'go build ./...',
    },
  };
}

function detectPackageManager(root) {
  for (const [lockfile, pm] of Object.entries(LOCKFILE_TO_PM)) {
    if (exists(path.join(root, lockfile))) return pm;
  }
  return null;
}

function mergeCommands(target, partial) {
  if (!partial) return;
  for (const key of ['hasTests', 'hasLint', 'hasTypecheck', 'hasBuild', 'hasAudit']) {
    if (partial[key]) target[key] = true;
  }
  for (const key of Object.keys(partial.commands || {})) {
    if (!target.commands[key] && partial.commands[key]) {
      target.commands[key] = partial.commands[key];
    }
  }
}

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function existsAny(root, names) {
  return names.some(n => exists(path.join(root, n)));
}
